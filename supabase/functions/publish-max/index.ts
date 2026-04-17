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

    // Get user's MAX channel setting
    const { data: channelSetting } = await supabase
      .from("channel_settings")
      .select("channel_chat_id, manager_url, personal_url")
      .eq("user_id", userId)
      .eq("channel", "max")
      .eq("is_active", true)
      .single();

    if (!channelSetting?.channel_chat_id) {
      return new Response(JSON.stringify({ error: "MAX канал не настроен. Укажите Chat ID в настройках каналов." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_BOT_TOKEN = Deno.env.get("MAX_BOT_TOKEN");
    if (!MAX_BOT_TOKEN) {
      return new Response(JSON.stringify({ error: "MAX бот не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message text. MAX supports markdown formatting via "format": "markdown".
    let text = "";
    if (post.title) text += `${post.title}\n\n`;
    text += post.content;

    let useMarkdown = false;
    if (post.include_footer !== false) {
      const footerLines: string[] = [];
      if (channelSetting.manager_url?.trim()) {
        footerLines.push(`👉 [Связаться с менеджером](${channelSetting.manager_url.trim()})`);
        useMarkdown = true;
      }
      if (channelSetting.personal_url?.trim()) {
        footerLines.push(`👉 [Связаться со мной](${channelSetting.personal_url.trim()})`);
        useMarkdown = true;
      }
      if (footerLines.length) text += `\n\n${footerLines.join("\n")}`;
    }

    const chatId = channelSetting.channel_chat_id.trim();

    if (!/^-?\d+$/.test(chatId)) {
      return new Response(JSON.stringify({
        error: `MAX требует числовой chat_id (int64), получено: "${chatId}". Откройте чат/канал в MAX, у бота вызовите /chats или используйте числовой ID чата, а не бизнес-идентификатор.`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://platform-api.max.ru/messages");
    url.searchParams.set("chat_id", chatId);

    const body: Record<string, unknown> = { text };
    if (useMarkdown) body.format = "markdown";

    // Upload image to MAX (two-step): /uploads -> upload binary -> token in attachment
    let imageWarning: string | null = null;
    if (post.image_url) {
      try {
        console.log("MAX: requesting upload URL");
        const uploadInfoResp = await fetch(
          "https://platform-api.max.ru/uploads?type=image",
          { method: "POST", headers: { "Authorization": MAX_BOT_TOKEN } },
        );
        const uploadInfoText = await uploadInfoResp.text();
        console.log("MAX /uploads:", uploadInfoResp.status, uploadInfoText.slice(0, 300));
        if (!uploadInfoResp.ok) throw new Error(`/uploads ${uploadInfoResp.status}: ${uploadInfoText.slice(0, 200)}`);
        const uploadInfo = JSON.parse(uploadInfoText);
        const uploadUrl = uploadInfo.url as string;
        if (!uploadUrl) throw new Error("MAX не вернул upload url");

        console.log("MAX: downloading image from", post.image_url);
        const imgResp = await fetch(post.image_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LovableBot/1.0)" },
        });
        if (!imgResp.ok) throw new Error(`download image: HTTP ${imgResp.status}`);
        const contentType = imgResp.headers.get("content-type") || "image/png";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const imgBuffer = await imgResp.arrayBuffer();
        console.log("MAX: image bytes=", imgBuffer.byteLength);

        const formData = new FormData();
        formData.append("data", new Blob([imgBuffer], { type: contentType }), `photo.${ext}`);
        const upResp = await fetch(uploadUrl, { method: "POST", body: formData });
        const upText = await upResp.text();
        console.log("MAX upload response:", upResp.status, upText.slice(0, 300));
        if (!upResp.ok) throw new Error(`upload ${upResp.status}: ${upText.slice(0, 200)}`);
        const upJson = JSON.parse(upText);
        const photoToken = upJson.token || upJson.photos?.photo?.token || Object.values(upJson.photos || {})[0]?.token;
        if (!photoToken) throw new Error(`MAX не вернул token: ${upText.slice(0, 200)}`);

        body.attachments = [{ type: "image", payload: { token: photoToken } }];
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        console.error("MAX image upload failed:", msg);
        imageWarning = msg;
      }
    }

    console.log("MAX request:", { chatId, hasImage: !!body.attachments, textLen: text.length });

    const maxResponse = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": MAX_BOT_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const rawText = await maxResponse.text();
    let maxData: any = {};
    try { maxData = JSON.parse(rawText); } catch { /* keep raw */ }
    console.log("MAX response:", maxResponse.status, rawText.slice(0, 500));

    if (!maxResponse.ok || maxData?.code) {
      console.error("MAX API error:", maxResponse.status, maxData);
      const errMsg = maxData?.message || maxData?.code || rawText.slice(0, 200) || `HTTP ${maxResponse.status}`;
      return new Response(JSON.stringify({ error: `Ошибка MAX: ${errMsg}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    console.log("MAX message sent:", { postId, chatId, response: maxData });

    return new Response(JSON.stringify({ ok: true, message: maxData?.message ?? maxData, image_warning: imageWarning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-max error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
