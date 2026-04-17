import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TicketBody {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const validate = (b: any): b is TicketBody => {
  if (!b || typeof b !== "object") return false;
  const ok = (v: unknown, min: number, max: number) =>
    typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
  return (
    ok(b.name, 2, 100) &&
    ok(b.email, 5, 255) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) &&
    ok(b.subject, 2, 200) &&
    ok(b.message, 5, 4000)
  );
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    if (!validate(body)) {
      return new Response(
        JSON.stringify({ error: "Некорректные данные формы" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TG_CHAT = Deno.env.get("SUPPORT_TELEGRAM_CHAT_ID");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Try to associate with logged-in user
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
      userId = data.user?.id ?? null;
    }

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        name: body.name.trim(),
        email: body.email.trim(),
        subject: body.subject.trim(),
        message: body.message.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Notify Telegram (non-fatal)
    if (TG_TOKEN && TG_CHAT) {
      const text =
        `🆘 <b>Новое обращение в техподдержку</b>\n\n` +
        `<b>От:</b> ${escapeHtml(body.name)} (${escapeHtml(body.email)})\n` +
        `<b>Тема:</b> ${escapeHtml(body.subject)}\n\n` +
        `${escapeHtml(body.message)}\n\n` +
        `<i>ID: ${ticket.id}</i>`;
      try {
        const r = await fetch(
          `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TG_CHAT,
              text,
              parse_mode: "HTML",
            }),
          },
        );
        if (!r.ok) {
          console.error("Telegram notify failed:", await r.text());
        }
      } catch (e) {
        console.error("Telegram error:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, id: ticket.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-ticket error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
