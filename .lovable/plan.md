# Партнёрская программа

## Логика
- У каждого пользователя свой `referral_code` (короткий слаг, генерируется при регистрации).
- Реферальная ссылка: `https://crosspost.neyromarket.com/signup?ref=CODE`.
- Привязка только в момент signup: если `?ref=CODE` есть в URL — записываем `referrer_id` в `profiles`. Без параметра связь не создаётся и задним числом не добавляется.
- За каждую успешную оплату реферала пригласивший получает **20% в баллах** (1 балл = 1 ₽). Начисление со **всех** оплат бессрочно (включая продления и апгрейды).
- Срок жизни баллов — **12 месяцев** с даты начисления. Сгоревшие баллы списываются по cron.
- При оплате тарифа пользователь может покрыть стоимость баллами **полностью или частично**, остаток — деньгами через TBank.
- Если оплата 100% баллами — деньги не списываются, подписка активируется сразу. Реферал-начислений с такой оплаты НЕ происходит (начисляем только с реальных денежных поступлений, чтобы исключить циклы).

## Схема БД

Новые поля и таблицы (миграция):

- `profiles`: `referral_code TEXT UNIQUE`, `referrer_id UUID`, `points_balance INT DEFAULT 0` (денормализованный кеш для UI).
- `referral_events` — журнал начислений:
  - `id, user_id` (получатель баллов), `referred_user_id`, `payment_id`, `amount_kopecks` (оплата реферала), `points_awarded`, `expires_at`, `expired BOOLEAN`, `created_at`.
- `points_ledger` — единый журнал движения баллов (приход/расход/сгорание):
  - `id, user_id, delta INT` (+/-), `kind TEXT` (`referral`, `spend`, `expire`, `admin_adjust`), `ref_id UUID`, `description, created_at`.
  - Баланс = сумма всех `delta` (или брать кеш из profiles).
- `payments`: добавить `points_used INT DEFAULT 0`, `money_amount_kopecks INT` (что реально оплачено деньгами).

RPC:
- `apply_referral_credit(_payment_id)` — security definer, вызывается из TBank webhook после `CONFIRMED`. Идемпотентно по `payment_id`. Начисляет 20% инвайтеру, создаёт `referral_events` + `points_ledger`, обновляет `points_balance`.
- `spend_points(_user_id, _points, _payment_id)` — security definer. Проверяет баланс, списывает, пишет в ledger.
- `expire_old_points()` — cron-функция, списывает баллы с `expires_at < now()`.
- `get_referral_stats(_user_id)` — для кабинета: количество приглашённых, активных (с оплатой), всего заработано, баланс, ближайшее сгорание.

## Изменения flow оплаты

`tbank-create-payment` (edge function):
- Принимает `points_to_use`. Валидирует баланс. Считает `money_amount = plan_price - points_to_use`.
- Если `money_amount = 0` — сразу зовёт `activate_subscription` + `spend_points`, не идёт в TBank.
- Иначе создаёт платёж в TBank на `money_amount`, сохраняет `points_used` в `payments` (резерв пока не списываем).

`tbank-webhook`:
- При `CONFIRMED` — списывает зарезервированные баллы (`spend_points`), активирует подписку, вызывает `apply_referral_credit`.
- При `REJECTED/CANCELED` — резерв не трогаем (его и не было).

## UI

Новая страница `/partner` (партнёрский кабинет, ссылка в `DashboardLayout`):
- Карточка с реферальной ссылкой + кнопка «Скопировать».
- Метрики: баланс баллов, всего заработано, приглашено пользователей, из них с оплатой.
- Таблица приглашённых: имя/email (маскированный), дата регистрации, статус (оплатил/нет), сумма принесённых баллов.
- История начислений и списаний (из `points_ledger`).
- Подсказка про срок жизни 12 мес и ближайшие сгорания.

`Signup.tsx`:
- Читает `?ref=` из URL, сохраняет в state, передаёт в `signUp` через `options.data.referral_code`.
- Триггер `handle_new_user` находит инвайтера по коду и проставляет `referrer_id`. Также генерирует свой `referral_code` (например, `nanoid(8)`).

`Pricing.tsx` / страница оплаты:
- Поле «Использовать баллы»: слайдер 0..min(balance, plan_price). Показ итога «К оплате деньгами: X ₽».
- Кнопка «Оплатить баллами полностью» когда балансa достаточно.

`DashboardLayout`:
- Бейдж с балансом баллов рядом с тарифом + ссылка на `/partner`.

## Cron / обслуживание
- Расширить существующий cron (или добавить новый) на ежедневный вызов `expire_old_points()`.

## Безопасность
- RLS: `referral_events`, `points_ledger` — пользователь видит только свои строки; админ — все.
- Все мутации баллов идут только через security definer RPC; прямого UPDATE с клиента нет.
- `referral_code` уникален, генерация на сервере; самореферал запрещён (проверка `referrer_id != user_id`).
- Идемпотентность начислений: уникальный индекс `(payment_id)` в `referral_events`.

## Шаги внедрения
1. Миграция: новые колонки, таблицы, RPC, RLS, индексы, генерация `referral_code` для существующих пользователей.
2. Обновить `handle_new_user` (referral_code + referrer_id из metadata).
3. Edge: `tbank-create-payment` + `tbank-webhook` — поддержка баллов и начисления.
4. UI: `/partner`, апдейт `Signup`, `Pricing`, `DashboardLayout`.
5. Cron на сгорание баллов.
6. Обновить memory (`features/subscription-plans`, новый `features/referrals`).
