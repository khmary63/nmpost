-- 1. Запретить вызов activate_subscription всем, кроме service_role.
-- Функция вызывается только из tbank-webhook через сервисный ключ.
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid, plan_tier, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid, plan_tier, integer, boolean, text, text) FROM PUBLIC, anon, authenticated;

-- 2. Storage: UPDATE/DELETE политики для post-images (owner-only по первой папке = user_id)
DROP POLICY IF EXISTS "Users can update own post images" ON storage.objects;
CREATE POLICY "Users can update own post images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own post images" ON storage.objects;
CREATE POLICY "Users can delete own post images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. support_tickets: запретить подделку user_id при создании
DROP POLICY IF EXISTS "Anyone can create support tickets" ON public.support_tickets;
CREATE POLICY "Anyone can create support tickets"
  ON public.support_tickets
  FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());