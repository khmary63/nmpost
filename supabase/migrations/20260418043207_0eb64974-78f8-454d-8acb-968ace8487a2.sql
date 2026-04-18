CREATE OR REPLACE FUNCTION public.check_and_increment_usage(_user_id uuid, _resource text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan plan_tier;
  v_limits JSONB;
  v_limit INT;
  v_current INT;
  v_period DATE := date_trunc('month', now())::date;
  v_column TEXT;
BEGIN
  IF _resource NOT IN ('posts', 'ai_text', 'ai_image', 'content_plan') THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_resource');
  END IF;

  -- Админы не имеют ограничений: пропускаем проверку и инкремент
  IF public.has_role(_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('allowed', true, 'plan', 'admin', 'limit', -1, 'current', 0);
  END IF;

  v_plan := public.get_user_plan(_user_id);
  v_limits := public.get_plan_limits(v_plan);
  v_limit := (v_limits ->> _resource)::INT;

  INSERT INTO public.usage_counters (user_id, period_month)
  VALUES (_user_id, v_period)
  ON CONFLICT (user_id, period_month) DO NOTHING;

  v_column := CASE _resource
    WHEN 'posts' THEN 'posts_count'
    WHEN 'ai_text' THEN 'ai_text_count'
    WHEN 'ai_image' THEN 'ai_image_count'
    WHEN 'content_plan' THEN 'content_plan_count'
  END;

  EXECUTE format('SELECT %I FROM public.usage_counters WHERE user_id = $1 AND period_month = $2', v_column)
    INTO v_current USING _user_id, v_period;

  IF v_limit <> -1 AND v_current >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'limit_exceeded',
      'plan', v_plan, 'limit', v_limit, 'current', v_current);
  END IF;

  EXECUTE format('UPDATE public.usage_counters SET %I = %I + 1, updated_at = now() WHERE user_id = $1 AND period_month = $2', v_column, v_column)
    USING _user_id, v_period;

  RETURN jsonb_build_object('allowed', true, 'plan', v_plan, 'limit', v_limit, 'current', v_current + 1);
END;
$function$;