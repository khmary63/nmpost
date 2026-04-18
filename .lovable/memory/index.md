# Memory: index.md
Updated: now

# Project Memory

## Core
UI strictly in Russian. Mobile-first (sm/md/lg), vertical flex on mobile, w-full buttons, 44x44px touch targets.
Supabase RLS with `WITH CHECK` for updates. Edge functions JWT protected.
NO VK personal pages (error 15) and NO Odnoklassniki.
Published posts are read-only; status updates only on API success.
Free=5 постов/0 AI/только minimal. Basic=10/10/10/все стили/отложенный. Pro=∞/30/30/контент-план/приоритет. Сброс 1-го числа.

## Memories
- [Project Overview](mem://project/overview) — High-level goals, SaaS for automated AI-driven cross-posting
- [Authentication](mem://features/auth) — Google OAuth, email/password, mandatory name/phone for AmoCRM
- [Content Editor](mem://features/content-editor) — Post scheduling, Gemini image generation, publish status flow
- [CRM & Leads](mem://features/crm) — AmoCRM one-way sync, Excel export, iframe callback widget
- [Social Channels](mem://integrations/social-channels) — API rules for Telegram, VK Communities, and MAX
- [Edge Functions](mem://architecture/edge-functions) — JWT-protected backend logic for AI, publishing, webhooks
- [Security & RLS](mem://architecture/security) — Row Level Security policies, data integrity, user_id isolation
- [YooKassa Payments](mem://integrations/payments-yookassa) — Free/Basic/Pro plans, webhook endpoint for payment statuses
- [Subscription Plans](mem://features/subscription-plans) — Plan tiers, usage counters, limit enforcement (DB+UI)
