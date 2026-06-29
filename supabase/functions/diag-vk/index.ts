import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeToken = (raw?: string | null) =>
  raw?.replace(/^access_token=/, "").split("&")[0].trim() || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const community = "vk1.a.ad6vzPLvV7KlezPNtySJM01huSmKLsRmLFUO7i62TEZZvUeqZbqISFrORPS6k1fER6fVXNrH1MsDVCq1-C7G3uSAmXgs8-VHxeln4yt3-3i_9cc1M5lt1TRTZ-bsNVvQECO1y6iUwVwojoPbEmrr2SHy5-thhWlu4KEsfX0vbdEKQJxPvFRQNE9XctztCIKO23Dxm7SU_5DZJAvGXDV8_Q";
  const groupId = 223557114;

  const out: Record<string, unknown> = {};

  // 1. groups.getById with community token (tells us which group the token belongs to)
  try {
    const u = new URL("https://api.vk.com/method/groups.getById");
    u.search = new URLSearchParams({ access_token: community, v: "5.199" }).toString();
    out.groupsGetById = await (await fetch(u.toString())).json();
  } catch (e) { out.groupsGetById = String(e); }


  out.tokenPrefix = community.slice(0, 8);
  out.tokenLen = community.length;

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
