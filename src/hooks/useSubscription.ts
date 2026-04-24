import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_LIMITS: PlanLimits = {
  posts: -1, ai_text: -1, ai_image: -1, content_plan: -1,
  scheduled_posting: true, all_styles: true, priority_support: true,
};

export type PlanTier = "free" | "basic" | "pro";

export interface PlanLimits {
  posts: number; // -1 = безлимит
  ai_text: number;
  ai_image: number;
  content_plan: number;
  scheduled_posting: boolean;
  all_styles: boolean;
  priority_support: boolean;
}

export interface UsageCounts {
  posts_count: number;
  ai_text_count: number;
  ai_image_count: number;
  content_plan_count: number;
}

export interface SubscriptionDetails {
  auto_renew: boolean;
  current_period_end: string | null;
  cancelled_at: string | null;
  has_rebill: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { posts: 5, ai_text: 0, ai_image: 0, content_plan: 0, scheduled_posting: false, all_styles: false, priority_support: false },
  basic: { posts: 10, ai_text: 10, ai_image: 10, content_plan: 0, scheduled_posting: true, all_styles: true, priority_support: false },
  pro: { posts: -1, ai_text: 30, ai_image: 30, content_plan: 3, scheduled_posting: true, all_styles: true, priority_support: true },
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Бесплатный",
  basic: "Базовый",
  pro: "Про",
};

export type FeatureKey = "posts" | "ai_text" | "ai_image" | "content_plan" | "scheduled_posting" | "all_styles";

export function useSubscription() {
  const { user, role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  const [plan, setPlan] = useState<PlanTier>("free");
  const [usage, setUsage] = useState<UsageCounts>({
    posts_count: 0, ai_text_count: 0, ai_image_count: 0, content_plan_count: 0,
  });
  const [details, setDetails] = useState<SubscriptionDetails>({
    auto_renew: false, current_period_end: null, cancelled_at: null, has_rebill: false,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setPlan("free");
      setUsage({ posts_count: 0, ai_text_count: 0, ai_image_count: 0, content_plan_count: 0 });
      setDetails({ auto_renew: false, current_period_end: null, cancelled_at: null, has_rebill: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: planData }, { data: usageData }, { data: subRow }] = await Promise.all([
        supabase.rpc("get_user_plan", { _user_id: user.id }),
        supabase.rpc("get_current_usage", { _user_id: user.id }),
        supabase
          .from("subscriptions")
          .select("auto_renew, current_period_end, cancelled_at, rebill_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (planData) setPlan(planData as PlanTier);
      if (usageData && usageData.length > 0) {
        setUsage({
          posts_count: usageData[0].posts_count ?? 0,
          ai_text_count: usageData[0].ai_text_count ?? 0,
          ai_image_count: usageData[0].ai_image_count ?? 0,
          content_plan_count: usageData[0].content_plan_count ?? 0,
        });
      }
      if (subRow) {
        setDetails({
          auto_renew: !!subRow.auto_renew,
          current_period_end: subRow.current_period_end,
          cancelled_at: subRow.cancelled_at,
          has_rebill: !!subRow.rebill_id,
        });
      } else {
        setDetails({ auto_renew: false, current_period_end: null, cancelled_at: null, has_rebill: false });
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading) {
      void refresh();
    }
  }, [authLoading, refresh]);

  const limits = isAdmin ? ADMIN_LIMITS : PLAN_LIMITS[plan];

  const remaining = (key: "posts" | "ai_text" | "ai_image" | "content_plan"): number => {
    if (isAdmin) return Infinity;
    const limit = limits[key];
    if (limit === -1) return Infinity;
    const used = key === "posts" ? usage.posts_count
      : key === "ai_text" ? usage.ai_text_count
      : key === "ai_image" ? usage.ai_image_count
      : usage.content_plan_count;
    return Math.max(0, limit - used);
  };

  const hasFeature = (key: FeatureKey): boolean => {
    if (isAdmin) return true;
    if (key === "scheduled_posting" || key === "all_styles") return limits[key];
    return remaining(key) > 0;
  };

  return { plan, limits, usage, loading, refresh, remaining, hasFeature, isAdmin, details };
}
