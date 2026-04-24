CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_any_roles boolean;
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
    ) INTO _has_any_roles;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      CASE WHEN _has_any_roles THEN 'agent'::app_role ELSE 'admin'::app_role END
    );
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    plan,
    is_active,
    auto_renew,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'free',
    true,
    false,
    now(),
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();