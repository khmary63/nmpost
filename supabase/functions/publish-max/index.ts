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
      .select("channel_chat_id")
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

    // Build message text
    let text = "";
    if (post.title) text += `${post.title}\n\n`;
    text += post.content;

    const chatId = channelSetting.channel_chat_id.trim();

    // MAX API requires numeric chat_id (int64). Reject business-style IDs like "..._biz".
    if (!/^-?\d+$/.test(chatId)) {
      return new Response(JSON.stringify({
        error: `MAX требует числовой chat_id (int64), получено: "${chatId}". Откройте чат/канал в MAX, у бота вызовите /chats или используйте числовой ID чата, а не бизнес-идентификатор.`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MAX Bot API: POST https://platform-api.max.ru/messages?chat_id=...
    // Auth format per docs: Authorization: <token>
    const url = new URL("https://platform-api.max.ru/messages");
    url.searchParams.set("chat_id", chatId);

    const body: Record<string, unknown> = { text };
    if (post.image_url) {
      body.attachments = [
        { type: "image", payload: { url: post.image_url } },
      ];
    }

    const maxResponse = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": MAX_BOT_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const maxData = await maxResponse.json().catch(() => ({}));
    if (!maxResponse.ok || maxData?.code) {
      console.error("MAX API error:", maxResponse.status, maxData);
      const errMsg = maxData?.message || maxData?.code || `HTTP ${maxResponse.status}`;
      return new Response(JSON.stringify({ error: `Ошибка MAX: ${errMsg}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    console.log("MAX message sent:", { postId, chatId, response: maxData });

    return new Response(JSON.stringify({ ok: true, message: maxData?.message ?? maxData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-max error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
