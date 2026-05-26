
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referrer_id uuid,
  ADD COLUMN IF NOT EXISTS points_balance integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referrer_id_idx
  ON public.profiles (referrer_id) WHERE referrer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code()
    WHERE user_id = r.user_id;
  END LOOP;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS points_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS money_amount_kopecks integer;

CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  payment_id uuid NOT NULL UNIQUE,
  amount_kopecks integer NOT NULL,
  points_awarded integer NOT NULL,
  expires_at timestamptz NOT NULL,
  expired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referral events" ON public.referral_events;
CREATE POLICY "Users view own referral events"
  ON public.referral_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all referral events" ON public.referral_events;
CREATE POLICY "Admins view all referral events"
  ON public.referral_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS referral_events_user_idx ON public.referral_events(user_id);
CREATE INDEX IF NOT EXISTS referral_events_expires_idx ON public.referral_events(expires_at) WHERE expired = false;

CREATE TABLE IF NOT EXISTS public.points_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('referral','spend','expire','admin_adjust')),
  ref_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ledger" ON public.points_ledger;
CREATE POLICY "Users view own ledger"
  ON public.points_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all ledger" ON public.points_ledger;
CREATE POLICY "Admins view all ledger"
  ON public.points_ledger FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS points_ledger_user_idx ON public.points_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_referral_credit(_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pay record;
  v_referrer uuid;
  v_money int;
  v_points int;
  v_expires timestamptz;
  v_event_id uuid;
BEGIN
  SELECT id, user_id, amount_kopecks, money_amount_kopecks, points_used
  INTO v_pay
  FROM public.payments WHERE id = _payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_events WHERE payment_id = _payment_id) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'already_credited');
  END IF;

  v_money := COALESCE(v_pay.money_amount_kopecks, v_pay.amount_kopecks);
  IF v_money <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_money_payment');
  END IF;

  SELECT referrer_id INTO v_referrer FROM public.profiles WHERE user_id = v_pay.user_id;

  IF v_referrer IS NULL OR v_referrer = v_pay.user_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'no_referrer');
  END IF;

  v_points := floor(v_money * 0.20 / 100.0)::int;
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'zero_points');
  END IF;

  v_expires := now() + interval '12 months';

  INSERT INTO public.referral_events (user_id, referred_user_id, payment_id, amount_kopecks, points_awarded, expires_at)
  VALUES (v_referrer, v_pay.user_id, _payment_id, v_money, v_points, v_expires)
  RETURNING id INTO v_event_id;

  INSERT INTO public.points_ledger (user_id, delta, kind, ref_id, description)
  VALUES (v_referrer, v_points, 'referral', v_event_id, 'Реферальное начисление 20%');

  UPDATE public.profiles SET points_balance = points_balance + v_points
  WHERE user_id = v_referrer;

  RETURN jsonb_build_object('ok', true, 'points', v_points, 'referrer', v_referrer);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_points(_user_id uuid, _points integer, _payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance int;
BEGIN
  IF _points <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'spent', 0);
  END IF;

  SELECT points_balance INTO v_balance FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < _points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE public.profiles SET points_balance = points_balance - _points
  WHERE user_id = _user_id;

  INSERT INTO public.points_ledger (user_id, delta, kind, ref_id, description)
  VALUES (_user_id, -_points, 'spend', _payment_id, 'Оплата тарифа баллами');

  RETURN jsonb_build_object('ok', true, 'spent', _points);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_old_points()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int := 0;
  r record;
  v_user_balance int;
  v_to_burn int;
BEGIN
  FOR r IN
    SELECT id, user_id, points_awarded
    FROM public.referral_events
    WHERE expired = false AND expires_at <= now()
    FOR UPDATE
  LOOP
    SELECT points_balance INTO v_user_balance FROM public.profiles WHERE user_id = r.user_id FOR UPDATE;
    v_to_burn := LEAST(r.points_awarded, COALESCE(v_user_balance, 0));

    IF v_to_burn > 0 THEN
      UPDATE public.profiles SET points_balance = points_balance - v_to_burn
      WHERE user_id = r.user_id;
      INSERT INTO public.points_ledger (user_id, delta, kind, ref_id, description)
      VALUES (r.user_id, -v_to_burn, 'expire', r.id, 'Сгорание баллов (12 мес)');
      v_total := v_total + v_to_burn;
    END IF;

    UPDATE public.referral_events SET expired = true WHERE id = r.id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'burned', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_referral_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_balance int;
  v_total_earned int;
  v_total_referred int;
  v_paying_referred int;
  v_next_expiry timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM _user_id AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT referral_code, points_balance INTO v_code, v_balance
  FROM public.profiles WHERE user_id = _user_id;

  SELECT COALESCE(SUM(points_awarded), 0) INTO v_total_earned
  FROM public.referral_events WHERE user_id = _user_id;

  SELECT COUNT(*) INTO v_total_referred
  FROM public.profiles WHERE referrer_id = _user_id;

  SELECT COUNT(DISTINCT referred_user_id) INTO v_paying_referred
  FROM public.referral_events WHERE user_id = _user_id;

  SELECT MIN(expires_at) INTO v_next_expiry
  FROM public.referral_events
  WHERE user_id = _user_id AND expired = false AND expires_at > now();

  RETURN jsonb_build_object(
    'referral_code', v_code,
    'balance', COALESCE(v_balance, 0),
    'total_earned', v_total_earned,
    'total_referred', v_total_referred,
    'paying_referred', v_paying_referred,
    'next_expiry', v_next_expiry
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_any_roles boolean;
  _ref_code text;
  _referrer uuid;
  _input_code text;
BEGIN
  _input_code := lower(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF _input_code <> '' THEN
    SELECT user_id INTO _referrer FROM public.profiles WHERE referral_code = _input_code;
    IF _referrer = NEW.id THEN _referrer := NULL; END IF;
  END IF;

  _ref_code := public.generate_referral_code();

  INSERT INTO public.profiles (user_id, referral_code, referrer_id)
  VALUES (NEW.id, _ref_code, _referrer)
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code),
        referrer_id = COALESCE(public.profiles.referrer_id, EXCLUDED.referrer_id);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles) INTO _has_any_roles;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, CASE WHEN _has_any_roles THEN 'agent'::app_role ELSE 'admin'::app_role END);
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, is_active, auto_renew, current_period_start, current_period_end)
  VALUES (NEW.id, 'free', true, false, now(), NULL)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_current_user_initialized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _primary_role app_role;
  _has_any_roles boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO public.profiles (user_id, referral_code)
  VALUES (_uid, public.generate_referral_code())
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, public.generate_referral_code());

  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _uid) THEN
    INSERT INTO public.subscriptions (user_id, plan, is_active, auto_renew, current_period_start, current_period_end)
    VALUES (_uid, 'free', true, false, now(), NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles) INTO _has_any_roles;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, CASE WHEN _has_any_roles THEN 'agent'::app_role ELSE 'admin'::app_role END);
  END IF;

  SELECT role INTO _primary_role FROM public.user_roles
  WHERE user_id = _uid
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  RETURN jsonb_build_object('user_id', _uid, 'role', _primary_role);
END;
$$;
