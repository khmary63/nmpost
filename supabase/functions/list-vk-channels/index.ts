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

    // Try multiple strategies to find community channels.
    // VK API for community channels is poorly documented; different accounts return them
    // via different filters. We try `channels` first, then fall back to scanning all conversations.
    const tryFetch = async (params: Record<string, string>) => {
      const u = new URL("https://api.vk.com/method/messages.getConversations");
      u.search = new URLSearchParams({ ...params, access_token: VK_TOKEN, v: "5.199" }).toString();
      const r = await fetch(u.toString());
      return await r.json();
    };

    const allConversations: any[] = [];
    const errors: string[] = [];

    // Strategy 1: filter=channels (newer API)
    const r1 = await tryFetch({ filter: "channels", group_id: groupId, count: "200", extended: "1" });
    console.log("list-vk-channels [channels]:", JSON.stringify(r1).slice(0, 800));
    if (r1.error) errors.push(`channels: ${r1.error.error_msg}`);
    else if (r1.response?.items) allConversations.push(...r1.response.items);

    // Strategy 2: all conversations (we'll filter client-side)
    if (allConversations.length === 0) {
      const r2 = await tryFetch({ filter: "all", group_id: groupId, count: "200", extended: "1" });
      console.log("list-vk-channels [all]:", JSON.stringify(r2).slice(0, 800));
      if (r2.error) errors.push(`all: ${r2.error.error_msg}`);
      else if (r2.response?.items) allConversations.push(...r2.response.items);
    }

    if (allConversations.length === 0 && errors.length) {
      return new Response(JSON.stringify({
        error: `VK: ${errors.join("; ")}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Detect channels — log everything for debugging
    const allTypes = allConversations.map((it: any) => ({
      peer_type: it?.conversation?.peer?.type,
      peer_id: it?.conversation?.peer?.id,
      is_channel: it?.conversation?.chat_settings?.is_channel,
      title: it?.conversation?.chat_settings?.title,
    }));
    console.log("list-vk-channels detected items:", JSON.stringify(allTypes));

    // VK API часто не выставляет peer.type === "channel" даже для настоящих каналов сообщества.
    // Возвращаем все диалоги с peer_id >= 2e9 (диапазон каналов/чатов сообщества) и помечаем явные каналы.
    const channels = allConversations
      .map((it: any) => it.conversation)
      .filter((c: any) => typeof c?.peer?.id === "number" && c.peer.id >= 2_000_000_000)
      .map((c: any) => {
        const peerType = c?.peer?.type;
        const membersCount = c?.chat_settings?.members_count ?? null;
        const isChannel = peerType === "channel" || c?.chat_settings?.is_channel === true;
        return {
          peer_id: c.peer.id,
          title: c.chat_settings?.title || `Диалог ${c.peer.id}`,
          members_count: membersCount,
          is_channel: isChannel,
          peer_type: peerType ?? null,
        };
      })
      .filter((c: any) => c.members_count === null || c.members_count > 1);

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
