ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];
-- Backfill image_urls from legacy single image_url for existing posts
UPDATE public.posts SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls,1) IS NULL);