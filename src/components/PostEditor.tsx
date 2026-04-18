import { useState, useEffect } from "react";
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
  MessageSquare, Loader2, Wand2, FileText, Clock, ImageIcon, X, Paperclip, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditingPost } from "@/pages/Dashboard";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";

const POST_STYLES = [
  { id: "minimal", label: "Минимал", description: "Чистый, лаконичный", icon: "◻️" },
  { id: "bold", label: "Яркий", description: "Эмодзи, призывы", icon: "🔥" },
  { id: "elegant", label: "Элегант", description: "Профессиональный", icon: "✨" },
  { id: "creative", label: "Креатив", description: "Неформальный, юмор", icon: "🎨" },
] as const;

const CHANNELS = [
  { id: "telegram", label: "Telegram", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { id: "vk", label: "ВК группа", color: "bg-sky-500/10 text-sky-600 border-sky-200" },
  { id: "max", label: "MAX", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
] as const;

interface PostEditorProps {
  editingPost?: EditingPost | null;
  onDone?: () => void;
}

export function PostEditor({ editingPost, onDone }: PostEditorProps) {
  const { user } = useAuth();
  const subscription = useSubscription();
  const [postId, setPostId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [style, setStyle] = useState<string>("minimal");
  const [channels, setChannels] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [publishResult, setPublishResult] = useState<{ errors: string[]; successes: string[] } | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; reason?: string }>({
    open: false, feature: "",
  });

  const showUpgrade = (feature: string, reason?: string) =>
    setUpgradeModal({ open: true, feature, reason });

  // Load editing post into form
  useEffect(() => {
    if (editingPost) {
      setPostId(editingPost.id);
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setStyle(editingPost.style);
      setChannels(editingPost.channels);
      setImageUrl(editingPost.image_url || null);
      setIncludeFooter(editingPost.include_footer ?? true);
      if (editingPost.scheduled_at) {
        setIsScheduled(true);
        const d = new Date(editingPost.scheduled_at);
        setScheduledDate(d);
        setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      } else {
        setIsScheduled(false);
        setScheduledDate(undefined);
        setScheduledTime("12:00");
      }
    }
  }, [editingPost]);
  const toggleChannel = (ch: string) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  const generateContent = async (type: "post" | "content-plan") => {
    if (!aiPrompt.trim()) {
      toast.error("Введите тему или описание для генерации");
      return;
    }
    // Проверка лимита тарифа
    if (type === "post" && !subscription.hasFeature("ai_text")) {
      showUpgrade("AI-генерация текста",
        subscription.limits.ai_text === 0
          ? "На вашем тарифе AI-генерация текста недоступна."
          : `Вы использовали все ${subscription.limits.ai_text} запросов AI-текста в этом месяце.`);
      return;
    }
    if (type === "content-plan" && !subscription.hasFeature("content_plan")) {
      showUpgrade("AI-генерация контент-плана",
        subscription.limits.content_plan === 0
          ? "Контент-план доступен только на тарифе Про."
          : `Вы использовали все ${subscription.limits.content_plan} контент-планов в этом месяце.`);
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
      subscription.refresh();
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации");
    } finally {
      setIsGenerating(false);
    }
  };

  const decorateText = async () => {
    if (!content.trim()) {
      toast.error("Сначала напишите или вставьте текст поста");
      return;
    }
    if (!subscription.hasFeature("ai_text")) {
      showUpgrade("Оформление текста",
        subscription.limits.ai_text === 0
          ? "На вашем тарифе AI-оформление недоступно."
          : `Вы использовали все ${subscription.limits.ai_text} AI-запросов в этом месяце.`);
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: { type: "decorate", style, originalText: content },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.content) {
        setContent(data.content);
        toast.success("Текст оформлен!");
        subscription.refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка оформления");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error("Введите описание для генерации картинки");
      return;
    }
    if (!subscription.hasFeature("ai_image")) {
      showUpgrade("AI-генерация изображений",
        subscription.limits.ai_image === 0
          ? "На вашем тарифе AI-генерация изображений недоступна."
          : `Вы использовали все ${subscription.limits.ai_image} запросов в этом месяце.`);
      return;
    }
    setIsGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: imagePrompt },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setImageUrl(data.image_url);
      toast.success("Картинка сгенерирована!");
      subscription.refresh();
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации картинки");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const uploadImageFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Можно загружать только изображения");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 10 МБ");
      return;
    }
    setIsUploadingImage(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("post-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Картинка загружена!");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки картинки");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const savePost = async (status: "draft" | "published" | "scheduled") => {
    if (!content.trim()) {
      toast.error("Напишите или сгенерируйте текст поста");
      return;
    }
    if ((status === "published" || status === "scheduled") && channels.length === 0) {
      toast.error("Выберите хотя бы один канал для публикации");
      return;
    }
    if (status === "scheduled" && !scheduledDate) {
      toast.error("Выберите дату публикации");
      return;
    }
    // Проверка функции отложенного постинга
    if (status === "scheduled" && !subscription.hasFeature("scheduled_posting")) {
      showUpgrade("Отложенный постинг", "Доступно на тарифах Базовый и Про.");
      return;
    }
    // Проверка лимита постов (только для нового, не редактирования)
    if (!postId && (status === "published" || status === "scheduled")) {
      if (!subscription.hasFeature("posts")) {
        const limit = subscription.limits.posts;
        showUpgrade("Публикация постов",
          `Вы достигли лимита ${limit} постов в этом месяце. Обновите тариф, чтобы публиковать больше.`);
        return;
      }
    }

    let scheduledAt: string | null = null;
    if (status === "scheduled" && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const dt = new Date(scheduledDate);
      dt.setHours(hours, minutes, 0, 0);
      if (dt <= new Date()) {
        toast.error("Дата публикации должна быть в будущем");
        return;
      }
      scheduledAt = dt.toISOString();
    }

    setIsSaving(true);
    try {
      let savedPost: any;
      const isImmediatePublish = status === "published";
      const persistedStatus = isImmediatePublish ? "draft" : status;

      if (postId) {
        const { data, error } = await supabase.from("posts").update({
          title,
          content,
          style: style as any,
          status: persistedStatus as any,
          channels,
          scheduled_at: scheduledAt,
          published_at: null,
          image_url: imageUrl,
          include_footer: includeFooter,
        }).eq("id", postId).select().single();
        if (error) throw error;
        savedPost = data;
      } else {
        const { data, error } = await supabase.from("posts").insert({
          user_id: user!.id,
          title,
          content,
          style: style as any,
          status: persistedStatus as any,
          channels,
          scheduled_at: scheduledAt,
          published_at: null,
          image_url: imageUrl,
          include_footer: includeFooter,
        }).select().single();
        if (error) throw error;
        savedPost = data;
        // Инкремент счётчика постов только при создании нового, не для черновика
        if (status !== "draft") {
          await supabase.rpc("check_and_increment_usage", {
            _user_id: user!.id, _resource: "posts",
          });
          subscription.refresh();
        }
      }

      if (isImmediatePublish && savedPost) {
        const publishErrors: string[] = [];
        const publishSuccesses: string[] = [];

        if (channels.includes("telegram")) {
          const { data: tgResult, error: tgError } = await supabase.functions.invoke("publish-telegram", {
            body: { postId: savedPost.id },
          });

          if (tgError || tgResult?.error) {
            publishErrors.push(`Telegram: ${tgResult?.error || tgError?.message || "Неизвестная ошибка"}`);
          } else {
            publishSuccesses.push("Telegram ✓");
            toast.success("Пост опубликован в Telegram!");
          }
        }

        if (channels.includes("vk")) {
          const { data: vkResult, error: vkError } = await supabase.functions.invoke("publish-vk", {
            body: { postId: savedPost.id },
          });

          if (vkError || vkResult?.error) {
            publishErrors.push(`ВК группа: ${vkResult?.error || vkError?.message || "Неизвестная ошибка"}`);
          } else {
            publishSuccesses.push(vkResult?.post_url ? `ВК группа ✓ ${vkResult.post_url}` : "ВК группа ✓");
            toast.success("Пост опубликован в группу ВК!");
          }
        }

        if (channels.includes("max")) {
          const { data: maxResult, error: maxError } = await supabase.functions.invoke("publish-max", {
            body: { postId: savedPost.id },
          });

          if (maxError || maxResult?.error) {
            publishErrors.push(`MAX: ${maxResult?.error || maxError?.message || "Неизвестная ошибка"}`);
          } else {
            publishSuccesses.push("MAX ✓");
            toast.success("Пост опубликован в MAX!");
          }
        }

        setPublishResult({ errors: publishErrors, successes: publishSuccesses });

        if (publishSuccesses.length === 0) {
          toast.error(publishErrors[0] || "Пост сохранён как черновик, но не опубликован");
          return;
        }

        if (publishErrors.length > 0) {
          toast.warning(`Опубликовано не во всех каналах`);
        }

        toast.success("Пост опубликован!");
      } else {
        setPublishResult(null);
        const msg = status === "scheduled" ? "Пост запланирован!" : "Черновик сохранён";
        toast.success(msg);
      }

      setPostId(null); setTitle(""); setContent(""); setAiPrompt(""); setChannels([]);
      setIsScheduled(false); setScheduledDate(undefined); setScheduledTime("12:00"); setImageUrl(null); setImagePrompt(""); setIncludeFooter(true);
      onDone?.();
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5 text-primary" />
                {postId ? "Редактирование поста" : "Редактор поста"}
              </CardTitle>
              {postId && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setPostId(null); setTitle(""); setContent(""); setAiPrompt(""); setChannels([]);
                  setIsScheduled(false); setScheduledDate(undefined); setScheduledTime("12:00"); setImageUrl(null); setImagePrompt(""); setIncludeFooter(true);
                  onDone?.();
                }}>
                  Отменить
                </Button>
              )}
            </div>
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

        {/* Image Generation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-primary" />
              Картинка к посту
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="image-prompt">Опишите картинку (AI)</Label>
              <Textarea
                id="image-prompt"
                placeholder="Например: яркая иллюстрация для поста про SMM, современный стиль..."
                className="min-h-[80px]"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={generateImage} disabled={isGeneratingImage || isUploadingImage}>
                {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Сгенерировать
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isGeneratingImage || isUploadingImage}
                onClick={() => document.getElementById("post-image-upload")?.click()}
              >
                {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                Прикрепить файл
              </Button>
              <input
                id="post-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImageFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {imageUrl && (
              <div className="relative">
                <img src={imageUrl} alt="Сгенерированная картинка" className="w-full rounded-lg border" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => setImageUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
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
              {POST_STYLES.map((s) => {
                // На бесплатном — только "minimal". На остальных — все.
                const isLocked = !subscription.hasFeature("all_styles") && s.id !== "minimal";
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isLocked) {
                        showUpgrade(`Стиль «${s.label}»`, "Все стили доступны на тарифах Базовый и Про.");
                        return;
                      }
                      setStyle(s.id);
                    }}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                      style === s.id ? "border-primary bg-primary/5" : "border-border",
                      isLocked && "opacity-60",
                    )}
                  >
                    {isLocked && (
                      <Lock className="absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Как это работает:</p>
              <p>
                Стиль — это инструкция для AI. Чтобы он применился, выберите стиль и нажмите{" "}
                <span className="font-medium text-foreground">«Сгенерировать пост»</span> в блоке AI-генерации.
                На уже написанный текст стиль автоматически не применяется — нужно перегенерировать.
              </p>
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
          <CardContent className="space-y-3">
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
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5 pr-3">
                <Label htmlFor="footer-toggle" className="text-sm">Прикрепить подвал со ссылками</Label>
                <p className="text-xs text-muted-foreground">
                  Ссылки «Связаться с менеджером / со мной» из настроек каналов добавятся в конец поста.
                </p>
              </div>
              <Switch id="footer-toggle" checked={includeFooter} onCheckedChange={setIncludeFooter} />
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

        {/* Scheduling */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Отложенный постинг
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="schedule-toggle" className="flex items-center gap-1.5">
                Запланировать
                {!subscription.hasFeature("scheduled_posting") && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Switch
                id="schedule-toggle"
                checked={isScheduled}
                onCheckedChange={(v) => {
                  if (v && !subscription.hasFeature("scheduled_posting")) {
                    showUpgrade("Отложенный постинг", "Доступно на тарифах Базовый и Про.");
                    return;
                  }
                  setIsScheduled(v);
                }}
              />
            </div>
            {isScheduled && (
              <div className="space-y-3">
                <div>
                  <Label>Дата</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="schedule-time">Время</Label>
                  <Input id="schedule-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isScheduled ? (
            <Button onClick={() => savePost("scheduled")} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarIcon className="h-4 w-4" />}
              Запланировать публикацию
            </Button>
          ) : (
            <Button onClick={() => savePost("published")} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Опубликовать
            </Button>
          )}
          <Button variant="outline" onClick={() => savePost("draft")} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4" />
            Сохранить черновик
          </Button>
        </div>

        {/* Publish result panel */}
        {publishResult && (publishResult.errors.length > 0 || publishResult.successes.length > 0) && (
          <Card className="border-dashed">
            <CardContent className="p-3 space-y-2">
              {publishResult.successes.length > 0 && (
                <div className="space-y-1">
                  {publishResult.successes.map((s, i) => (
                    <p key={i} className="text-sm text-green-600 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">✅</span>
                      <span className="break-all">{s}</span>
                    </p>
                  ))}
                </div>
              )}
              {publishResult.errors.length > 0 && (
                <div className="space-y-1">
                  {publishResult.errors.map((e, i) => (
                    <p key={i} className="text-sm text-destructive flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">❌</span>
                      <span className="break-all">{e}</span>
                    </p>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setPublishResult(null)}
              >
                Скрыть
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <UpgradeModal
        open={upgradeModal.open}
        onOpenChange={(o) => setUpgradeModal((s) => ({ ...s, open: o }))}
        feature={upgradeModal.feature}
        currentPlan={subscription.plan}
        reason={upgradeModal.reason}
      />
    </div>
  );
}
