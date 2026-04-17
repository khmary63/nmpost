ALTER TABLE public.channel_settings
  ADD COLUMN IF NOT EXISTS manager_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS personal_url text NOT NULL DEFAULT '';

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS include_footer boolean NOT NULL DEFAULT true;