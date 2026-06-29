import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripMarkdown } from "../_shared/markdown.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function inspectVkPeer(accessToken: string, groupId: number, peerId: number): Promise<any | null> {
  try {
    const url = new URL("https://api.vk.com/method/messages.getConversationsById");
    url.search = new URLSearchParams({
      peer_ids: String(peerId),
      group_id: String(groupId),
      access_token: accessToken,
      v: "5.199",
    }).toString();
    const data = await (await fetch(url.toString())).json();
    console.log("VK peer inspect:", JSON.stringify(data).slice(0, 1500));
    return data;
  } catch (e) {
    console.warn("VK peer inspect failed:", e);
    return null;
  }
}

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
      .select("channel_chat_id, manager_url, personal_url, vk_channel_id, vk_duplicate_to_channel")
      .eq("user_id", userId)
      .eq("channel", "vk")
      .eq("is_active", true)
      .single();

    if (!channelSetting?.channel_chat_id) {
      return new Response(JSON.stringify({ error: "ВКонтакте не настроен. Укажите ID группы в настройках каналов." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizeToken = (raw?: string | null) =>
      raw?.replace(/^access_token=/, "").split("&")[0].trim() || "";

    const VK_COMMUNITY_TOKEN_RAW = Deno.env.get("VK_COMMUNITY_TOKEN");
    const VK_TOKEN = normalizeToken(VK_COMMUNITY_TOKEN_RAW);

    // Prefer per-user VK token from channel_settings (channel = "vk_user_token"),
    // fallback to global VK_USER_TOKEN secret for backward compatibility.
    const { data: vkUserTokenRow } = await supabase
      .from("channel_settings")
      .select("channel_chat_id")
      .eq("user_id", userId)
      .eq("channel", "vk_user_token")
      .eq("is_active", true)
      .maybeSingle();

    const VK_USER_TOKEN = normalizeToken(vkUserTokenRow?.channel_chat_id) ||
      normalizeToken(Deno.env.get("VK_USER_TOKEN"));

    // Token used for wall.post / comments. Prefer the user token (admin of the
    // community) because the global community token is often invalid (VK error 38).
    // from_group=1 makes the post appear on behalf of the community.
    const VK_POST_TOKEN = VK_USER_TOKEN || VK_TOKEN;

    if (!VK_POST_TOKEN) {
      return new Response(JSON.stringify({ error: "VK не настроен. Подключите ваш VK-аккаунт в настройках канала." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message
    let message = "";
    if (post.title) message += `${stripMarkdown(post.title)}\n\n`;
    message += stripMarkdown(post.content);

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

    // Determine images list
    const imagesList: string[] = Array.isArray(post.image_urls) && post.image_urls.length > 0
      ? post.image_urls
      : (post.image_url ? [post.image_url] : []);

    // Upload images to VK if present.
    // photos.getWallUploadServer requires a USER token with photos scope (group token returns "method is unavailable with group auth").
    let attachments = "";
    let imageWarning: string | null = null;
    if (imagesList.length > 0) {
      try {
        if (!VK_USER_TOKEN) {
          throw new Error("Для загрузки картинок в VK подключите ваш аккаунт: откройте настройки канала VK и нажмите «Подключить VK».");
        }

        // 1. Get wall upload server (USER token) — once for all photos
        const uploadServerUrl = new URL("https://api.vk.com/method/photos.getWallUploadServer");
        uploadServerUrl.search = new URLSearchParams({
          group_id: String(groupId),
          access_token: VK_USER_TOKEN,
          v: "5.199",
        }).toString();
        const uploadServerResp = await fetch(uploadServerUrl.toString());
        const uploadServerData = await uploadServerResp.json();
        if (uploadServerData.error) throw new Error(`getWallUploadServer: ${uploadServerData.error.error_msg}`);
        const uploadUrl = uploadServerData.response?.upload_url as string;
        if (!uploadUrl) throw new Error("VK не вернул upload_url");

        const builtAttachments: string[] = [];
        // VK wall posts allow up to 10 attachments
        for (const imgUrl of imagesList.slice(0, 10)) {
          const imgResp = await fetch(imgUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
          });
          if (!imgResp.ok) throw new Error(`Не удалось скачать картинку: HTTP ${imgResp.status}`);
          const contentType = imgResp.headers.get("content-type") || "image/jpeg";
          const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
          const imgBuffer = await imgResp.arrayBuffer();

          // Upload with retry — VK upload server occasionally returns HTML error page (502/504)
          let uploadData: any = null;
          let lastErr = "";
          const MAX_ATTEMPTS = 6;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Refresh upload server URL on retries — old URL может протухнуть
            let currentUploadUrl = uploadUrl;
            if (attempt > 1) {
              try {
                const refreshUrl = new URL("https://api.vk.com/method/photos.getWallUploadServer");
                refreshUrl.search = new URLSearchParams({
                  group_id: String(groupId),
                  access_token: VK_USER_TOKEN,
                  v: "5.199",
                }).toString();
                const r = await fetch(refreshUrl.toString());
                const d = await r.json();
                if (d.response?.upload_url) currentUploadUrl = d.response.upload_url;
              } catch { /* keep old url */ }
            }

            try {
              const formData = new FormData();
              formData.append("photo", new Blob([imgBuffer], { type: contentType }), `photo.${ext}`);
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 30000);
              const uploadResp = await fetch(currentUploadUrl, { method: "POST", body: formData, signal: ctrl.signal });
              clearTimeout(timer);
              const respText = await uploadResp.text();
              try {
                uploadData = JSON.parse(respText);
                if (uploadData.photo && uploadData.photo !== "[]" && uploadData.photo !== "") break;
                lastErr = `VK не принял фото: ${respText.slice(0, 300)}`;
              } catch {
                lastErr = `VK upload временно недоступен (HTTP ${uploadResp.status})`;
                uploadData = null;
              }
            } catch (e) {
              lastErr = `VK upload недоступен: ${e instanceof Error ? e.message : String(e)}`;
              uploadData = null;
            }
            if (attempt < MAX_ATTEMPTS) {
              const delay = Math.min(1500 * attempt, 6000);
              console.log(`VK upload attempt ${attempt} failed (${lastErr}), retrying in ${delay}ms`);
              await new Promise((r) => setTimeout(r, delay));
            }
          }
          if (!uploadData?.photo || uploadData.photo === "[]" || uploadData.photo === "") {
            throw new Error(lastErr || "VK не принял фото после 3 попыток");
          }

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
          if (saveData.error) throw new Error(`saveWallPhoto: ${saveData.error.error_msg}`);
          const photo = saveData.response?.[0];
          if (!photo) throw new Error("saveWallPhoto не вернул фото");
          builtAttachments.push(`photo${photo.owner_id}_${photo.id}`);
        }
        attachments = builtAttachments.join(",");
        console.log("VK attachments built:", attachments);
      } catch (imgErr) {
        const rawMessage = imgErr instanceof Error ? imgErr.message : String(imgErr);
        const msg = /access_token has expired/i.test(rawMessage)
          ? "Срок действия VK-токена для загрузки фото истёк. Откройте настройки канала VK и нажмите «Переподключить VK»."
          : /VK upload (вернул не-JSON|временно недоступен|недоступен)/i.test(rawMessage)
          ? "Серверы загрузки фото ВК временно недоступны (504). Попробуйте опубликовать ещё раз через 1–2 минуты."
          : rawMessage;
        console.error("VK image upload failed:", msg);
        imageWarning = msg;
      }
    }

    // Call VK API wall.post — send params in body (POST), not query string,
    // because long messages cause request to fail when sent in URL.
    const params = new URLSearchParams({
      owner_id: String(ownerId),
      from_group: "1",
      message,
      access_token: VK_POST_TOKEN,
      v: "5.199",
    });
    if (attachments) params.set("attachments", attachments);

    const vkResponse = await fetch("https://api.vk.com/method/wall.post", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
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

    console.log("VK post published:", { postId, vk_post_id: postIdFromVk, postUrl, ownerId });

    // ===== Optional first comment =====
    let commentWarning: string | null = null;
    const firstComment = (post.first_comment || "").trim();
    if (firstComment) {
      try {
        const commentText = stripMarkdown(firstComment);
        const cParams = new URLSearchParams({
          owner_id: String(ownerId),
          post_id: String(postIdFromVk),
          from_group: String(groupId),
          message: commentText,
          access_token: VK_POST_TOKEN,
          v: "5.199",
        });
        const cResp = await fetch("https://api.vk.com/method/wall.createComment", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: cParams.toString(),
        });
        const cData = await cResp.json();
        if (cData.error) {
          commentWarning = `VK комментарий: ${cData.error.error_msg || "unknown"}`;
          console.error("VK createComment error:", cData.error);
        }
      } catch (e) {
        commentWarning = `VK комментарий: ${e instanceof Error ? e.message : String(e)}`;
        console.error("VK comment failed:", e);
      }
    }

    // ===== Duplicate to community channel (VK Messenger Channels) =====
    let channelWarning: string | null = null;
    let channelMessageId: number | null = null;
    if (channelSetting.vk_duplicate_to_channel && channelSetting.vk_channel_id) {
      try {
        const rawPeerId = String(channelSetting.vk_channel_id).trim();
        const peerId = Number.parseInt(rawPeerId.replace(/[^\d-]/g, ""), 10);
        if (!Number.isFinite(peerId) || peerId === 0) {
          throw new Error("Некорректный ID канала ВК");
        }
        if (!/^\d+$/.test(rawPeerId) || peerId < 2_000_000_000) {
          throw new Error("Указан не канал сообщества VK, а обычный чат. Загрузите список каналов заново и выберите настоящий канал сообщества.");
        }
        // Diagnostic only — VK API не всегда корректно сообщает is_channel/peer.type для каналов сообществ,
        // поэтому полагаемся на реальный ответ messages.send, а не на предварительную валидацию.
        const peerInfo = await inspectVkPeer(VK_TOKEN, groupId, peerId);
        const membersCount = peerInfo?.response?.items?.[0]?.chat_settings?.members_count;
        if (typeof membersCount === "number" && membersCount <= 1) {
          throw new Error("Выбрана служебная беседа VK без участников. Откройте «Загрузить список» и выберите беседу, где есть минимум 2 участника.");
        }

        // Build channel attachments — re-upload photo via messages upload server (different endpoint than wall)
        let channelAttachments = "";
        if (imagesList.length > 0) {
          try {
            const upUrl = new URL("https://api.vk.com/method/photos.getMessagesUploadServer");
            upUrl.search = new URLSearchParams({
              peer_id: String(peerId),
              access_token: VK_TOKEN,
              v: "5.199",
            }).toString();
            const upResp = await fetch(upUrl.toString());
            const upData = await upResp.json();
            if (upData.error) throw new Error(`getMessagesUploadServer: ${upData.error.error_msg}`);
            const uploadUrl = upData.response?.upload_url as string;
            if (!uploadUrl) throw new Error("VK не вернул upload_url для канала");

            const built: string[] = [];
            for (const imgUrl of imagesList.slice(0, 10)) {
              const imgResp = await fetch(imgUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
              });
              if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status} при скачивании картинки`);
              const ct = imgResp.headers.get("content-type") || "image/jpeg";
              const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
              const buf = await imgResp.arrayBuffer();
              const fd = new FormData();
              fd.append("photo", new Blob([buf], { type: ct }), `photo.${ext}`);
              const upPhotoResp = await fetch(uploadUrl, { method: "POST", body: fd });
              const upPhotoData = await upPhotoResp.json();
              if (!upPhotoData.photo) throw new Error("VK не принял фото для канала");

              const saveBody = new URLSearchParams({
                photo: upPhotoData.photo,
                server: String(upPhotoData.server),
                hash: upPhotoData.hash,
                access_token: VK_TOKEN,
                v: "5.199",
              });
              const saveResp = await fetch("https://api.vk.com/method/photos.saveMessagesPhoto", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: saveBody.toString(),
              });
              const saveData = await saveResp.json();
              if (saveData.error) throw new Error(`saveMessagesPhoto: ${saveData.error.error_msg}`);
              const ph = saveData.response?.[0];
              if (ph) built.push(`photo${ph.owner_id}_${ph.id}`);
            }
            channelAttachments = built.join(",");
          } catch (chImgErr) {
            console.error("VK channel image upload failed:", chImgErr);
            // Continue without images
          }
        }

        const sendBody = new URLSearchParams({
          peer_id: String(peerId),
          message,
          random_id: String(Date.now()),
          access_token: VK_TOKEN,
          v: "5.199",
        });
        if (channelAttachments) sendBody.set("attachment", channelAttachments);

        const sendResp = await fetch("https://api.vk.com/method/messages.send", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: sendBody.toString(),
        });
        const sendData = await sendResp.json();
        if (sendData.error) throw new Error(`messages.send: ${sendData.error.error_msg} (code ${sendData.error.error_code})`);
        channelMessageId = Number(sendData.response) || null;
        console.log("VK channel duplicate ok:", { peerId, channelMessageId });
      } catch (chErr) {
        const msg = chErr instanceof Error ? chErr.message : String(chErr);
        console.error("VK channel duplicate failed:", msg);
        channelWarning = `Пост опубликован на стене, но не удалось продублировать в беседу: ${msg}`;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      post_id: postIdFromVk,
      post_url: postUrl,
      image_warning: imageWarning,
      channel_warning: channelWarning,
      channel_message_id: channelMessageId,
      comment_warning: commentWarning,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-vk error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
