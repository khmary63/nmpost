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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { postId } = await req.json();
    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Try to get token from channel_settings first, fallback to env
    const { data: vkChannel } = await supabase
      .from("channel_settings")
      .select("channel_chat_id")
      .eq("user_id", userId)
      .eq("channel", "vk_personal")
      .eq("is_active", true)
      .single();

    const VK_USER_TOKEN = vkChannel?.channel_chat_id || Deno.env.get("VK_USER_TOKEN");
    if (!VK_USER_TOKEN) {
      return new Response(JSON.stringify({ error: "VK User Token не настроен. Обновите токен в настройках каналов." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "";
    if (post.title) message += `${post.title}\n\n`;
    message += post.content;

    // Post to personal wall (owner_id not needed, defaults to token owner)
    const params = new URLSearchParams({
      message,
      access_token: VK_USER_TOKEN,
      v: "5.199",
    });

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

    // Get user_id from token response to build URL
    const vkUserId = Deno.env.get("VK_USER_ID") || "";
    const postUrl = vkUserId ? `https://vk.com/wall${vkUserId}_${postIdFromVk}` : "";

    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    console.log("VK personal post published:", { postId, vk_post_id: postIdFromVk, postUrl });

    return new Response(JSON.stringify({ ok: true, post_id: postIdFromVk, post_url: postUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-vk-personal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
