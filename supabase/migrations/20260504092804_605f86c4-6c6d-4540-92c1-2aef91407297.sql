ALTER TABLE public.channel_settings
  ADD COLUMN IF NOT EXISTS vk_channel_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vk_duplicate_to_channel BOOLEAN NOT NULL DEFAULT false;