import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeToken = (raw?: string | null) =>
  raw?.replace(/^access_token=/, "").split("&")[0].trim() || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const community = normalizeToken(Deno.env.get("VK_COMMUNITY_TOKEN"));
  const groupId = 223557114;

  const out: Record<string, unknown> = {};

  // 1. groups.getById with community token (tells us which group the token belongs to)
  try {
    const u = new URL("https://api.vk.com/method/groups.getById");
    u.search = new URLSearchParams({ access_token: community, v: "5.199" }).toString();
    out.groupsGetById = await (await fetch(u.toString())).json();
  } catch (e) { out.groupsGetById = String(e); }

  // 2. dry wall.post test
  try {
    const params = new URLSearchParams({
      owner_id: String(-groupId),
      from_group: "1",
      message: "diag test " + Date.now(),
      access_token: community,
      v: "5.199",
    });
    const r = await fetch("https://api.vk.com/method/wall.post", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    out.wallPost = await r.json();
  } catch (e) { out.wallPost = String(e); }

  out.tokenPrefix = community.slice(0, 8);
  out.tokenLen = community.length;

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
