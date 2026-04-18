// T-Bank: рекуррентное списание (автопродление подписки).
// Запускается по cron ежедневно. Для подписок с auto_renew=true и
// current_period_end <= now() + 1 day выполняет /Charge через Т-Банк
// и продлевает подписку ещё на 1 месяц.
// Документация: https://www.tbank.ru/kassa/dev/payments/#tag/Standartnyj-platyozh/operation/Charge

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TBANK_INIT = "https://securepay.tinkoff.ru/v2/Init";
const TBANK_CHARGE = "https://securepay.tinkoff.ru/v2/Charge";

const PLAN_PRICES_KOPECKS: Record<string, number> = {
  basic: 99000,
  pro: 199000,
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Базовый",
  pro: "Профи",
};

async function generateToken(
  params: Record<string, unknown>,
  password: string,
): Promise<string> {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue;
    filtered[k] = String(v);
  }
  filtered.Password = password;
  const sorted = Object.keys(filtered).sort();
  const concatenated = sorted.map((k) => filtered[k]).join("");
  const data = new TextEncoder().encode(concatenated);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TBANK_TERMINAL_KEY = Deno.env.get("TBANK_TERMINAL_KEY");
    const TBANK_PASSWORD = Deno.env.get("TBANK_PASSWORD");
    if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
      return new Response(JSON.stringify({ error: "T-Bank credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Найти подписки, которые истекают в ближайшие 24 часа и имеют автопродление
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, current_period_start, current_period_end, rebill_id, customer_key")
      .eq("auto_renew", true)
      .eq("is_active", true)
      .not("rebill_id", "is", null)
      .lte("current_period_end", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (subsErr) {
      console.error("Failed to fetch subscriptions for renewal:", subsErr);
      return new Response(JSON.stringify({ error: "db_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ user_id: string; status: string; message?: string }> = [];

    for (const sub of subs ?? []) {
      const plan = sub.plan as string;
      if (plan === "free" || !PLAN_PRICES_KOPECKS[plan]) {
        results.push({ user_id: sub.user_id, status: "skipped", message: "free plan" });
        continue;
      }

      // Определяем была ли подписка годовой по длине предыдущего периода (>180 дней => yearly)
      const startMs = new Date(sub.current_period_start).getTime();
      const endMs = new Date(sub.current_period_end as string).getTime();
      const periodDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
      const isYearly = periodDays > 180;
      const monthlyAmount = PLAN_PRICES_KOPECKS[plan];
      const amount = isYearly ? Math.round(monthlyAmount * 12 * 0.9) : monthlyAmount;
      const months = isYearly ? 12 : 1;
      const periodLabel = isYearly ? "12 месяцев (-10%)" : "1 месяц";
      const orderId = `rec_${String(sub.user_id).slice(0, 8)}_${Date.now()}`;

      try {
        // Шаг 1: Init с теми же CustomerKey + Recurrent="Y"
        const initParams: Record<string, string | number> = {
          TerminalKey: TBANK_TERMINAL_KEY,
          Amount: amount,
          OrderId: orderId,
          Description: `Автопродление «${PLAN_LABELS[plan]}» — ${periodLabel}`,
          CustomerKey: sub.customer_key ?? `user_${sub.user_id}`,
          Recurrent: "Y",
        };
        const initToken = await generateToken(initParams, TBANK_PASSWORD);
        const initResp = await fetch(TBANK_INIT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...initParams,
            Token: initToken,
            DATA: {
              UserId: sub.user_id,
              Plan: plan,
              AutoRenew: "1",
              BillingPeriod: isYearly ? "yearly" : "monthly",
              Months: String(months),
            },
          }),
        });
        const initJson = await initResp.json();

        if (!initJson.Success || !initJson.PaymentId) {
          console.error(`Init failed for user ${sub.user_id}:`, initJson);
          await supabaseAdmin.from("payments").insert({
            user_id: sub.user_id,
            plan,
            amount_kopecks: amount,
            order_id: orderId,
            tbank_payment_id: initJson.PaymentId ? String(initJson.PaymentId) : null,
            status: "INIT_FAILED",
            raw_response: initJson,
          });
          results.push({ user_id: sub.user_id, status: "init_failed", message: initJson.Message });
          continue;
        }

        // Шаг 2: Charge — безакцептное списание
        const chargeParams = {
          TerminalKey: TBANK_TERMINAL_KEY,
          PaymentId: String(initJson.PaymentId),
          RebillId: String(sub.rebill_id),
        };
        const chargeToken = await generateToken(chargeParams, TBANK_PASSWORD);
        const chargeResp = await fetch(TBANK_CHARGE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...chargeParams, Token: chargeToken }),
        });
        const chargeJson = await chargeResp.json();

        await supabaseAdmin.from("payments").insert({
          user_id: sub.user_id,
          plan,
          amount_kopecks: amount,
          order_id: orderId,
          tbank_payment_id: String(initJson.PaymentId),
          status: chargeJson.Status ?? "CHARGE_REQUESTED",
          raw_response: { init: initJson, charge: chargeJson },
        });

        // Webhook от Т-Банка прилетит на /tbank-webhook и активирует подписку.
        // Здесь только инициируем списание.
        results.push({
          user_id: sub.user_id,
          status: chargeJson.Success ? "charged" : "charge_failed",
          message: chargeJson.Message,
        });
      } catch (e) {
        console.error(`Recurrent charge failed for user ${sub.user_id}:`, e);
        results.push({
          user_id: sub.user_id,
          status: "error",
          message: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tbank-charge-recurrent error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
