---
name: Subscription Plans & Limits
description: Free/Basic/Pro tiers, monthly usage counters, RPC-based atomic limit enforcement, UI gating
type: feature
---
## Plans (см. PLAN_LIMITS в src/hooks/useSubscription.ts)
- **Free**: 5 постов/мес, 0 AI, только стиль "minimal", без отложенного постинга
- **Basic** (990₽): 10 постов, 10 AI-текст, 10 AI-картинок, все стили, отложенный постинг
- **Pro** (1990₽): безлимит постов (-1), 30 AI-текст, 30 AI-картинок, 3 контент-плана, приоритетная поддержка

## Архитектура
- Таблица `subscriptions` (user_id unique, plan, current_period_end) — админ ставит вручную
- Таблица `usage_counters` (user_id + period_month) — счётчики посты/AI-текст/AI-картинки/контент-планы
- Сброс: календарный месяц (1-е число), period_month = `date_trunc('month', now())`
- RPC `get_user_plan(_user_id)` → plan_tier (default free)
- RPC `get_plan_limits(_plan)` → JSONB лимитов
- RPC `get_current_usage(_user_id)` → счётчики за текущий месяц
- RPC `check_and_increment_usage(_user_id, _resource)` — атомарная проверка+инкремент, возвращает {allowed, error, plan, limit, current}
- Триггер `handle_new_user` создаёт Free подписку при регистрации

## Enforcement
- **Edge functions** `generate-post` и `generate-image` вызывают `checkAndIncrementUsage` через `_shared/usage.ts` ДО вызова LLM. Возвращают 402 при превышении.
- **PostEditor**: проверка `subscription.hasFeature(...)` перед AI-кнопками, перед публикацией, перед отложенным постингом. Креативные стили заблокированы для Free. После успеха вызывает `subscription.refresh()`.
- **При публикации нового поста** (не draft, не редактирование) — клиентский RPC `check_and_increment_usage('posts')`.

## UI
- `UpgradeModal` — открывается при превышении лимита/блоке функции
- Страница `/pricing` (src/pages/Pricing.tsx) — текущий тариф + использование + 3 карточки
- DashboardLayout — бейдж текущего тарифа в шапке
- Оплата ЮKassa — отдельная задача (пока админ ставит тариф вручную в БД)

## Ключевые файлы
- src/hooks/useSubscription.ts
- src/components/UpgradeModal.tsx
- src/pages/Pricing.tsx
- supabase/functions/_shared/usage.ts
