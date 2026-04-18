-- Таблица платежей T-Bank
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan plan_tier NOT NULL,
  amount_kopecks INTEGER NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  tbank_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  payment_url TEXT,
  raw_response JSONB,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX idx_payments_order ON public.payments(order_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Запись/изменение payments — только service role (edge functions). Нет policy для INSERT/UPDATE/DELETE для authenticated.

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC для активации подписки после успешного платежа (вызывается из webhook через service role)
CREATE OR REPLACE FUNCTION public.activate_subscription(_user_id UUID, _plan plan_tier, _months INT DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, current_period_start, current_period_end, is_active)
  VALUES (_user_id, _plan, now(), now() + (_months || ' months')::interval, true)
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    is_active = true,
    updated_at = now();
END;
$$;