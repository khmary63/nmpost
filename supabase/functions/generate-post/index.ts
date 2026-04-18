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

    const { prompt, style, type, originalText, postsCount, periodDays } = await req.json();

    // Проверка лимита по тарифу
    const resource = type === "content-plan" ? "content_plan" : "ai_text";
    const usage = await checkAndIncrementUsage(authHeader, user.id, resource);
    if (!usage.allowed) {
      return limitExceededResponse(usage, resource, corsHeaders);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const styleDescriptions: Record<string, string> = {
      minimal: "Лаконичный, чистый стиль. Короткие предложения, без лишних украшений.",
      bold: "Яркий, привлекающий внимание стиль. Используй эмодзи, восклицательные знаки, призывы к действию.",
      elegant: "Элегантный, профессиональный тон. Изысканная лексика, сдержанность.",
      creative: "Креативный, неформальный стиль. Юмор, метафоры, нестандартные обороты.",
    };

    const decorateInstructions: Record<string, string> = {
      minimal: "Минимум декора. Можно добавить 1-2 нейтральных эмодзи (▪️ • →) в начале ключевых строк. Заголовок (первая строка) — жирным через **текст**. Без разделителей.",
      bold: "Активно расставь яркие тематические эмодзи (🔥 ✨ 🚀 💥 ⚡ 👉 ✅) в начале абзацев и около ключевых фраз. Заголовок — жирным **текст**. Ключевые слова/призывы — жирным. Между смысловыми блоками вставь разделитель ━━━━━━━━━━━━.",
      elegant: "Сдержанный декор. Утончённые эмодзи (✦ ✧ ◆ ❖ — изредка) в начале абзацев. Заголовок — жирным **текст**. Ключевые фразы — курсивом *текст*. Между блоками — тонкий разделитель ─────────────.",
      creative: "Креативные тематические эмодзи (🎨 ✨ 🌟 💫 🎯 🌈) в неожиданных местах. Заголовок жирным **текст**, важные фразы курсивом *текст*. Между блоками — игривый разделитель ✦ ✦ ✦ или 〜〜〜.",
    };

    const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    const dateContext = `Сегодняшняя дата: ${today}. Используй актуальный контекст ${new Date().getFullYear()} года, не ссылайся на устаревшие данные.`;

    let systemPrompt: string;
    let userMessage: string;

    if (type === "content-plan") {
      systemPrompt = `Ты — эксперт по контент-маркетингу и SMM. ${dateContext}
Создай контент-план на неделю (7 постов) на основе темы пользователя.
Для каждого поста укажи: день, тему, краткое описание и рекомендуемое время публикации.
Пиши на русском языке. Формат — структурированный текст.`;
      userMessage = prompt || "Напиши интересный пост на свободную тему";
    } else if (type === "decorate") {
      systemPrompt = `Ты — оформитель текста для соцсетей (Telegram, ВК, MAX).

КРИТИЧЕСКИ ВАЖНО:
- НЕ МЕНЯЙ слова, смысл, порядок предложений и пунктуацию текста.
- НЕ ДОБАВЛЯЙ новых предложений и не убирай существующих.
- НЕ ПЕРЕФРАЗИРУЙ ничего.
- Твоя задача — ТОЛЬКО добавить визуальный декор: эмодзи, Markdown-форматирование (**жирный**, *курсив*) и разделители между абзацами.

Стиль оформления: ${decorateInstructions[style] || decorateInstructions.minimal}

Верни ТОЛЬКО оформленный текст, без пояснений и без обёрток вроде тройных бэктиков.`;
      userMessage = originalText || prompt || "";
    } else {
      systemPrompt = `Ты — профессиональный SMM-копирайтер. ${dateContext}
Напиши пост для социальных сетей на русском языке.
Стиль: ${styleDescriptions[style] || styleDescriptions.minimal}
Пост должен быть готов к публикации: с хештегами, призывом к действию если уместно.
Возвращай ТОЛЬКО текст поста, без пояснений.`;
      userMessage = prompt || "Напиши интересный пост на свободную тему";
    }

    const { data: textModel } = await supabase.rpc("get_ai_model", { _key: "text", _default: "google/gemini-3-flash-preview" });
    console.log(`generate-post using model: ${textModel}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: textModel || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились AI-кредиты. Пополните баланс в настройках." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI-сервиса" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
