import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Users, Coins, Gift, Clock } from "lucide-react";
import { toast } from "sonner";

type Stats = {
  referral_code: string | null;
  balance: number;
  total_earned: number;
  total_referred: number;
  paying_referred: number;
  next_expiry: string | null;
};

type LedgerRow = {
  id: string;
  delta: number;
  kind: string;
  description: string | null;
  created_at: string;
};

type ReferralRow = {
  id: string;
  referred_user_id: string;
  amount_kopecks: number;
  points_awarded: number;
  expires_at: string;
  expired: boolean;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  referral: "Реферал",
  spend: "Списание",
  expire: "Сгорание",
  admin_adjust: "Корректировка",
};

export default function Partner() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [events, setEvents] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refLink = stats?.referral_code
    ? `${window.location.origin}/signup?ref=${stats.referral_code}`
    : "";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: l }, { data: e }] = await Promise.all([
        supabase.rpc("get_referral_stats", { _user_id: user.id }),
        (supabase as any).from("points_ledger").select("*").order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("referral_events").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      setStats(s as unknown as Stats);
      setLedger((l ?? []) as LedgerRow[]);
      setEvents((e ?? []) as ReferralRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const copyLink = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Партнёрская программа</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Приглашайте пользователей и получайте 20% от их оплат в баллах. 1 балл = 1 ₽. Баллами можно оплачивать тариф.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ваша реферальная ссылка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !stats ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={refLink} className="flex-1 font-mono text-xs sm:text-sm" />
                <Button onClick={copyLink} className="w-full sm:w-auto">
                  <Copy className="mr-2 h-4 w-4" /> Скопировать
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Привязка происходит в момент регистрации нового пользователя по этой ссылке.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Coins className="h-4 w-4" />} label="Баланс баллов" value={stats?.balance ?? 0} loading={loading} />
          <StatCard icon={<Gift className="h-4 w-4" />} label="Всего заработано" value={stats?.total_earned ?? 0} loading={loading} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Приглашено" value={stats?.total_referred ?? 0} loading={loading} />
          <StatCard icon={<Users className="h-4 w-4" />} label="С оплатой" value={stats?.paying_referred ?? 0} loading={loading} />
        </div>

        {stats?.next_expiry && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Ближайшее сгорание баллов: {new Date(stats.next_expiry).toLocaleDateString("ru-RU")}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Начисления по рефералам</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет начислений. Поделитесь ссылкой с друзьями.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Дата</th>
                      <th className="py-2 pr-3">Оплата реферала</th>
                      <th className="py-2 pr-3">Начислено</th>
                      <th className="py-2 pr-3">Сгорает</th>
                      <th className="py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="py-2 pr-3">{new Date(e.created_at).toLocaleDateString("ru-RU")}</td>
                        <td className="py-2 pr-3">{(e.amount_kopecks / 100).toLocaleString("ru-RU")} ₽</td>
                        <td className="py-2 pr-3 font-semibold text-foreground">+{e.points_awarded}</td>
                        <td className="py-2 pr-3">{new Date(e.expires_at).toLocaleDateString("ru-RU")}</td>
                        <td className="py-2">
                          {e.expired
                            ? <Badge variant="outline">Сгорело</Badge>
                            : <Badge>Активно</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">История баллов</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">Движений пока нет.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Дата</th>
                      <th className="py-2 pr-3">Тип</th>
                      <th className="py-2 pr-3">Описание</th>
                      <th className="py-2 text-right">Изменение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-3">{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                        <td className="py-2 pr-3">{KIND_LABEL[r.kind] ?? r.kind}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.description}</td>
                        <td className={`py-2 text-right font-semibold ${r.delta >= 0 ? "text-primary" : "text-destructive"}`}>
                          {r.delta >= 0 ? "+" : ""}{r.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Баллы начисляются только с реальных денежных оплат рефералов и хранятся 12 месяцев с момента начисления.
        </p>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-2 font-display text-2xl font-bold text-foreground">
          {loading ? <Skeleton className="h-7 w-16" /> : value.toLocaleString("ru-RU")}
        </div>
      </CardContent>
    </Card>
  );
}
