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

    const { code } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: "code is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VK_CLIENT_SECRET = Deno.env.get("VK_CLIENT_SECRET");
    if (!VK_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "VK_CLIENT_SECRET не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CLIENT_ID = "54525610";
    const REDIRECT_URI = "https://oauth.vk.com/blank.html";

    const vkUrl = `https://oauth.vk.com/access_token?client_id=${CLIENT_ID}&client_secret=${VK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`;

    const vkResponse = await fetch(vkUrl);
    const vkData = await vkResponse.json();

    if (vkData.error) {
      console.error("VK token exchange error:", vkData);
      return new Response(JSON.stringify({ 
        error: `Ошибка VK: ${vkData.error_description || vkData.error}` 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = vkData.access_token;
    const userId = vkData.user_id;
    const expiresIn = vkData.expires_in;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "VK не вернул access_token" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save token using service role client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Store token in a user-specific record in channel_settings metadata
    // For now, we'll update the VK_USER_TOKEN secret via vault
    // Actually, we can't update vault secrets easily, so let's store in a table
    // We'll store in channel_settings as a special record
    const { error: upsertError } = await serviceClient
      .from("channel_settings")
      .upsert({
        user_id: user.id,
        channel: "vk_personal",
        channel_chat_id: accessToken,
        is_active: true,
      }, { onConflict: "user_id,channel" })
      .select();

    // Also try to update the edge function secret for backward compat
    // We store the token so the publish function can read it from channel_settings
    
    if (upsertError) {
      console.error("Failed to save token:", upsertError);
      return new Response(JSON.stringify({ error: "Не удалось сохранить токен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("VK token exchanged successfully:", { userId, expiresIn });

    return new Response(JSON.stringify({ 
      ok: true, 
      user_id: userId, 
      expires_in: expiresIn,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("exchange-vk-token error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
