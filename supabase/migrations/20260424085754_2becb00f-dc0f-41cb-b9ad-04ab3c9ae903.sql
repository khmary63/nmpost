CREATE OR REPLACE FUNCTION public.ensure_current_user_initialized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _primary_role app_role;
  _has_any_roles boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _uid
  ) THEN
    INSERT INTO public.profiles (user_id)
    VALUES (_uid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = _uid
  ) THEN
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      is_active,
      auto_renew,
      current_period_start,
      current_period_end
    )
    VALUES (
      _uid,
      'free',
      true,
      false,
      now(),
      NULL
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
    ) INTO _has_any_roles;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      _uid,
      CASE WHEN _has_any_roles THEN 'agent'::app_role ELSE 'admin'::app_role END
    );
  END IF;

  SELECT role
  INTO _primary_role
  FROM public.user_roles
  WHERE user_id = _uid
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1;

  RETURN jsonb_build_object(
    'user_id', _uid,
    'role', _primary_role,
    'has_profile', EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid),
    'has_subscription', EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_current_user_initialized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_initialized() TO authenticated;