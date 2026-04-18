import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List all auth users (paginate)
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      allUsers.push(...data.users);
      if (data.users.length < 1000) break;
      page++;
    }

    const userIds = allUsers.map((u) => u.id);
    const [{ data: profiles }, { data: subs }, { data: usage }] = await Promise.all([
      admin.from("profiles").select("user_id, full_name").in("user_id", userIds),
      admin.from("subscriptions").select("user_id, plan, is_active, current_period_end").in("user_id", userIds),
      admin.from("usage_counters").select("user_id, posts_count, ai_text_count, ai_image_count, content_plan_count, period_month").in("user_id", userIds),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const subMap = new Map((subs || []).map((s: any) => [s.user_id, s]));
    const currentMonth = new Date();
    currentMonth.setUTCDate(1);
    currentMonth.setUTCHours(0, 0, 0, 0);
    const periodKey = currentMonth.toISOString().slice(0, 10);
    const usageMap = new Map(
      (usage || []).filter((u: any) => u.period_month === periodKey).map((u: any) => [u.user_id, u])
    );

    const result = allUsers.map((u) => {
      const p: any = profileMap.get(u.id) || {};
      const s: any = subMap.get(u.id) || {};
      const usg: any = usageMap.get(u.id) || {};
      return {
        id: u.id,
        email: u.email,
        full_name: p.full_name || u.user_metadata?.full_name || u.user_metadata?.name || "",
        phone: u.phone || u.user_metadata?.phone || "",
        provider: u.app_metadata?.provider || "email",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        plan: s.plan || "free",
        plan_active: s.is_active ?? true,
        period_end: s.current_period_end,
        posts_count: usg.posts_count || 0,
        ai_text_count: usg.ai_text_count || 0,
        ai_image_count: usg.ai_image_count || 0,
        content_plan_count: usg.content_plan_count || 0,
      };
    });

    return new Response(JSON.stringify({ users: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-list-users error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
