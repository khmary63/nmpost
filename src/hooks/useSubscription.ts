import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanTier>("free");
  const [usage, setUsage] = useState<UsageCounts>({
    posts_count: 0, ai_text_count: 0, ai_image_count: 0, content_plan_count: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlan("free");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: planData }, { data: usageData }] = await Promise.all([
        supabase.rpc("get_user_plan", { _user_id: user.id }),
        supabase.rpc("get_current_usage", { _user_id: user.id }),
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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const limits = PLAN_LIMITS[plan];

  const remaining = (key: "posts" | "ai_text" | "ai_image" | "content_plan"): number => {
    const limit = limits[key];
    if (limit === -1) return Infinity;
    const used = key === "posts" ? usage.posts_count
      : key === "ai_text" ? usage.ai_text_count
      : key === "ai_image" ? usage.ai_image_count
      : usage.content_plan_count;
    return Math.max(0, limit - used);
  };

  const hasFeature = (key: FeatureKey): boolean => {
    if (key === "scheduled_posting" || key === "all_styles") return limits[key];
    return remaining(key) > 0;
  };

  return { plan, limits, usage, loading, refresh, remaining, hasFeature };
}
