// T-Bank: создание платежа (Init API)
// https://www.tbank.ru/kassa/dev/payments/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TBANK_API = "https://securepay.tinkoff.ru/v2/Init";

type PlanTier = "basic" | "pro";

const PLAN_PRICES_KOPECKS: Record<PlanTier, number> = {
  basic: 99000, // 990 ₽
  pro: 199000, // 1990 ₽
};

const PLAN_LABELS: Record<PlanTier, string> = {
  basic: "Базовый",
  pro: "Профи",
};

// Подпись Token: сортируем по ключам, конкатенируем values + Password, SHA-256
async function generateToken(
  params: Record<string, string | number | boolean>,
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
      return new Response(
        JSON.stringify({ error: "T-Bank credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as PlanTier;
    const autoRenew = body.auto_renew !== false; // по умолчанию true
    const billingPeriod = body.billing_period === "yearly" ? "yearly" : "monthly";
    if (plan !== "basic" && plan !== "pro") {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthlyAmount = PLAN_PRICES_KOPECKS[plan];
    const months = billingPeriod === "yearly" ? 12 : 1;
    // Годовая: 12 месяцев со скидкой 10%
    const amount = billingPeriod === "yearly"
      ? Math.round(monthlyAmount * 12 * 0.9)
      : monthlyAmount;
    const periodLabel = billingPeriod === "yearly" ? "12 месяцев (-10%)" : "1 месяц";
    const orderId = `ord_${userId.slice(0, 8)}_${Date.now()}`;
    const customerKey = `user_${userId}`; // для рекуррентных платежей

    // Сохраняем платёж в БД (через service role, чтобы пройти RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const origin = req.headers.get("origin") || "https://nmpost.lovable.app";

    const initParams: Record<string, string | number> = {
      TerminalKey: TBANK_TERMINAL_KEY,
      Amount: amount,
      OrderId: orderId,
      Description: `Подписка «${PLAN_LABELS[plan]}» — ${periodLabel}`,
      SuccessURL: `${origin}/dashboard?payment=success`,
      FailURL: `${origin}/pricing?payment=fail`,
      NotificationURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/tbank-webhook`,
    };

    // Если включено автопродление — передаём Recurrent + CustomerKey
    if (autoRenew) {
      initParams.Recurrent = "Y";
      initParams.CustomerKey = customerKey;
    }

    const tbankToken = await generateToken(initParams, TBANK_PASSWORD);

    // НПД (самозанятые/ИП на НПД): онлайн-касса по 54-ФЗ не требуется,
    // чеки формируются вручную в приложении «Мой налог». Receipt не передаём.
    const initBody = {
      ...initParams,
      Token: tbankToken,
      DATA: {
        UserId: userId,
        Plan: plan,
        Email: userEmail,
        AutoRenew: autoRenew ? "1" : "0",
        BillingPeriod: billingPeriod,
        Months: String(months),
      },
    };

    const tbankResp = await fetch(TBANK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initBody),
    });
    const tbankJson = await tbankResp.json();

    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      plan,
      amount_kopecks: amount,
      order_id: orderId,
      tbank_payment_id: tbankJson.PaymentId ? String(tbankJson.PaymentId) : null,
      payment_url: tbankJson.PaymentURL ?? null,
      status: tbankJson.Status ?? "NEW",
      raw_response: tbankJson,
    });

    if (!tbankJson.Success) {
      console.error("T-Bank Init failed:", tbankJson);
      return new Response(
        JSON.stringify({
          error: "tbank_error",
          message: tbankJson.Message ?? "Ошибка инициализации платежа",
          details: tbankJson.Details ?? null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        payment_url: tbankJson.PaymentURL,
        payment_id: tbankJson.PaymentId,
        order_id: orderId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tbank-create-payment error:", e);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
