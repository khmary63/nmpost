
-- Enum для тарифов
CREATE TYPE public.plan_tier AS ENUM ('free', 'basic', 'pro');

-- Таблица подписок
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan plan_tier NOT NULL DEFAULT 'free',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated 
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Таблица счётчиков использования (помесячно)
CREATE TABLE public.usage_counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_month DATE NOT NULL, -- первый день месяца
  posts_count INT NOT NULL DEFAULT 0,
  ai_text_count INT NOT NULL DEFAULT 0,
  ai_image_count INT NOT NULL DEFAULT 0,
  content_plan_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_month)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage" ON public.usage_counters
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all usage" ON public.usage_counters
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Получить текущий тариф пользователя
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id UUID)
RETURNS plan_tier
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
     WHERE user_id = _user_id
       AND is_active = true
       AND (current_period_end IS NULL OR current_period_end > now())
     LIMIT 1),
    'free'::plan_tier
  )
$$;

-- Получить лимиты по тарифу
CREATE OR REPLACE FUNCTION public.get_plan_limits(_plan plan_tier)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN jsonb_build_object(
      'posts', 5,
      'ai_text', 0,
      'ai_image', 0,
      'content_plan', 0,
      'scheduled_posting', false,
      'all_styles', false,
      'priority_support', false
    )
    WHEN 'basic' THEN jsonb_build_object(
      'posts', 10,
      'ai_text', 10,
      'ai_image', 10,
      'content_plan', 0,
      'scheduled_posting', true,
      'all_styles', true,
      'priority_support', false
    )
    WHEN 'pro' THEN jsonb_build_object(
      'posts', -1,
      'ai_text', 30,
      'ai_image', 30,
      'content_plan', 3,
      'scheduled_posting', true,
      'all_styles', true,
      'priority_support', true
    )
  END
$$;

-- Получить использование за текущий месяц
CREATE OR REPLACE FUNCTION public.get_current_usage(_user_id UUID)
RETURNS TABLE (
  posts_count INT,
  ai_text_count INT,
  ai_image_count INT,
  content_plan_count INT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(posts_count, 0),
    COALESCE(ai_text_count, 0),
    COALESCE(ai_image_count, 0),
    COALESCE(content_plan_count, 0)
  FROM public.usage_counters
  WHERE user_id = _user_id
    AND period_month = date_trunc('month', now())::date
  UNION ALL
  SELECT 0, 0, 0, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.usage_counters
    WHERE user_id = _user_id
      AND period_month = date_trunc('month', now())::date
  )
  LIMIT 1
$$;

-- Атомарная проверка и инкремент использования
-- _resource: 'posts' | 'ai_text' | 'ai_image' | 'content_plan'
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  _user_id UUID,
  _resource TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plan_tier;
  v_limits JSONB;
  v_limit INT;
  v_current INT;
  v_period DATE := date_trunc('month', now())::date;
  v_column TEXT;
BEGIN
  -- Валидация
  IF _resource NOT IN ('posts', 'ai_text', 'ai_image', 'content_plan') THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_resource');
  END IF;

  v_plan := public.get_user_plan(_user_id);
  v_limits := public.get_plan_limits(v_plan);
  v_limit := (v_limits ->> _resource)::INT;

  -- Создать строку счётчиков если нет
  INSERT INTO public.usage_counters (user_id, period_month)
  VALUES (_user_id, v_period)
  ON CONFLICT (user_id, period_month) DO NOTHING;

  v_column := CASE _resource
    WHEN 'posts' THEN 'posts_count'
    WHEN 'ai_text' THEN 'ai_text_count'
    WHEN 'ai_image' THEN 'ai_image_count'
    WHEN 'content_plan' THEN 'content_plan_count'
  END;

  -- Текущее значение
  EXECUTE format('SELECT %I FROM public.usage_counters WHERE user_id = $1 AND period_month = $2', v_column)
    INTO v_current USING _user_id, v_period;

  -- Проверка лимита (-1 = безлимит)
  IF v_limit <> -1 AND v_current >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'limit_exceeded',
      'plan', v_plan,
      'limit', v_limit,
      'current', v_current
    );
  END IF;

  -- Инкремент
  EXECUTE format('UPDATE public.usage_counters SET %I = %I + 1, updated_at = now() WHERE user_id = $1 AND period_month = $2', v_column, v_column)
    USING _user_id, v_period;

  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_plan,
    'limit', v_limit,
    'current', v_current + 1
  );
END;
$$;

-- Обновить триггер handle_new_user, чтобы создавал Free подписку
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, org_id)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001');

  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  END IF;

  -- Создать Free подписку
  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Создать Free подписки для существующих пользователей
INSERT INTO public.subscriptions (user_id, plan)
SELECT user_id, 'free'::plan_tier FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
