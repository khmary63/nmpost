
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rebill_id text,
  ADD COLUMN IF NOT EXISTS customer_key text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Функция: отменить автопродление подписки (доступ остаётся до current_period_end)
CREATE OR REPLACE FUNCTION public.cancel_subscription_renewal(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.subscriptions
  SET auto_renew = false,
      cancelled_at = now(),
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- Функция: включить автопродление подписки
CREATE OR REPLACE FUNCTION public.enable_subscription_renewal(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.subscriptions
  SET auto_renew = true,
      cancelled_at = NULL,
      updated_at = now()
  WHERE user_id = _user_id
    AND plan <> 'free'::plan_tier
    AND is_active = true;
END;
$$;

-- Расширяем activate_subscription: принимаем флаг автопродления, RebillId, CustomerKey
CREATE OR REPLACE FUNCTION public.activate_subscription(
  _user_id uuid,
  _plan plan_tier,
  _months int DEFAULT 1,
  _auto_renew boolean DEFAULT NULL,
  _rebill_id text DEFAULT NULL,
  _customer_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _end timestamptz := now() + make_interval(months => COALESCE(_months, 1));
BEGIN
  INSERT INTO public.subscriptions (
    user_id, plan, is_active, current_period_start, current_period_end,
    auto_renew, rebill_id, customer_key, cancelled_at
  )
  VALUES (
    _user_id, _plan, true, _now, _end,
    COALESCE(_auto_renew, false),
    _rebill_id,
    _customer_key,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      is_active = true,
      current_period_start = _now,
      current_period_end = _end,
      auto_renew = COALESCE(_auto_renew, public.subscriptions.auto_renew),
      rebill_id = COALESCE(_rebill_id, public.subscriptions.rebill_id),
      customer_key = COALESCE(_customer_key, public.subscriptions.customer_key),
      cancelled_at = NULL,
      updated_at = _now;
END;
$$;
