# Переключение приложения на прокси api.neyromarket.com

Прокси на VPS уже работает: `https://api.neyromarket.com` корректно проксирует запросы на бэкенд (проверка вернула `sb-project-ref: lyvpryyrztgjyrovdvqo` и ожидаемый `401 — нет apikey`). Осталось перенаправить само приложение на этот адрес.

## Почему нужен отдельный модуль

Файлы `src/integrations/supabase/client.ts` и `.env` — автогенерируемые, их править нельзя. Поэтому создаём собственный модуль клиента с адресом прокси и переключаем на него все импорты в коде. Это автоматически охватит всё: REST (база), Auth (вход/регистрация), Edge Functions (генерация, публикация, оплата) и Storage (картинки) — все они используют базовый URL клиента.

## Шаги

1. **Новый модуль клиента** `src/integrations/supabase/proxy-client.ts`:
   - `createClient` с URL `https://api.neyromarket.com` и тем же публичным anon-ключом (берётся из `VITE_SUPABASE_PUBLISHABLE_KEY`).
   - Те же настройки auth (`localStorage`, `persistSession`, `autoRefreshToken`), что и сейчас.
   - Экспортирует `supabase` — сигнатура идентична текущему модулю.

2. **Переключение импортов** в 12 файлах, которые сейчас импортируют `@/integrations/supabase/client`:
   `useSubscription.ts`, `AuthContext.tsx`, `PostEditor.tsx`, `ChannelSettings.tsx`, `Partner.tsx`, `Profile.tsx`, `Pricing.tsx`, `PaymentSuccess.tsx`, `AdminUsers.tsx`, `AdminAIModels.tsx`, `SupportWidget.tsx`, `PostsList.tsx` — заменить путь на новый модуль. (Сам `client.ts` не трогаем.)

3. **Картинки в Storage** — `getPublicUrl` в `PostEditor.tsx` строит URL от базового адреса клиента, поэтому новые ссылки автоматически пойдут через прокси. Старые ссылки на `*.supabase.co`, уже сохранённые в базе, продолжат работать напрямую (это нормально).

## Проверка после внедрения

- Открыть превью: вход/регистрация работают, лента постов грузится.
- В DevTools → Network убедиться, что запросы идут на `api.neyromarket.com`, а не на `*.supabase.co`.
- Проверить генерацию текста/картинки и публикацию (Edge Functions) — проходят через прокси.
- Загрузка новой картинки → публичная ссылка указывает на `api.neyromarket.com`.

## Откат

Если что-то не так — вернуть импорты на `@/integrations/supabase/client` (одна замена пути), приложение мгновенно работает напрямую с бэкендом.

## Замечание

Для домена приложения (`crosspost.neyromarket.com`) фронт-прокси на том же VPS — отдельная задача; этот план меняет только адрес API. Если нужно — добавим следующим шагом.
