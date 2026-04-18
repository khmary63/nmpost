import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      while (!cancelled && attempts < 10) {
        attempts++;
        const { data } = await supabase.rpc("get_user_plan", { _user_id: user.id });
        if (data && data !== "free") {
          if (!cancelled) {
            setPlan(data as string);
            setSyncing(false);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setSyncing(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const planLabel = plan === "pro" ? "Профи" : plan === "basic" ? "Базовый" : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="flex justify-center">
          {syncing ? (
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="w-16 h-16 text-primary" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {syncing ? "Подтверждаем оплату..." : "Оплачено"}
          </h1>
          <p className="text-muted-foreground">
            {syncing
              ? "Это займёт несколько секунд. Не закрывайте страницу."
              : planLabel
                ? `Подписка «${planLabel}» успешно активирована.`
                : "Платёж получен. Подписка будет активирована в течение пары минут."}
          </p>
          {params.get("OrderId") && (
            <p className="text-xs text-muted-foreground pt-2">
              Заказ №{params.get("OrderId")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full" disabled={syncing}>
            <Link to="/dashboard">Перейти в кабинет</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/pricing">К тарифам</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
