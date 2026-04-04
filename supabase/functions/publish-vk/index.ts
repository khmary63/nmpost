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
      .select("channel_chat_id")
      .eq("user_id", userId)
      .eq("channel", "vk")
      .eq("is_active", true)
      .single();

    if (!channelSetting?.channel_chat_id) {
      return new Response(JSON.stringify({ error: "ВКонтакте не настроен. Укажите ID группы в настройках каналов." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VK_TOKEN = Deno.env.get("VK_COMMUNITY_TOKEN");
    if (!VK_TOKEN) {
      return new Response(JSON.stringify({ error: "VK токен не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message
    let message = "";
    if (post.title) message += `${post.title}\n\n`;
    message += post.content;

    const normalizedGroupId = channelSetting.channel_chat_id.replace(/[^\d-]/g, "").trim();
    const numericGroupId = Number.parseInt(normalizedGroupId, 10);
    if (!Number.isFinite(numericGroupId) || numericGroupId === 0) {
      return new Response(JSON.stringify({ error: "Некорректный ID группы ВК. Укажите только числовой ID сообщества." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // owner_id for community is negative
    const ownerId = -Math.abs(numericGroupId);

    // Call VK API wall.post
    const params = new URLSearchParams({
      owner_id: String(ownerId),
      from_group: "1",
      message,
      access_token: VK_TOKEN,
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

    const verifyParams = new URLSearchParams({
      posts: `${ownerId}_${postIdFromVk}`,
      access_token: VK_TOKEN,
      v: "5.199",
    });

    const verifyResponse = await fetch(`https://api.vk.com/method/wall.getById?${verifyParams.toString()}`, {
      method: "POST",
    });
    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      console.error("VK verification error:", verifyData.error);
      const errorText = `${verifyData.error.error_msg || "Unknown"}${verifyData.error.error_code ? ` (code ${verifyData.error.error_code})` : ""}`;
      return new Response(JSON.stringify({ error: `VK вернул post_id, но не дал подтвердить запись на стене: ${errorText}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifiedPost = Array.isArray(verifyData.response)
      ? verifyData.response[0]
      : verifyData.response?.items?.[0];

    if (!verifiedPost || Number(verifiedPost.id ?? verifiedPost.post_id) !== postIdFromVk) {
      console.error("VK verification returned unexpected payload:", verifyData);
      return new Response(JSON.stringify({
        error: "VK вернул post_id, но запись не подтвердилась на стене. Проверьте, что токен выдан именно для этого сообщества и у него есть права на wall.",
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postUrl = `https://vk.com/wall${ownerId}_${postIdFromVk}`;

    await supabase.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", postId);

    console.log("VK post published:", { postId, vk_post_id: postIdFromVk, postUrl, ownerId });

    return new Response(JSON.stringify({ ok: true, post_id: postIdFromVk, post_url: postUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-vk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
