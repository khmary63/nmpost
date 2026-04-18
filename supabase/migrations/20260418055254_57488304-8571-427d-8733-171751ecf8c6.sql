-- Drop legacy tables
DROP TABLE IF EXISTS public.proposal_events CASCADE;
DROP TABLE IF EXISTS public.proposal_versions CASCADE;
DROP TABLE IF EXISTS public.line_items CASCADE;
DROP TABLE IF EXISTS public.proposals CASCADE;
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- Drop policies that depend on profiles.org_id BEFORE dropping the column
DROP POLICY IF EXISTS "Admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all org roles" ON public.user_roles;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS org_id CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department_id CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- audit_logs + role-change trigger
DROP TRIGGER IF EXISTS trg_log_role_changes ON public.user_roles;
DROP FUNCTION IF EXISTS public.log_role_changes() CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Functions no longer referenced
DROP FUNCTION IF EXISTS public.verify_share_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.hash_share_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_id(uuid) CASCADE;

-- Recreate handle_new_user without org/department
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  INSERT INTO public.subscriptions (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop unused enums
DROP TYPE IF EXISTS public.proposal_status CASCADE;
DROP TYPE IF EXISTS public.template_category CASCADE;

-- Recreate cleaned-up RLS policies
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));