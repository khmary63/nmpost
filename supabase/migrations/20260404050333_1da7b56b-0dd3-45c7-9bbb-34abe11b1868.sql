
CREATE TABLE public.channel_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL,
  channel_chat_id TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channel settings" ON public.channel_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own channel settings" ON public.channel_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channel settings" ON public.channel_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own channel settings" ON public.channel_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_channel_settings_updated_at BEFORE UPDATE ON public.channel_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
