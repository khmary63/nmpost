import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAndIncrementUsage, limitExceededResponse } from "../_shared/usage.ts";

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

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Проверка лимита по тарифу
    const usage = await checkAndIncrementUsage(authHeader, user.id, "ai_image");
    if (!usage.allowed) {
      return limitExceededResponse(usage, "ai_image", corsHeaders);
    }

    // Определяем тариф пользователя для выбора модели
    const { data: planData } = await supabase.rpc("get_user_plan", { _user_id: user.id });
    const { data: isAdminData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isPro = planData === "pro" || isAdminData === true;
    const settingKey = isPro ? "image_pro" : "image_basic";
    const defaultModel = isPro ? "google/gemini-3-pro-image-preview" : "google/gemini-3.1-flash-image-preview";
    const { data: configuredModel } = await supabase.rpc("get_ai_model", { _key: settingKey, _default: defaultModel });
    const primaryModel = configuredModel || defaultModel;
    const fallbackModels = [
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-2.5-flash-image",
    ].filter((m) => m !== primaryModel);
    console.log(`Image gen: plan=${planData}, admin=${isAdminData}, model=${primaryModel}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const wrappedPrompt = `Generate a single high-quality illustrative image based on the following description. Do NOT reply with text, lists, or suggestions — output ONLY an image.\n\nDescription: ${prompt}`;
    const callModel = async (model: string) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: wrappedPrompt }],
          modalities: ["image", "text"],
        }),
      });
      const text = await r.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* keep raw */ }
      return { status: r.status, ok: r.ok, text, json };
    };

    let result = await callModel(primaryModel);
    console.log("AI image attempt 1:", result.status, result.text.slice(0, 400));

    if (!result.ok) {
      if (result.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов. Попробуйте через минуту." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "AI-кредиты исчерпаны." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", result.status, result.text.slice(0, 500));
      return new Response(JSON.stringify({ error: `Ошибка сервиса генерации изображений (${result.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let images = result.json?.choices?.[0]?.message?.images;
    let attempt = 1;
    for (const fb of fallbackModels) {
      if (images && images.length > 0) break;
      attempt += 1;
      console.warn(`No image in attempt ${attempt - 1}, retrying with ${fb}`);
      result = await callModel(fb);
      console.log(`AI image attempt ${attempt}:`, result.status, result.text.slice(0, 400));
      images = result.json?.choices?.[0]?.message?.images;
    }

    if (!images || images.length === 0) {
      const finishReason = result.json?.choices?.[0]?.finish_reason;
      const refusal = result.json?.choices?.[0]?.message?.refusal || result.json?.choices?.[0]?.message?.content;
      console.error("No image generated. finish_reason:", finishReason, "msg:", refusal);
      return new Response(JSON.stringify({
        error: refusal
          ? `Изображение не сгенерировано: ${String(refusal).slice(0, 200)}`
          : "Изображение не было сгенерировано. Попробуйте изменить описание (без имён людей, брендов и чувствительного контента).",
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = result.json;

    const base64Url = images[0].image_url.url as string;
    const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `${user.id}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, bytes, { contentType: "image/png" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Ошибка загрузки изображения" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(fileName);

    return new Response(JSON.stringify({ image_url: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
