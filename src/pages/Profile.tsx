import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Mail, Shield, CreditCard, RotateCw, XCircle, Mic } from "lucide-react";
import { useSubscription, PLAN_LABELS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/proxy-client";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const { plan, details, refresh, loading: subLoading } = useSubscription();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [toneSample, setToneSample] = useState("");
  const [toneLoading, setToneLoading] = useState(false);
  const [toneSaving, setToneSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setToneLoading(true);
    supabase
      .from("profiles")
      .select("tone_of_voice_sample")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setToneSample((data as any)?.tone_of_voice_sample || "");
        setToneLoading(false);
      });
  }, [user]);

  const handleSaveTone = async () => {
    if (!user) return;
    setToneSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ tone_of_voice_sample: toneSample.trim() || null } as any)
      .eq("user_id", user.id);
    setToneSaving(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Сохранено", description: "Образец вашего стиля письма обновлён" });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Ошибка", description: "Пароль должен содержать минимум 6 символов", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(newPassword);
    setLoading(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Готово", description: "Пароль успешно изменён" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleCancelRenewal = async () => {
    if (!user) return;
    setRenewLoading(true);
    const { error } = await supabase.rpc("cancel_subscription_renewal", { _user_id: user.id });
    setRenewLoading(false);
    setConfirmCancelOpen(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Автопродление отключено",
        description: "Подписка будет работать до конца оплаченного периода",
      });
      await refresh();
    }
  };

  const handleEnableRenewal = async () => {
    if (!user) return;
    setRenewLoading(true);
    const { error } = await supabase.rpc("enable_subscription_renewal", { _user_id: user.id });
    setRenewLoading(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Автопродление включено", description: "Подписка будет продлеваться автоматически" });
      await refresh();
    }
  };

  const provider = user?.app_metadata?.provider;
  const isOAuth = provider && provider !== "email";
  const isPaidPlan = plan === "basic" || plan === "pro";
  const periodEndDate = details.current_period_end
    ? new Date(details.current_period_end).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-foreground">Личный кабинет</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" /> Информация об аккаунте
            </CardTitle>
            <CardDescription>Данные вашей учётной записи</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">{user?.email}</div>
            </div>
            {isOAuth && (
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Shield className="h-3.5 w-3.5" /> Способ входа
                </Label>
                <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm capitalize">{provider}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" /> Подписка
            </CardTitle>
            <CardDescription>Текущий тариф и управление автопродлением</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Тариф</Label>
                <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-medium">
                  {PLAN_LABELS[plan]}
                </div>
              </div>
              {isPaidPlan && periodEndDate && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Действует до</Label>
                  <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">{periodEndDate}</div>
                </div>
              )}
            </div>

            {isPaidPlan && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Автопродление: {details.auto_renew ? (
                        <span className="text-primary">включено</span>
                      ) : (
                        <span className="text-muted-foreground">отключено</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {details.auto_renew
                        ? "Подписка будет автоматически продлеваться с привязанной карты. Списание произойдёт за 1 день до окончания текущего периода."
                        : details.cancelled_at
                          ? `Вы отписались ${new Date(details.cancelled_at).toLocaleDateString("ru-RU")}. Доступ к платным функциям сохраняется до окончания оплаченного периода.`
                          : "Автопродление выключено — следующее списание не произойдёт."}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  {details.auto_renew ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmCancelOpen(true)}
                      disabled={renewLoading || subLoading}
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Отписаться от автопродления
                    </Button>
                  ) : details.has_rebill ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleEnableRenewal}
                      disabled={renewLoading || subLoading}
                      className="w-full sm:w-auto"
                    >
                      <RotateCw className="mr-1.5 h-4 w-4" />
                      Включить автопродление
                    </Button>
                  ) : (
                    <Link to="/pricing" className="w-full sm:w-auto">
                      <Button variant="default" size="sm" className="w-full">
                        Продлить подписку
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isPaidPlan && (
              <Link to="/pricing">
                <Button variant="default" size="sm">
                  Оформить подписку
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mic className="h-5 w-5" /> Мой стиль письма (Tone of Voice)
            </CardTitle>
            <CardDescription>
              Вставьте пример своего поста, написанного лично вами. AI будет использовать
              его как ориентир для лексики, интонации и манеры подачи при генерации.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tone-sample">Пример вашего поста</Label>
              <Textarea
                id="tone-sample"
                placeholder="Например: «Сегодня хочу рассказать про одну штуку, которая меня недавно зацепила. Знаете, бывает такое — листаешь ленту, и вдруг…»"
                className="min-h-[180px] resize-y"
                maxLength={4000}
                value={toneSample}
                onChange={(e) => setToneSample(e.target.value)}
                disabled={toneLoading}
              />
              <p className="text-xs text-muted-foreground">
                {toneSample.length} / 4000 символов. Чем длиннее и характернее текст — тем точнее AI поймает ваш стиль.
                Применение включается переключателем в редакторе поста.
              </p>
            </div>
            <Button onClick={handleSaveTone} disabled={toneSaving || toneLoading} className="w-full sm:w-auto">
              {toneSaving ? "Сохранение…" : "Сохранить образец"}
            </Button>
          </CardContent>
        </Card>

        {!isOAuth && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5" /> Смена пароля
              </CardTitle>
              <CardDescription>Введите новый пароль для вашего аккаунта</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Новый пароль</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Сохранение…" : "Сменить пароль"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить автопродление?</AlertDialogTitle>
            <AlertDialogDescription>
              Доступ к тарифу «{PLAN_LABELS[plan]}» сохранится до{" "}
              {periodEndDate ? <strong>{periodEndDate}</strong> : "конца оплаченного периода"}.
              Дальнейшие списания производиться не будут. Вы сможете включить автопродление снова
              в любой момент.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renewLoading}>Не отписываться</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelRenewal} disabled={renewLoading}>
              {renewLoading ? "Отключение…" : "Отписаться"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
