# Вариант А: прокси перед фронтом и API (Россия)

Цель: ускорить приложение для пользователей из РФ, не ломая текущий рабочий процесс Lovable (Publish + встроенный автодеплой). Весь трафик к бэкенду (`lyvpryyrztgjyrovdvqo.supabase.co`) пойдёт через российский прокси-домен.

---

## Часть 1. Инфраструктура — ваша сторона (без неё код менять рано)

### 1.1. Поднять прокси-домен для API
Субдомен **`api.neyromarket.com`** → reverse-proxy на `https://lyvpryyrztgjyrovdvqo.supabase.co`.

Прокси ОБЯЗАН прозрачно пробрасывать все пути и заголовки:
- `/rest/v1/*` — база данных
- `/auth/v1/*` — вход/регистрация (email/пароль)
- `/functions/v1/*` — edge-функции (публикация, AI, вебхуки)
- `/storage/v1/*` — картинки (логотипы, картинки постов)
- Заголовки: `apikey`, `Authorization`, `Content-Type`, `x-client-info`, и CORS-заголовки в ответах.
- SSL на стороне прокси (Let's Encrypt / сертификат CDN).
- Желательно `proxy_ssl_server_name on` и `Host` = `lyvpryyrztgjyrovdvqo.supabase.co`.

Пример Nginx (для VPS-варианта):
```nginx
server {
    server_name api.neyromarket.com;
    location / {
        proxy_pass https://lyvpryyrztgjyrovdvqo.supabase.co;
        proxy_set_header Host lyvpryyrztgjyrovdvqo.supabase.co;
        proxy_ssl_server_name on;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header apikey $http_apikey;
        proxy_set_header X-Client-Info $http_x_client_info;
        proxy_buffering off;          # важно для realtime/SSE
    }
}
```
(Если выбираете CDN — Gcore/Yandex/VK — настраиваете origin = supabase.co, передачу всех заголовков, и кэш только для `/storage/*`.)

### 1.2. Прокси/CDN для самого фронта
Origin = `crosspost.neyromarket.com` (или `nmpost.lovable.app`), SSL на прокси, кэш статики (JS/CSS/img).
В Lovable при подключении домена включить **Proxy mode** (Advanced → "Domain uses Cloudflare or a similar proxy") — это даёт CNAME-верификацию, совместимую с вашим прокси.

### 1.3. DNS (ваша сторона)
- `api.neyromarket.com` → на API-прокси.
- `crosspost.neyromarket.com` → на фронт-прокси/CDN.

---

## Часть 2. Правки в коде — моя сторона (делаю, когда `api.neyromarket.com` поднят и отвечает)

Файл `client.ts` редактировать нельзя, поэтому:

1. **Новый модуль клиента** (например `src/integrations/supabase/client.ts` нельзя — создам `src/lib/api-client.ts`), который создаёт Supabase-клиент с базовым URL = прокси:
   ```ts
   const API_BASE = "https://api.neyromarket.com"; // публичный домен, не секрет
   export const supabase = createClient<Database>(API_BASE, PUBLISHABLE_KEY, { auth: {...} });
   ```
   Базовый URL прокси автоматически распространится на `/rest`, `/auth`, `/functions/v1` и `/storage` — отдельной настройки не требуют.

2. **Переключить импорты** в коде приложения с `@/integrations/supabase/client` на новый модуль (через глобальную замену). Edge-функции и серверный код НЕ трогаю — они работают внутри Lovable Cloud и обращаются к базе напрямую.

3. **Картинки из storage**: проверить, как формируются URL логотипов/картинок постов. Если в БД хранятся абсолютные `…supabase.co/storage/...`, добавлю функцию-хелпер, переписывающую хост на прокси при отображении (миграцию данных не делаю).

4. **OAuth (вход через Google)**: вход идёт через Lovable-модуль (`lovable.auth`) и работает на кастомных доменах. Проверю, что вход не сломался; при необходимости добавлю редирект-домены.

---

## Часть 3. Проверка (совместно)

После правок и публикации проверяем из РФ:
- Скорость загрузки (должно стать в разы быстрее 16–17 сек).
- Консоль без ошибок (CORS, 401/403).
- Вход через Google и email/пароль.
- Загрузка постов и картинок.
- Отложенная публикация (edge-функции через прокси).

Если что-то рвётся — почти всегда это заголовки/CORS на прокси, чиню точечно.

---

## Что мне нужно от вас сейчас
1. Выберите инфраструктуру для API-прокси: **CDN** (Gcore/Yandex/VK) или **VPS+Nginx**.
2. Подтвердите имя субдомена **`api.neyromarket.com`** (или предложите своё).
3. Сообщите, когда `api.neyromarket.com` поднят и отвечает (открывается `https://api.neyromarket.com/rest/v1/` без сетевой ошибки) — после этого я вношу правки в код.

> Важно: пока прокси не поднят, код менять нельзя — иначе приложение начнёт стучаться на несуществующий домен. Поэтому сначала Часть 1 (вы), потом Часть 2 (я).