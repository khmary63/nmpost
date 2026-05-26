// T-Bank: вебхук уведомлений о статусе платежа
// Документация: https://www.tbank.ru/kassa/dev/payments/#section/Notifikacii

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
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
    const TBANK_PASSWORD = Deno.env.get("TBANK_PASSWORD");
    if (!TBANK_PASSWORD) {
      return new Response("Misconfigured", { status: 500 });
    }

    const payload = await req.json();
    console.log("T-Bank webhook received:", JSON.stringify(payload));

    // Проверка подписи Token
    const incomingToken: string | undefined = payload.Token;
    const toSign: Record<string, unknown> = { ...payload };
    delete toSign.Token;
    const expectedToken = await generateToken(toSign, TBANK_PASSWORD);

    if (!incomingToken || incomingToken.toLowerCase() !== expectedToken.toLowerCase()) {
      console.error("T-Bank webhook: invalid token signature");
      return new Response("Invalid signature", { status: 403 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const orderId = payload.OrderId as string | undefined;
    let status = (payload.Status as string | undefined) ?? "UNKNOWN";
    const tbankPaymentId = payload.PaymentId ? String(payload.PaymentId) : null;

    if (!orderId) {
      return new Response("OK", { status: 200 });
    }

    const storedWebhookPayload: Record<string, unknown> = payload;

    const { data: existingPayment, error: existingPaymentErr } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, plan, status, points_used")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPaymentErr) {
      console.error("Failed to load payment before update:", existingPaymentErr);
    }

    const ignoreOutOfOrderAuthorized =
      existingPayment?.status === "CONFIRMED" && status === "AUTHORIZED";
    const wasAlreadyConfirmed = existingPayment?.status === "CONFIRMED";

    if (ignoreOutOfOrderAuthorized) {
      console.log(`Ignoring late AUTHORIZED for already confirmed order ${orderId}`);
    }

    const paymentRow = ignoreOutOfOrderAuthorized
      ? existingPayment
      : (await supabaseAdmin
          .from("payments")
          .update({
            status,
            tbank_payment_id: tbankPaymentId,
            raw_webhook: storedWebhookPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .select("id, user_id, plan, points_used")
          .maybeSingle()).data;

    if (!ignoreOutOfOrderAuthorized && !paymentRow) {
      console.error("Failed to update payment: row not found", { orderId, status });
    }

    if (status === "CONFIRMED" && !wasAlreadyConfirmed && paymentRow?.user_id && paymentRow?.plan) {
      const rebillId = payload.RebillId ? String(payload.RebillId) : null;
      const dataField = (payload.DATA ?? {}) as Record<string, string>;
      const autoRenewFlag = dataField.AutoRenew === "1" || !!rebillId;
      const monthsParsed = parseInt(dataField.Months ?? "1", 10);
      const months = Number.isFinite(monthsParsed) && monthsParsed > 0 ? monthsParsed : 1;
      const customerKey = `user_${paymentRow.user_id}`;
      const pointsToSpend = (paymentRow as any).points_used ?? 0;

      if (pointsToSpend > 0) {
        const { data: spendRes, error: spendErr } = await supabaseAdmin.rpc("spend_points", {
          _user_id: paymentRow.user_id,
          _points: pointsToSpend,
          _payment_id: (paymentRow as any).id,
        });
        if (spendErr || !(spendRes as any)?.ok) {
          console.error("Failed to spend reserved points:", spendErr ?? spendRes);
        }
      }

      const { error: actErr } = await supabaseAdmin.rpc("activate_subscription", {
        _user_id: paymentRow.user_id,
        _plan: paymentRow.plan,
        _months: months,
        _auto_renew: autoRenewFlag,
        _rebill_id: rebillId,
        _customer_key: rebillId ? customerKey : null,
      });
      if (actErr) {
        console.error("Failed to activate subscription:", actErr);
      } else {
        console.log(`Subscription activated for user ${paymentRow.user_id}, plan ${paymentRow.plan}`);
      }

      const { error: refErr } = await supabaseAdmin.rpc("apply_referral_credit", {
        _payment_id: (paymentRow as any).id,
      });
      if (refErr) console.error("apply_referral_credit error:", refErr);
    }

    // Т-Банк ожидает ровно "OK" в ответе
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("tbank-webhook error:", e);
    return new Response("ERROR", { status: 500 });
  }
});
