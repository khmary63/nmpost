import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { markdownToTelegramHtml } from "../_shared/markdown.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
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

    // Get user's telegram channel setting
    const { data: channelSetting } = await supabase
      .from("channel_settings")
      .select("channel_chat_id, manager_url, personal_url")
      .eq("user_id", userId)
      .eq("channel", "telegram")
      .eq("is_active", true)
      .single();

    if (!channelSetting?.channel_chat_id) {
      return new Response(JSON.stringify({ error: "Telegram канал не настроен. Укажите Chat ID в настройках каналов." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(JSON.stringify({ error: "Telegram бот не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message text
    let text = "";
    if (post.title) text += `<b>${escapeHtml(post.title)}</b>\n\n`;
    text += markdownToTelegramHtml(post.content);

    // Footer with HTML hyperlinks (👉 emoji + clickable text)
    let footer = "";
    if (post.include_footer !== false) {
      const footerLines: string[] = [];
      if (channelSetting.manager_url?.trim()) {
        footerLines.push(`👉 <a href="${escapeAttr(channelSetting.manager_url.trim())}">Связаться с менеджером</a>`);
      }
      if (channelSetting.personal_url?.trim()) {
        footerLines.push(`👉 <a href="${escapeAttr(channelSetting.personal_url.trim())}">Связаться со мной</a>`);
      }
      if (footerLines.length) footer = `\n\n${footerLines.join("\n")}`;
    }

    const fullText = text + footer;

    // Send to Telegram. If image present and full text fits in caption (1024), send sendPhoto.
    // Otherwise send photo with no caption, then sendMessage with full HTML text (so footer links survive).
    let tgResponse: Response;
    let messageId: number | undefined;
    if (post.image_url) {
      if (fullText.length <= 1024) {
        tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelSetting.channel_chat_id,
            photo: post.image_url,
            caption: fullText,
            parse_mode: "HTML",
          }),
        });
      } else {
        // Send photo without caption, then text separately to preserve all links
        const photoResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelSetting.channel_chat_id,
            photo: post.image_url,
          }),
        });
        const photoData = await photoResp.json();
        if (!photoResp.ok) {
          console.error("Telegram sendPhoto error:", photoData);
          return new Response(JSON.stringify({ error: `Ошибка Telegram (фото): ${photoData.description || "Unknown"}` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelSetting.channel_chat_id,
            text: fullText,
            parse_mode: "HTML",
          }),
        });
      }
    } else {
      tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelSetting.channel_chat_id,
          text: fullText,
          parse_mode: "HTML",
        }),
      });
    }

    const tgData = await tgResponse.json();
    if (!tgResponse.ok) {
      console.error("Telegram API error:", tgData);
      return new Response(JSON.stringify({ error: `Ошибка Telegram: ${tgData.description || "Unknown"}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update post status
    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    return new Response(JSON.stringify({ ok: true, message_id: tgData.result?.message_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-telegram error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
