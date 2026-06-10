import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/proxy-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, Save, RefreshCw, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";

type SettingKey = "text" | "image_basic" | "image_pro";

const TEXT_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview) — рекомендуется", tag: "Новинка" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview) — максимум качества", tag: "Премиум" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — глубокое рассуждение" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash — баланс" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite — самый дешёвый" },
  { id: "openai/gpt-5", label: "GPT-5 — топ от OpenAI" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5.2", label: "GPT-5.2 — последний релиз OpenAI" },
];

const IMAGE_MODELS = [
  { id: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro — максимум качества", tag: "Премиум" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2 — быстро и качественно", tag: "Рекомендуется" },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana — базовая модель" },
];

const SETTINGS: { key: SettingKey; title: string; description: string; icon: React.ElementType; options: typeof TEXT_MODELS }[] = [
  {
    key: "text",
    title: "Генерация текста",
    description: "Используется для постов, контент-плана и AI-помощника",
    icon: Type,
    options: TEXT_MODELS,
  },
  {
    key: "image_basic",
    title: "Генерация изображений (Free / Basic)",
    description: "Применяется ко всем пользователям, кроме тарифа Pro",
    icon: ImageIcon,
    options: IMAGE_MODELS,
  },
  {
    key: "image_pro",
    title: "Генерация изображений (Pro / Admin)",
    description: "Используется для тарифа Pro и администраторов",
    icon: ImageIcon,
    options: IMAGE_MODELS,
  },
];

export default function AdminAIModels() {
  const { role, loading: authLoading, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !roleLoading && role !== "admin") {
      toast.error("Доступ только для администраторов");
      navigate("/dashboard");
    }
  }, [role, authLoading, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("ai_model_settings").select("setting_key, model_id");
    setLoading(false);
    if (error) {
      toast.error("Не удалось загрузить настройки");
      return;
    }
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.setting_key] = r.model_id; });
    setValues(map);
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  const save = async (key: SettingKey) => {
    const model_id = values[key];
    if (!model_id) return;
    setSaving((s) => ({ ...s, [key]: true }));
    const { error } = await supabase
      .from("ai_model_settings")
      .upsert({ setting_key: key, model_id }, { onConflict: "setting_key" });
    setSaving((s) => ({ ...s, [key]: false }));
    if (error) {
      toast.error("Не удалось сохранить");
      return;
    }
    toast.success("Модель обновлена");
  };

  if (authLoading || roleLoading || role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Модели нейросетей
            </h1>
            <p className="text-sm text-muted-foreground">
              Выберите активные модели для генерации. Изменения применяются сразу для всех пользователей.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Обновить
          </Button>
        </div>

        {SETTINGS.map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <s.icon className="h-4 w-4 text-primary" /> {s.title}
              </CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Активная модель</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={values[s.key] || ""}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Выберите модель" />
                  </SelectTrigger>
                  <SelectContent>
                    {s.options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        <div className="flex items-center gap-2">
                          <span>{opt.label}</span>
                          {opt.tag && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{opt.tag}</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => save(s.key)} disabled={saving[s.key] || !values[s.key]} className="gap-2">
                  <Save className="h-4 w-4" /> {saving[s.key] ? "Сохранение…" : "Сохранить"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono break-all">
                ID: {values[s.key] || "—"}
              </p>
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">Совет:</strong> когда Lovable AI добавит новые модели (например, Gemini 4),
              они появятся в выпадающем списке после обновления приложения. Просто выберите новую модель и нажмите
              «Сохранить» — переписывать код не нужно.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
