CREATE TABLE IF NOT EXISTS public.ai_model_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  model_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ai model settings"
  ON public.ai_model_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert ai model settings"
  ON public.ai_model_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update ai model settings"
  ON public.ai_model_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_model_settings_updated_at
  BEFORE UPDATE ON public.ai_model_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_model_settings (setting_key, model_id) VALUES
  ('text', 'google/gemini-3-flash-preview'),
  ('image_basic', 'google/gemini-3.1-flash-image-preview'),
  ('image_pro', 'google/gemini-3-pro-image-preview')
ON CONFLICT (setting_key) DO NOTHING;

-- Helper: безопасное чтение модели (через service role / SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_ai_model(_key text, _default text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT model_id FROM public.ai_model_settings WHERE setting_key = _key LIMIT 1),
    _default
  )
$$;