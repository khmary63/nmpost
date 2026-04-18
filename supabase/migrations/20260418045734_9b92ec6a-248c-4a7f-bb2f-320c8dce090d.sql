-- Ensure gracheva.maria@gmail.com is the sole admin
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'gracheva.maria@gmail.com' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User gracheva.maria@gmail.com not found';
  END IF;

  -- Remove admin role from everyone else
  DELETE FROM public.user_roles WHERE role = 'admin' AND user_id <> v_admin_id;

  -- Ensure target user has admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Remove non-admin roles for this user (clean state)
  DELETE FROM public.user_roles WHERE user_id = v_admin_id AND role <> 'admin';
END $$;

-- Update handle_new_user so future signups never become admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, org_id)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001');

  -- Все новые пользователи получают роль agent. Админ только один (gracheva.maria@gmail.com)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');

  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;