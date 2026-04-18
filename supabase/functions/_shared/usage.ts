// Shared helper для проверки и инкремента лимитов тарифа.
// Используется в edge-функциях ai-content, generate-post, generate-image.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Resource = "posts" | "ai_text" | "ai_image" | "content_plan";

export interface UsageCheckResult {
  allowed: boolean;
  error?: string;
  plan?: string;
  limit?: number;
  current?: number;
}

/**
 * Атомарно проверяет и инкрементирует счётчик использования.
 * Возвращает { allowed: false, error: 'limit_exceeded' } при превышении.
 */
export async function checkAndIncrementUsage(
  authHeader: string,
  userId: string,
  resource: Resource,
): Promise<UsageCheckResult> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("check_and_increment_usage", {
    _user_id: userId,
    _resource: resource,
  });

  if (error) {
    console.error("usage check rpc error:", error);
    return { allowed: false, error: "usage_check_failed" };
  }

  return data as UsageCheckResult;
}

/**
 * Возвращает Response 402 при превышении лимита.
 */
export function limitExceededResponse(
  result: UsageCheckResult,
  resource: Resource,
  corsHeaders: Record<string, string>,
): Response {
  const labels: Record<Resource, string> = {
    posts: "постов",
    ai_text: "AI-генераций текста",
    ai_image: "AI-генераций изображений",
    content_plan: "контент-планов",
  };
  const label = labels[resource];
  const planLabel = result.plan === "free" ? "Бесплатный" : result.plan === "basic" ? "Базовый" : "Про";
  return new Response(
    JSON.stringify({
      error: `Достигнут лимит ${label} в этом месяце на тарифе «${planLabel}» (${result.current}/${result.limit}). Обновите тариф, чтобы продолжить.`,
      code: "limit_exceeded",
      plan: result.plan,
      limit: result.limit,
      current: result.current,
    }),
    {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
