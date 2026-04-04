import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Send, Save, CalendarIcon, Type, Palette,
  MessageSquare, Loader2, Wand2, FileText, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const POST_STYLES = [
  { id: "minimal", label: "Минимал", description: "Чистый, лаконичный", icon: "◻️" },
  { id: "bold", label: "Яркий", description: "Эмодзи, призывы", icon: "🔥" },
  { id: "elegant", label: "Элегант", description: "Профессиональный", icon: "✨" },
  { id: "creative", label: "Креатив", description: "Неформальный, юмор", icon: "🎨" },
] as const;

const CHANNELS = [
  { id: "telegram", label: "Telegram", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { id: "vk", label: "ВКонтакте", color: "bg-sky-500/10 text-sky-600 border-sky-200" },
  { id: "ok", label: "Макс", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
] as const;

export function PostEditor() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [style, setStyle] = useState<string>("minimal");
  const [channels, setChannels] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const toggleChannel = (ch: string) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  const generateContent = async (type: "post" | "content-plan") => {
    if (!aiPrompt.trim()) {
      toast.error("Введите тему или описание для генерации");
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: { prompt: aiPrompt, style, type },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (type === "post") {
        setContent(data.content);
        toast.success("Пост сгенерирован!");
      } else {
        setContent(data.content);
        toast.success("Контент-план готов!");
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePost = async (status: "draft" | "published") => {
    if (!content.trim()) {
      toast.error("Напишите или сгенерируйте текст поста");
      return;
    }
    if (status === "published" && channels.length === 0) {
      toast.error("Выберите хотя бы один канал для публикации");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("posts").insert({
        user_id: user!.id,
        title,
        content,
        style: style as any,
        status: status as any,
        channels,
        published_at: status === "published" ? new Date().toISOString() : null,
      });
      if (error) throw error;
      toast.success(status === "published" ? "Пост опубликован!" : "Черновик сохранён");
      setTitle("");
      setContent("");
      setAiPrompt("");
      setChannels([]);
    } catch (e: any) {
      toast.error(e.message || "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main editor */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-5 w-5 text-primary" />
              Редактор поста
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Заголовок</Label>
              <Input
                id="title"
                placeholder="Заголовок поста (необязательно)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="content">Текст поста</Label>
              <Textarea
                id="content"
                placeholder="Напишите текст поста или сгенерируйте с помощью AI..."
                className="min-h-[200px] resize-y"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{content.length} символов</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Generation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-генерация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ai-prompt">Опишите тему поста</Label>
              <Textarea
                id="ai-prompt"
                placeholder="Например: пост о новом продукте для SMM-агентства, акцент на выгоде для клиентов..."
                className="min-h-[80px]"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generateContent("post")} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Сгенерировать пост
              </Button>
              <Button variant="outline" onClick={() => generateContent("content-plan")} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Контент-план
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Style picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-primary" />
              Стиль оформления
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {POST_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                    style === s.id ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Каналы публикации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <Badge
                  key={ch.id}
                  variant="outline"
                  className={cn(
                    "cursor-pointer px-3 py-1.5 text-sm transition-all",
                    channels.includes(ch.id) ? ch.color + " border-2" : "opacity-50 hover:opacity-80"
                  )}
                  onClick={() => toggleChannel(ch.id)}
                >
                  {ch.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {content && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Превью</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "rounded-lg border p-4 text-sm",
                style === "bold" && "bg-primary/5 font-semibold",
                style === "elegant" && "bg-accent/30 font-serif italic",
                style === "creative" && "bg-gradient-to-br from-primary/5 to-accent/10",
              )}>
                {title && <p className="mb-2 font-bold">{title}</p>}
                <p className="whitespace-pre-wrap">{content.slice(0, 300)}{content.length > 300 && "..."}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button onClick={() => savePost("published")} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Опубликовать
          </Button>
          <Button variant="outline" onClick={() => savePost("draft")} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4" />
            Сохранить черновик
          </Button>
        </div>
      </div>
    </div>
  );
}
