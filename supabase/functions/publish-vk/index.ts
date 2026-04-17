import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { postId } = await req.json();
    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", userId)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: "Пост не найден" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's VK channel setting
    const { data: channelSetting } = await supabase
      .from("channel_settings")
      .select("channel_chat_id, manager_url, personal_url")
      .eq("user_id", userId)
      .eq("channel", "vk")
      .eq("is_active", true)
      .single();

    if (!channelSetting?.channel_chat_id) {
      return new Response(JSON.stringify({ error: "ВКонтакте не настроен. Укажите ID группы в настройках каналов." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VK_COMMUNITY_TOKEN_RAW = Deno.env.get("VK_COMMUNITY_TOKEN");
    const VK_USER_TOKEN_RAW = Deno.env.get("VK_USER_TOKEN");
    const VK_TOKEN = VK_COMMUNITY_TOKEN_RAW?.replace(/^access_token=/, "").split("&")[0].trim();
    const VK_USER_TOKEN = VK_USER_TOKEN_RAW?.replace(/^access_token=/, "").split("&")[0].trim();

    if (!VK_TOKEN) {
      return new Response(JSON.stringify({ error: "VK токен не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (VK_USER_TOKEN_RAW && VK_USER_TOKEN_RAW.includes("&")) {
      console.warn("VK_USER_TOKEN contains extra OAuth params, using normalized access token only");
    }

    // Build message
    let message = "";
    if (post.title) message += `${post.title}\n\n`;
    message += post.content;

    // VK supports [URL|text] syntax ONLY for vk.com links. External links are auto-linkified as plain URLs.
    if (post.include_footer !== false) {
      const footerLines: string[] = [];
      const buildVkLine = (label: string, url: string) => {
        const u = url.trim();
        const vkMatch = u.match(/^https?:\/\/(?:m\.)?vk\.com\/([A-Za-z0-9_.\-]+)\/?$/);
        if (vkMatch) {
          // VK internal link — clickable text via [screen_name|text] syntax
          return `👉 [${vkMatch[1]}|${label}]`;
        }
        // External URL — emoji + label, then URL on next line (auto-linked by VK)
        return `👉 ${label}\n${u}`;
      };
      if (channelSetting.manager_url?.trim()) {
        footerLines.push(buildVkLine("Связаться с менеджером", channelSetting.manager_url));
      }
      if (channelSetting.personal_url?.trim()) {
        footerLines.push(buildVkLine("Связаться со мной", channelSetting.personal_url));
      }
      if (footerLines.length) message += `\n\n${footerLines.join("\n\n")}`;
    }

    const normalizedGroupId = channelSetting.channel_chat_id.replace(/[^\d-]/g, "").trim();
    const numericGroupId = Number.parseInt(normalizedGroupId, 10);
    if (!Number.isFinite(numericGroupId) || numericGroupId === 0) {
      return new Response(JSON.stringify({ error: "Некорректный ID группы ВК. Укажите только числовой ID сообщества." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // owner_id for community is negative
    const ownerId = -Math.abs(numericGroupId);
    const groupId = Math.abs(numericGroupId);

    // Upload image to VK if present.
    // photos.getWallUploadServer requires a USER token with photos scope (group token returns "method is unavailable with group auth").
    let attachments = "";
    let imageWarning: string | null = null;
    if (post.image_url) {
      try {
        if (!VK_USER_TOKEN) {
          throw new Error("Для загрузки картинок в VK нужен VK_USER_TOKEN (user access token со scope=photos,wall,groups). Добавьте его в секреты.");
        }
        console.log("VK: starting image upload, image_url=", post.image_url);

        // 1. Get wall upload server (USER token)
        const uploadServerUrl = new URL("https://api.vk.com/method/photos.getWallUploadServer");
        uploadServerUrl.search = new URLSearchParams({
          group_id: String(groupId),
          access_token: VK_USER_TOKEN,
          v: "5.199",
        }).toString();
        const uploadServerResp = await fetch(uploadServerUrl.toString());
        const uploadServerData = await uploadServerResp.json();
        console.log("VK getWallUploadServer:", JSON.stringify(uploadServerData));
        if (uploadServerData.error) throw new Error(`getWallUploadServer: ${uploadServerData.error.error_msg}`);
        const uploadUrl = uploadServerData.response?.upload_url as string;
        if (!uploadUrl) throw new Error("VK не вернул upload_url");

        // 2. Download image
        const imgResp = await fetch(post.image_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
        });
        if (!imgResp.ok) throw new Error(`Не удалось скачать картинку: HTTP ${imgResp.status}`);
        const contentType = imgResp.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const imgBuffer = await imgResp.arrayBuffer();
        console.log("VK: downloaded image bytes=", imgBuffer.byteLength, "type=", contentType);

        // 3. Upload to VK
        const formData = new FormData();
        formData.append("photo", new Blob([imgBuffer], { type: contentType }), `photo.${ext}`);
        const uploadResp = await fetch(uploadUrl, { method: "POST", body: formData });
        const uploadData = await uploadResp.json();
        console.log("VK upload response:", JSON.stringify(uploadData));
        if (!uploadData.photo || uploadData.photo === "[]" || uploadData.photo === "") {
          throw new Error(`VK не принял фото: ${JSON.stringify(uploadData)}`);
        }

        // 4. Save photo (USER token) — send as POST body because `photo` can be very large
        const saveBody = new URLSearchParams({
          group_id: String(groupId),
          photo: uploadData.photo,
          server: String(uploadData.server),
          hash: uploadData.hash,
          access_token: VK_USER_TOKEN,
          v: "5.199",
        });
        const saveResp = await fetch("https://api.vk.com/method/photos.saveWallPhoto", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: saveBody.toString(),
        });
        const saveData = await saveResp.json();
        console.log("VK saveWallPhoto:", JSON.stringify(saveData));
        if (saveData.error) throw new Error(`saveWallPhoto: ${saveData.error.error_msg}`);
        const photo = saveData.response?.[0];
        if (photo) {
          attachments = `photo${photo.owner_id}_${photo.id}`;
          console.log("VK attachment built:", attachments);
        } else {
          throw new Error("saveWallPhoto не вернул фото");
        }
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        console.error("VK image upload failed:", msg);
        imageWarning = msg;
      }
    }

    // Call VK API wall.post
    const params = new URLSearchParams({
      owner_id: String(ownerId),
      from_group: "1",
      message,
      access_token: VK_TOKEN,
      v: "5.199",
    });
    if (attachments) params.set("attachments", attachments);

    const vkResponse = await fetch(`https://api.vk.com/method/wall.post?${params.toString()}`, {
      method: "POST",
    });

    const vkData = await vkResponse.json();
    if (vkData.error) {
      console.error("VK API error:", vkData.error);
      const errorText = `${vkData.error.error_msg || "Unknown"}${vkData.error.error_code ? ` (code ${vkData.error.error_code})` : ""}`;
      return new Response(JSON.stringify({ error: `Ошибка VK: ${errorText}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postIdFromVk = Number(vkData.response?.post_id);
    if (!Number.isFinite(postIdFromVk) || postIdFromVk <= 0) {
      console.error("VK API unexpected response:", vkData);
      return new Response(JSON.stringify({ error: "VK не подтвердил публикацию поста" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postUrl = `https://vk.com/wall${ownerId}_${postIdFromVk}`;

    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    console.log("VK post published:", { postId, vk_post_id: postIdFromVk, postUrl, ownerId });

    return new Response(JSON.stringify({ ok: true, post_id: postIdFromVk, post_url: postUrl, image_warning: imageWarning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-vk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
