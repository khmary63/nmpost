// T-Bank: создание платежа (Init API). Поддерживает оплату баллами полностью/частично.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TBANK_API = "https://securepay.tinkoff.ru/v2/Init";

type PlanTier = "basic" | "pro";

const PLAN_PRICES_KOPECKS: Record<PlanTier, number> = {
  basic: 99000,
  pro: 199000,
};

const PLAN_LABELS: Record<PlanTier, string> = {
  basic: "Базовый",
  pro: "Профи",
};

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
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TBANK_TERMINAL_KEY = Deno.env.get("TBANK_TERMINAL_KEY");
    const TBANK_PASSWORD = Deno.env.get("TBANK_PASSWORD");
    if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
      return new Response(JSON.stringify({ error: "T-Bank credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as PlanTier;
    const autoRenew = body.auto_renew !== false;
    const billingPeriod = body.billing_period === "yearly" ? "yearly" : "monthly";
    const pointsToUse = Math.max(0, parseInt(body.points_to_use ?? "0", 10) || 0);

    if (plan !== "basic" && plan !== "pro") {
      return new Response(JSON.stringify({ error: "invalid_plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const monthlyAmount = PLAN_PRICES_KOPECKS[plan];
    const months = billingPeriod === "yearly" ? 12 : 1;
    const totalAmount = billingPeriod === "yearly"
      ? Math.round(monthlyAmount * 12 * 0.9)
      : monthlyAmount;
    const periodLabel = billingPeriod === "yearly" ? "12 месяцев (-10%)" : "1 месяц";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Баланс баллов
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("points_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const balance = profileRow?.points_balance ?? 0;

    // 1 балл = 1 ₽ = 100 коп. Ограничиваем баллы суммой и балансом.
    const totalRubles = Math.floor(totalAmount / 100);
    const pointsApplied = Math.min(pointsToUse, balance, totalRubles);
    const pointsKopecks = pointsApplied * 100;
    const moneyAmount = totalAmount - pointsKopecks;

    const orderId = `ord_${userId.slice(0, 8)}_${Date.now()}`;
    const customerKey = `user_${userId}`;

    // Сценарий: 100% баллами — TBank не дёргаем, активируем подписку сразу
    if (moneyAmount <= 0 && pointsApplied > 0) {
      const { data: payInsert, error: payErr } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          plan,
          amount_kopecks: totalAmount,
          money_amount_kopecks: 0,
          points_used: pointsApplied,
          order_id: orderId,
          status: "CONFIRMED",
        })
        .select("id")
        .single();
      if (payErr || !payInsert) {
        return new Response(JSON.stringify({ error: "db_error", message: payErr?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: spendRes, error: spendErr } = await supabaseAdmin.rpc("spend_points", {
        _user_id: userId,
        _points: pointsApplied,
        _payment_id: payInsert.id,
      });
      if (spendErr || !(spendRes as any)?.ok) {
        await supabaseAdmin.from("payments").update({ status: "FAILED" }).eq("id", payInsert.id);
        return new Response(JSON.stringify({ error: "spend_failed", details: spendRes ?? spendErr?.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseAdmin.rpc("activate_subscription", {
        _user_id: userId,
        _plan: plan,
        _months: months,
        _auto_renew: false,
        _rebill_id: null,
        _customer_key: null,
      });
      return new Response(
        JSON.stringify({ paid_with_points: true, success: true, order_id: orderId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Сценарий: часть/всё деньгами — идём в TBank
    const initParams: Record<string, string | number> = {
      TerminalKey: TBANK_TERMINAL_KEY,
      Amount: moneyAmount,
      OrderId: orderId,
      Description: `Подписка «${PLAN_LABELS[plan]}» — ${periodLabel}` +
        (pointsApplied > 0 ? ` (использовано ${pointsApplied} баллов)` : ""),
      NotificationURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/tbank-webhook`,
    };

    if (autoRenew) {
      initParams.Recurrent = "Y";
      initParams.CustomerKey = customerKey;
    }

    const tbankToken = await generateToken(initParams, TBANK_PASSWORD);

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
        PointsUsed: String(pointsApplied),
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
      amount_kopecks: totalAmount,
      money_amount_kopecks: moneyAmount,
      points_used: pointsApplied,
      order_id: orderId,
      tbank_payment_id: tbankJson.PaymentId ? String(tbankJson.PaymentId) : null,
      payment_url: tbankJson.PaymentURL ?? null,
      status: tbankJson.Status ?? "NEW",
      raw_response: tbankJson,
    });

    if (!tbankJson.Success) {
      console.error("T-Bank Init failed:", tbankJson);
      return new Response(JSON.stringify({
        error: "tbank_error",
        message: tbankJson.Message ?? "Ошибка инициализации платежа",
        details: tbankJson.Details ?? null,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      payment_url: tbankJson.PaymentURL,
      payment_id: tbankJson.PaymentId,
      order_id: orderId,
      points_applied: pointsApplied,
      money_amount_kopecks: moneyAmount,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("tbank-create-payment error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
