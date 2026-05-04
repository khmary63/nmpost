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

    // Get group id from this user's vk channel settings
    const { data: vkSetting } = await supabase
      .from("channel_settings")
      .select("channel_chat_id")
      .eq("user_id", userId)
      .eq("channel", "vk")
      .maybeSingle();

    const groupId = vkSetting?.channel_chat_id?.replace(/[^\d]/g, "").trim();
    if (!groupId) {
      return new Response(JSON.stringify({ error: "Сначала укажите ID группы ВК и сохраните настройки." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizeToken = (raw?: string | null) =>
      raw?.replace(/^access_token=/, "").split("&")[0].trim() || "";
    const VK_TOKEN = normalizeToken(Deno.env.get("VK_COMMUNITY_TOKEN"));
    if (!VK_TOKEN) {
      return new Response(JSON.stringify({ error: "VK токен сообщества не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch channels of the community via messages.getConversations + filter=channels
    // VK API: messages.getConversations supports `filter=channels` for community channels
    const url = new URL("https://api.vk.com/method/messages.getConversations");
    url.search = new URLSearchParams({
      filter: "all",
      group_id: groupId,
      count: "200",
      access_token: VK_TOKEN,
      v: "5.199",
    }).toString();

    const resp = await fetch(url.toString());
    const data = await resp.json();
    console.log("list-vk-channels response:", JSON.stringify(data).slice(0, 1000));

    if (data.error) {
      return new Response(JSON.stringify({
        error: `VK: ${data.error.error_msg} (code ${data.error.error_code})`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const items = (data.response?.items || []) as Array<{ conversation: any }>;
    // Channels in VK community messenger have peer.type = "channel" or are marked as channel
    const channels = items
      .map((it: any) => it.conversation)
      .filter((c: any) => {
        // Try to detect channel-type conversations
        const peerType = c?.peer?.type;
        return peerType === "channel" || c?.chat_settings?.is_channel === true;
      })
      .map((c: any) => ({
        peer_id: c.peer.id,
        title: c.chat_settings?.title || `Канал ${c.peer.id}`,
        members_count: c.chat_settings?.members_count ?? null,
      }));

    return new Response(JSON.stringify({ ok: true, channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-vk-channels error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
