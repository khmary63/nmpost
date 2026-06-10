import { useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/proxy-client";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(100),
  email: z.string().trim().email("Некорректный email").max(255),
  subject: z.string().trim().min(2, "Укажите тему").max(200),
  message: z.string().trim().min(5, "Минимум 5 символов").max(4000),
});

export function SupportWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: user?.email ?? "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Проверьте поля",
        description: parsed.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.functions.invoke("support-ticket", {
      body: parsed.data,
    });
    setLoading(false);
    if (error) {
      toast({
        title: "Не удалось отправить",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Обращение отправлено",
      description: "Мы свяжемся с вами в ближайшее время.",
    });
    setForm({ name: "", email: user?.email ?? "", subject: "", message: "" });
    setOpen(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Открыть техподдержку"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px]">
          {/* Mobile overlay */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto flex h-full flex-col rounded-none border border-border bg-card shadow-2xl sm:h-auto sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  Техподдержка
                </h3>
                <p className="text-xs text-muted-foreground">
                  Опишите вопрос — ответим как можно скорее
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
              <div>
                <Label htmlFor="sw-name">Имя</Label>
                <Input
                  id="sw-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ваше имя"
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sw-email">Email</Label>
                <Input
                  id="sw-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  maxLength={255}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sw-subject">Тема</Label>
                <Input
                  id="sw-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Кратко о проблеме"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sw-message">Сообщение</Label>
                <Textarea
                  id="sw-message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Подробно опишите вопрос"
                  rows={4}
                  maxLength={4000}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
