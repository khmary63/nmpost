
-- Create storage bucket for generated post images
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload post images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- Allow public read access
CREATE POLICY "Public can read post images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'post-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own post images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'post-images');
