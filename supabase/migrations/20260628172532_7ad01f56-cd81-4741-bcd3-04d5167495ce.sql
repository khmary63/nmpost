INSERT INTO public.subscriptions (user_id, plan, is_active, auto_renew, current_period_start, current_period_end)
VALUES ('94875e40-948e-493d-a7c5-848dbcae0dfa', 'pro', true, false, now(), NULL)
ON CONFLICT (user_id) DO UPDATE
SET plan = 'pro'::plan_tier,
    is_active = true,
    current_period_end = NULL,
    cancelled_at = NULL,
    updated_at = now();