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

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const callModel = async (model: string) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      const text = await r.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* keep raw */ }
      return { status: r.status, ok: r.ok, text, json };
    };

    let result = await callModel("google/gemini-2.5-flash-image");
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
    if (!images || images.length === 0) {
      console.warn("No image in attempt 1, retrying with gemini-3.1-flash-image-preview");
      result = await callModel("google/gemini-3.1-flash-image-preview");
      console.log("AI image attempt 2:", result.status, result.text.slice(0, 400));
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
