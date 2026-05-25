ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS first_comment text NOT NULL DEFAULT '';
ALTER TABLE public.channel_settings ADD COLUMN IF NOT EXISTS tg_discussion_chat_id text NOT NULL DEFAULT '';