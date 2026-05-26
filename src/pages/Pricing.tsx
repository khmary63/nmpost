import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, ArrowLeft, Loader2, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, PLAN_LABELS, type PlanTier } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DeveloperPromo } from "@/components/DeveloperPromo";
import { SEO } from "@/components/SEO";

const plans: Array<{
  id: PlanTier;
  price: string;
  period: string;
  features: string[];
  popular: boolean;
}> = [
  {
    id: "free",
    price: "0",
    period: "навсегда",
    features: [
      "5 постов в месяц",
      "Базовые шаблоны стиля",
      "Кросспостинг (чаты, каналы, сообщества): Tg, VK, Max",
    ],
    popular: false,
  },
  {
    id: "basic",
    price: "990",
    period: "/ мес",
    features: [
      "10 постов в месяц",
      "AI-генерация текста — 10 запросов",
      "Генерация изображений — 10 запросов",
      "Базовые шаблоны стиля",
      "Кросспостинг (чаты, каналы, сообщества): Tg, VK, Max",
      "Отложенный постинг",
    ],
    popular: true,
  },
  {
    id: "pro",
    price: "1 990",
    period: "/ мес",
    features: [
      "Постов в месяц — без ограничений",
      "AI-генерация текста — 30 запросов",
      "Генерация изображений — 30 запросов",
      "Базовые шаблоны стиля",
      "Кросспостинг (чаты, каналы, сообщества): Tg, VK, Max",
      "Отложенный постинг",
      "AI-генерация контент-плана — 3 запроса",
      "Приоритетная поддержка",
    ],
    popular: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlan, usage, limits } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [yearly, setYearly] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("points_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      setPointsBalance((data as any)?.points_balance ?? 0);
    })();
  }, [user]);

  const planPriceRub = (planId: PlanTier): number => {
    if (planId === "free") return 0;
    const monthly = planId === "basic" ? 990 : 1990;
    return yearly ? Math.round(monthly * 12 * 0.9) : monthly;
  };

  const handleSelectPlan = async (planId: PlanTier) => {
    if (!user) {
      navigate("/signup");
      return;
    }
    if (planId === "free") {
      navigate("/dashboard");
      return;
    }
    setLoadingPlan(planId);
    try {
      const price = planPriceRub(planId);
      const points = Math.min(pointsToUse, pointsBalance, price);
      const { data, error } = await supabase.functions.invoke("tbank-create-payment", {
        body: {
          plan: planId,
          auto_renew: autoRenew,
          billing_period: yearly ? "yearly" : "monthly",
          points_to_use: points,
        },
      });
      if (error) throw error;
      if ((data as any)?.paid_with_points) {
        toast({ title: "Оплачено баллами", description: "Подписка активирована" });
        navigate("/payment/success");
        return;
      }
      if (data?.payment_url) {
        window.location.href = data.payment_url as string;
        return;
      }
      throw new Error(data?.message || "Не удалось получить ссылку на оплату");
    } catch (e: any) {
      toast({
        title: "Ошибка оплаты",
        description: e?.message || "Попробуйте ещё раз позже",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> Назад
        </Button>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Тарифные планы
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Выберите план, который подходит именно вам.
          </p>
        </div>

        {user && (
          <div className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">Ваш текущий тариф</p>
            <p className="mt-1 font-display text-xl font-bold text-foreground">
              {PLAN_LABELS[currentPlan]}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <div>
                <p className="text-foreground font-semibold">{usage.posts_count}{limits.posts === -1 ? "" : `/${limits.posts}`}</p>
                <p>Постов</p>
              </div>
              <div>
                <p className="text-foreground font-semibold">{usage.ai_text_count}/{limits.ai_text}</p>
                <p>AI-текст</p>
              </div>
              <div>
                <p className="text-foreground font-semibold">{usage.ai_image_count}/{limits.ai_image}</p>
                <p>AI-картинки</p>
              </div>
              <div>
                <p className="text-foreground font-semibold">{usage.content_plan_count}/{limits.content_plan}</p>
                <p>Контент-планы</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = user && plan.id === currentPlan;
            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  plan.popular ? "border-primary shadow-lg shadow-primary/10 sm:scale-105" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Популярный
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="font-display text-xl font-bold text-foreground">{PLAN_LABELS[plan.id]}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    {(() => {
                      const monthly = parseInt(plan.price.replace(/\s/g, ""), 10);
                      if (!yearly || plan.id === "free" || isNaN(monthly)) {
                        return (
                          <>
                            <span className="font-display text-4xl font-extrabold text-foreground">{plan.price} ₽</span>
                            <span className="text-sm text-muted-foreground">{plan.period}</span>
                          </>
                        );
                      }
                      const yearlyTotal = Math.round(monthly * 12 * 0.9);
                      const formatted = yearlyTotal.toLocaleString("ru-RU");
                      return (
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="font-display text-4xl font-extrabold text-foreground">{formatted} ₽</span>
                            <span className="text-sm text-muted-foreground">/ год</span>
                          </div>
                          <span className="mt-1 text-xs text-primary font-medium">Скидка 10% при оплате за год</span>
                        </div>
                      );
                    })()}
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={!!isCurrent || loadingPlan === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Переход к оплате…</>
                    ) : isCurrent ? (
                      "Текущий тариф"
                    ) : plan.id === "free" ? (
                      "Начать бесплатно"
                    ) : (
                      "Оплатить картой"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mx-auto mt-8 max-w-md space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="yearly"
              checked={yearly}
              onCheckedChange={(v) => setYearly(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="yearly" className="text-sm font-medium cursor-pointer">
                Годовая подписка — скидка 10%
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Оплата сразу за 12 месяцев со скидкой 10% от месячной стоимости.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t border-border pt-3">
            <Checkbox
              id="auto-renew"
              checked={autoRenew}
              onCheckedChange={(v) => setAutoRenew(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="auto-renew" className="text-sm font-medium cursor-pointer">
                Автопродление подписки
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Подписка будет автоматически продлеваться {yearly ? "каждый год" : "каждый месяц"} с привязанной карты.
                Отписаться от автопродления можно в любой момент в личном кабинете.
              </p>
            </div>
          </div>
        </div>

        {user && pointsBalance > 0 && (
          <div className="mx-auto mt-4 max-w-md space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Coins className="h-4 w-4 text-primary" />
              Оплата баллами
            </div>
            <p className="text-xs text-muted-foreground">
              Доступно: <span className="font-semibold text-foreground">{pointsBalance.toLocaleString("ru-RU")}</span> баллов (1 балл = 1 ₽).
              Применяются к стоимости выбранного тарифа.
            </p>
            <Slider
              value={[pointsToUse]}
              min={0}
              max={pointsBalance}
              step={1}
              onValueChange={(v) => setPointsToUse(v[0] ?? 0)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Использовать: <span className="font-semibold text-foreground">{pointsToUse}</span> баллов</span>
              <Button variant="ghost" size="sm" onClick={() => setPointsToUse(pointsBalance)}>
                Максимум
              </Button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Оплата картой через Т-Банк. Чек по 54-ФЗ выставляется отдельно.
        </p>

        <DeveloperPromo />
      </div>
    </div>
  );
}
