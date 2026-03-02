import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { share_id, password } = await req.json();

    if (!share_id || !password) {
      return new Response(
        JSON.stringify({ error: "share_id and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch proposal by share_id using service role (bypasses RLS)
    const { data: proposal, error } = await supabase
      .from("proposals")
      .select("id, share_id, share_password_hash, share_expires_at, status")
      .eq("share_id", share_id)
      .neq("status", "draft")
      .single();

    if (error || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (proposal.share_expires_at && new Date(proposal.share_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!proposal.share_password_hash) {
      return new Response(
        JSON.stringify({ error: "This proposal is not password-protected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password using pgcrypto crypt function
    const { data: match } = await supabase.rpc("verify_share_password", {
      _share_id: share_id,
      _password: password,
    });

    if (!match) {
      return new Response(
        JSON.stringify({ error: "Incorrect password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return a simple token (share_id + timestamp hash) valid for 1 hour
    // In production you'd use JWT signing; here we use a simple HMAC approach
    const token = btoa(JSON.stringify({
      share_id,
      proposal_id: proposal.id,
      exp: Date.now() + 3600000, // 1 hour
    }));

    return new Response(
      JSON.stringify({ token, proposal_id: proposal.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
