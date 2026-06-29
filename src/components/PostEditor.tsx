import { useState, useEffect, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/proxy-client";
import { toast } from "sonner";
import {
  Sparkles, Send, Save, CalendarIcon, Type, Palette,
  MessageSquare, Loader2, Wand2, FileText, Clock, ImageIcon, X, Paperclip, Lock, ExternalLink, Smile,
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
  { id: "dzen", label: "Яндекс Дзен", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  { id: "vcru", label: "VC.ru", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
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
  const [publishedChannels, setPublishedChannels] = useState<string[]>([]);
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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imageUrl = imageUrls[0] ?? null;
  const setImageUrl = (u: string | null) => setImageUrls(u ? [u] : []);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [firstComment, setFirstComment] = useState("");
  const [planPostsCount, setPlanPostsCount] = useState(7);
  const [planPeriod, setPlanPeriod] = useState<"week" | "month" | "custom">("week");
  const [planDays, setPlanDays] = useState(7);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; reason?: string }>({
    open: false, feature: "",
  });
  const [toneSample, setToneSample] = useState<string>("");
  const [useToneOfVoice, setUseToneOfVoice] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    const ta = contentRef.current;
    if (!ta) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (before: string, after: string) => {
    const ta = contentRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || "текст";
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + before.length;
      ta.setSelectionRange(pos, pos + selected.length);
    });
  };

  const insertLink = () => {
    const ta = contentRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    const selected = content.slice(start, end);
    const url = window.prompt("Введите URL:", "https://");
    if (!url) return;
    const label = selected || window.prompt("Текст ссылки:", "ссылка") || "ссылка";
    const md = `[${label}](${url})`;
    const next = content.slice(0, start) + md + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + md.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  // Подгружаем образец «Мой стиль письма» из профиля
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("tone_of_voice_sample")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setToneSample(((data as any)?.tone_of_voice_sample || "").trim());
      });
  }, [user]);

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
      setPublishedChannels(
        Array.isArray((editingPost as any).published_channels)
          ? ((editingPost as any).published_channels as string[])
          : [],
      );
      const initialImages = (editingPost as any).image_urls && Array.isArray((editingPost as any).image_urls) && (editingPost as any).image_urls.length > 0
        ? (editingPost as any).image_urls as string[]
        : (editingPost.image_url ? [editingPost.image_url] : []);
      setImageUrls(initialImages);
      setIncludeFooter(editingPost.include_footer ?? true);
      setFirstComment(((editingPost as any).first_comment ?? "") as string);
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

  // Подвал «Связаться с менеджером / со мной» для Дзена и VC.ru.
  // Берём из channel_settings конкретного канала (dzen или vcru).
  const buildFooter = async (channel: "dzen" | "vcru"): Promise<string> => {
    if (!includeFooter || !user) return "";
    try {
      const { data } = await supabase
        .from("channel_settings")
        .select("manager_url, personal_url")
        .eq("user_id", user.id)
        .eq("channel", channel)
        .maybeSingle();
      const lines: string[] = [];
      if (data?.manager_url?.trim()) lines.push(`👉 Связаться с менеджером: ${data.manager_url.trim()}`);
      if (data?.personal_url?.trim()) lines.push(`👉 Связаться со мной: ${data.personal_url.trim()}`);
      return lines.length ? `\n\n${lines.join("\n")}` : "";
    } catch {
      return "";
    }
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
      const periodDays = planPeriod === "week" ? 7 : planPeriod === "month" ? 30 : planDays;
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: {
          prompt: aiPrompt,
          style,
          type,
          ...(useToneOfVoice && toneSample ? { toneSample } : {}),
          ...(type === "content-plan" && { postsCount: planPostsCount, periodDays }),
        },
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
      setImageUrls((prev) => [...prev, data.image_url]);
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
      setImageUrls((prev) => [...prev, data.publicUrl]);
      toast.success("Картинка загружена!");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки картинки");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const uploadImageFiles = async (files: File[]) => {
    for (const f of files) {
      // sequentially to keep order
      // eslint-disable-next-line no-await-in-loop
      await uploadImageFile(f);
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
          image_urls: imageUrls,
          include_footer: includeFooter,
          first_comment: firstComment,
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
          image_urls: imageUrls,
          include_footer: includeFooter,
          first_comment: firstComment,
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
        // Каналы, в которые уже успешно опубликовано ранее (частичная публикация)
        const alreadyDone = new Set(
          (publishedChannels ?? []).filter((c) => channels.includes(c)),
        );
        const doneNow = new Set<string>(alreadyDone);

        if (alreadyDone.size > 0) {
          for (const c of alreadyDone) {
            const label = CHANNELS.find((ch) => ch.id === c)?.label ?? c;
            publishSuccesses.push(`${label} ✓ (уже опубликован)`);
          }
        }

        if (channels.includes("telegram") && !alreadyDone.has("telegram")) {
          const { data: tgResult, error: tgError } = await supabase.functions.invoke("publish-telegram", {
            body: { postId: savedPost.id },
          });

          if (tgError || tgResult?.error) {
            publishErrors.push(`Telegram: ${tgResult?.error || tgError?.message || "Неизвестная ошибка"}`);
          } else {
            doneNow.add("telegram");
            publishSuccesses.push("Telegram ✓");
            toast.success("Пост опубликован в Telegram!");
          }
        }

        if (channels.includes("vk") && !alreadyDone.has("vk")) {
          const { data: vkResult, error: vkError } = await supabase.functions.invoke("publish-vk", {
            body: { postId: savedPost.id },
          });

          if (vkError || vkResult?.error) {
            publishErrors.push(`ВК группа: ${vkResult?.error || vkError?.message || "Неизвестная ошибка"}`);
          } else {
            doneNow.add("vk");
            publishSuccesses.push(vkResult?.post_url ? `ВК группа ✓ ${vkResult.post_url}` : "ВК группа ✓");
            if (vkResult?.image_warning) {
              publishErrors.push(`ВК картинка: ${vkResult.image_warning}`);
            }
            if (vkResult?.channel_warning) {
              publishErrors.push(`ВК канал: ${vkResult.channel_warning}`);
            }
            toast.success("Пост опубликован в группу ВК!");
          }
        }

        if (channels.includes("max") && !alreadyDone.has("max")) {
          const { data: maxResult, error: maxError } = await supabase.functions.invoke("publish-max", {
            body: { postId: savedPost.id },
          });

          if (maxError || maxResult?.error) {
            publishErrors.push(`MAX: ${maxResult?.error || maxError?.message || "Неизвестная ошибка"}`);
          } else {
            doneNow.add("max");
            publishSuccesses.push("MAX ✓");
            toast.success("Пост опубликован в MAX!");
          }
        }

        setPublishResult({ errors: publishErrors, successes: publishSuccesses });

        const doneChannels = channels.filter((c) => doneNow.has(c));
        const allDone = channels.length > 0 && channels.every((c) => doneNow.has(c));

        if (doneChannels.length === 0) {
          // Ничего не опубликовано — остаётся черновиком
          await supabase.from("posts").update({
            status: "draft" as const,
            published_channels: [],
          }).eq("id", savedPost.id);
          setPublishedChannels([]);
          toast.error(publishErrors[0] || "Пост сохранён как черновик, но не опубликован");
          return;
        }

        await supabase.from("posts").update({
          status: (allDone ? "published" : "partial") as any,
          published_at: allDone ? new Date().toISOString() : null,
          published_channels: doneChannels,
        }).eq("id", savedPost.id);
        setPublishedChannels(doneChannels);

        if (allDone) {
          toast.success("Пост опубликован!");
        } else {
          toast.warning("Опубликовано частично — не во всех каналах. Повторите, чтобы доотправить в остальные.");
        }
      } else {
        setPublishResult(null);
        const msg = status === "scheduled" ? "Пост запланирован!" : "Черновик сохранён";
        toast.success(msg);
      }


      setPostId(null); setTitle(""); setContent(""); setAiPrompt(""); setChannels([]);
      setIsScheduled(false); setScheduledDate(undefined); setScheduledTime("12:00"); setImageUrls([]); setImagePrompt(""); setIncludeFooter(true);
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
                  setIsScheduled(false); setScheduledDate(undefined); setScheduledTime("12:00"); setImageUrls([]); setImagePrompt(""); setIncludeFooter(true);
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
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <Label htmlFor="content">Текст поста</Label>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 font-bold" title="Жирный" onClick={() => wrapSelection("**", "**")}>Ж</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 italic" title="Курсив" onClick={() => wrapSelection("*", "*")}>К</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 line-through" title="Зачёркнутый" onClick={() => wrapSelection("~~", "~~")}>З</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Спойлер (Telegram)" onClick={() => wrapSelection("||", "||")}>Сп</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs font-mono" title="Моноширинный" onClick={() => wrapSelection("`", "`")}>{`</>`}</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Ссылка" onClick={insertLink}>Ссылка</Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1">
                        <Smile className="h-4 w-4" />
                        Эмодзи
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="end">
                      <EmojiPicker onSelect={(emoji) => insertEmoji(emoji)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Textarea
                ref={contentRef}
                id="content"
                placeholder="Напишите текст поста или сгенерируйте с помощью AI..."
                className="min-h-[200px] resize-y"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {content.length} символов · форматирование работает в Telegram, Дзен и VC.ru. В ВК и MAX публикуется как обычный текст.
              </p>
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
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Контент-план</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="plan-count" className="text-xs">Количество постов</Label>
                  <Input
                    id="plan-count"
                    type="number"
                    min={1}
                    max={60}
                    value={planPostsCount}
                    onChange={(e) => setPlanPostsCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <Label htmlFor="plan-period" className="text-xs">Период</Label>
                  <select
                    id="plan-period"
                    value={planPeriod}
                    onChange={(e) => setPlanPeriod(e.target.value as "week" | "month" | "custom")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="week">Неделя (7 дней)</option>
                    <option value="month">Месяц (30 дней)</option>
                    <option value="custom">Свой период</option>
                  </select>
                </div>
              </div>
              {planPeriod === "custom" && (
                <div>
                  <Label htmlFor="plan-days" className="text-xs">Количество дней</Label>
                  <Input
                    id="plan-days"
                    type="number"
                    min={1}
                    max={90}
                    value={planDays}
                    onChange={(e) => setPlanDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                  />
                </div>
              )}
              <Button variant="outline" onClick={() => generateContent("content-plan")} disabled={isGenerating} className="w-full">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Сгенерировать контент-план
              </Button>
              <p className="text-xs text-muted-foreground">
                Опишите тему/нишу в поле выше — AI составит план из выбранного количества постов на указанный период
                (тема, описание, рекомендуемое время публикации). Результат появится в поле «Текст поста».
              </p>
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
                Прикрепить файлы
              </Button>
              <input
                id="post-image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) uploadImageFiles(files);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Можно прикрепить несколько картинок — все они будут опубликованы в одном посте (галереей).
              В Telegram максимум 10 картинок на пост.
            </p>
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group">
                    <img src={url} alt={`Картинка ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border" />
                    <span className="absolute top-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium">
                      {idx + 1}
                    </span>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduling — moved to left column for layout balance */}
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
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
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
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Как запланировать несколько постов:</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Напишите или сгенерируйте текст одного поста.</li>
                <li>Выберите каналы публикации.</li>
                <li>Включите переключатель «Запланировать», задайте дату и время.</li>
                <li>Нажмите <span className="font-medium text-foreground">«Запланировать публикацию»</span> — пост уйдёт в раздел «Мои посты» со статусом «Запланирован».</li>
                <li>Редактор очистится — повторите шаги 1-4 для следующего поста с другой датой/временем.</li>
              </ol>
              <p className="mt-2">Все запланированные посты опубликуются автоматически в указанное время.</p>
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
                    "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                    style === s.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <span className="text-lg">{s.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <Button
              onClick={decorateText}
              disabled={isGenerating || !content.trim()}
              variant="secondary"
              className="mt-3 w-full"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Оформить текст в этом стиле
            </Button>

            {/* Tone of Voice toggle */}
            <div className="mt-3 rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="tov-toggle" className="text-sm">Использовать мой стиль письма</Label>
                  <p className="text-xs text-muted-foreground">
                    AI подстроится под лексику и интонацию из вашего образца в профиле.
                  </p>
                </div>
                <Switch
                  id="tov-toggle"
                  checked={useToneOfVoice}
                  disabled={!toneSample}
                  onCheckedChange={setUseToneOfVoice}
                />
              </div>
              {!toneSample && (
                <p className="text-xs text-muted-foreground">
                  Образец не задан. Добавьте его в{" "}
                  <a href="/profile" className="text-primary underline underline-offset-2">личном кабинете</a>.
                </p>
              )}
            </div>

            <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Как это работает:</p>
              <p className="mb-1">
                <span className="font-medium text-foreground">«Оформить текст»</span> — добавит эмодзи, жирный/курсив и разделители к вашему тексту, не меняя слов.
              </p>
              <p>
                <span className="font-medium text-foreground">«Сгенерировать пост»</span> в блоке AI — напишет новый текст с нуля в выбранном стиле.
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
            <p className="text-xs text-muted-foreground">
              Нажмите на нужные каналы, чтобы выделить их — пост опубликуется во всех выбранных. Можно выбрать несколько.
            </p>
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

            <div className="rounded-md border p-3 space-y-2">
              <div className="space-y-0.5">
                <Label htmlFor="first-comment" className="text-sm">Первый комментарий (необязательно)</Label>
                <p className="text-xs text-muted-foreground">
                  Отправится комментарием к посту во все выбранные каналы (ВК, Telegram, MAX). Поддерживается markdown-ссылка: <code>[текст](https://...)</code>. Для Telegram нужна группа обсуждений в настройках канала — иначе комментарий пропускается.
                </p>
              </div>
              <Textarea
                id="first-comment"
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                placeholder="Например: Подробности по [ссылке](https://example.com)"
                rows={3}
              />
            </div>

            {/* Личная страница ВК — полуавтомат */}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm">Личная страница ВК</Label>
                  <p className="text-xs text-muted-foreground">
                    ВК запрещает автопубликацию на личные страницы. Откроем ленту ВК с готовым текстом и картинкой — опубликуйте вручную.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!content.trim()}
                  onClick={async () => {
                    const text = content.trim();
                    if (!text) { toast.error("Сначала напишите или сгенерируйте текст поста"); return; }
                    let copied = false;
                    try { await navigator.clipboard.writeText(text); copied = true; } catch { copied = false; }
                    if (imageUrl) {
                      try {
                        const resp = await fetch(imageUrl);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl; a.download = `post-${Date.now()}.jpg`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                      } catch (err) { console.error(err); }
                    }
                    window.open("https://vk.com/feed", "_blank", "noopener,noreferrer");
                    toast.success(copied ? "Текст скопирован, картинка скачана. Вставьте в форму записи ВК (Ctrl+V)." : "Открыли ВК. Скопируйте текст вручную.");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Подготовить пост для личной страницы ВК
                </Button>
              </div>
            </div>

            {/* Яндекс Дзен — полуавтомат */}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm">Яндекс Дзен</Label>
                  <p className="text-xs text-muted-foreground">
                    У Дзена нет публичного API для авторов. Мы скопируем текст в буфер и скачаем картинку — публикация делается вручную.
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-0.5 pt-1">
                    <li>Нажмите кнопку — откроется Студия Дзена (войдите в свой Яндекс-аккаунт).</li>
                    <li>В Студии нажмите «Написать» → «Статья» (или «Пост»).</li>
                    <li>Вставьте заголовок и текст из буфера (Ctrl+V / Cmd+V).</li>
                    <li>Загрузите скачанную картинку как обложку.</li>
                    <li>Нажмите «Опубликовать» — пост появится на канале после модерации Дзена.</li>
                  </ol>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!content.trim()}
                  onClick={async () => {
                    const text = content.trim();
                    if (!text) { toast.error("Сначала напишите или сгенерируйте текст поста"); return; }
                    // Открываем окно СРАЗУ внутри пользовательского жеста,
                    // иначе после await браузер блокирует window.open как попап.
                    const dzenStudioUrl = "https://dzen.ru/media/zen/login";
                    const dzenWindow = window.open(dzenStudioUrl, "_blank", "noopener,noreferrer");

                    const stripMd = (s: string) => s
                      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
                      .replace(/\*\*(.+?)\*\*/g, "$1")
                      .replace(/(?<!\*)\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1")
                      .replace(/__(.+?)__/g, "$1")
                      .replace(/(?<!_)_(?!\s)([^_\n]+?)_(?!_)/g, "$1")
                      .replace(/`([^`]+)`/g, "$1")
                      .replace(/^#{1,6}\s+/gm, "");
                    const cleanTitle = stripMd(title.trim());
                    const cleanText = stripMd(text);
                    const footer = await buildFooter("dzen");
                    const fullText = (cleanTitle ? `${cleanTitle}\n\n${cleanText}` : cleanText) + footer;
                    let copied = false;
                    try { await navigator.clipboard.writeText(fullText); copied = true; } catch { copied = false; }
                    if (imageUrl) {
                      try {
                        const resp = await fetch(imageUrl);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl; a.download = `dzen-post-${Date.now()}.jpg`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                      } catch (err) { console.error(err); }
                    }
                    if (!dzenWindow) {
                      toast.error("Браузер заблокировал открытие вкладки. Разрешите всплывающие окна для этого сайта и нажмите кнопку ещё раз.");
                      return;
                    }
                    toast.success(copied ? "Текст скопирован, картинка скачана. Открыли Студию Дзена — нажмите «Написать пост», затем вставьте текст (Ctrl+V) и загрузите картинку." : "Открыли Студию Дзена — нажмите «Написать пост». ");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Подготовить пост для Дзена
                </Button>
              </div>
            </div>

            {/* VC.ru — полуавтомат */}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-sm">VC.ru</Label>
                  <p className="text-xs text-muted-foreground">
                    У VC.ru нет публичного API. Мы скопируем текст в буфер и скачаем картинку — публикация делается вручную.
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-0.5 pt-1">
                    <li>Нажмите кнопку — откроется страница создания публикации VC.ru (войдите в аккаунт).</li>
                    <li>Выберите подсайт (личный блог или сообщество, где публикуете).</li>
                    <li>Вставьте заголовок и текст из буфера (Ctrl+V / Cmd+V).</li>
                    <li>Перетащите скачанную картинку в тело публикации или в обложку.</li>
                    <li>Нажмите «Опубликовать» — материал появится в ленте подсайта.</li>
                  </ol>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!content.trim()}
                  onClick={async () => {
                    const text = content.trim();
                    if (!text) { toast.error("Сначала напишите или сгенерируйте текст поста"); return; }
                    const stripMd = (s: string) => s
                      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
                      .replace(/\*\*(.+?)\*\*/g, "$1")
                      .replace(/(?<!\*)\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1")
                      .replace(/__(.+?)__/g, "$1")
                      .replace(/(?<!_)_(?!\s)([^_\n]+?)_(?!_)/g, "$1")
                      .replace(/`([^`]+)`/g, "$1")
                      .replace(/^#{1,6}\s+/gm, "");
                    const cleanTitle = stripMd(title.trim());
                    const cleanText = stripMd(text);
                    const footer = await buildFooter("vcru");
                    const fullText = (cleanTitle ? `${cleanTitle}\n\n${cleanText}` : cleanText) + footer;
                    let copied = false;
                    try { await navigator.clipboard.writeText(fullText); copied = true; } catch { copied = false; }
                    if (imageUrl) {
                      try {
                        const resp = await fetch(imageUrl);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl; a.download = `vcru-post-${Date.now()}.jpg`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                      } catch (err) { console.error(err); }
                    }
                    window.open("https://vc.ru/new", "_blank", "noopener,noreferrer");
                    toast.success(copied ? "Текст скопирован, картинка скачана. Открыли страницу создания публикации VC.ru — вставьте текст (Ctrl+V)." : "Открыли страницу создания публикации VC.ru.");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Подготовить пост для VC.ru
                </Button>
              </div>
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
                style === "elegant" && "bg-accent/30 font-serif",
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
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Смайлы", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","🙂","😉","😍","🥰","😘","😎","🤩","🤔","😐","😏","😴","😜","🤗","🤭","🤫","🙃","😇","😢","😭","😡","😱","🥳","🤝","👋","👍","👎","👏","🙌","🙏","💪","✌️","🤟","👌","✋","🤚","☝️","👉","👈","👇","👆"] },
  { label: "Сердца", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💖","💗","💕","💞","💝","💘","💓","💟","♥️","💔"] },
  { label: "Объекты", emojis: ["🔥","✨","⭐","🌟","💫","💥","🎉","🎊","🎁","🏆","🥇","💎","💰","💵","🎯","🚀","✅","❌","⚡","☀️","🌈","🎨","📌","📍","📢","📣","🔔","💡","📝","📚","📊","📈","📉","🛒","🛍️","💼","🔑","🔒","🔓"] },
  { label: "Стрелки", emojis: ["⬆️","⬇️","⬅️","➡️","↗️","↘️","↙️","↖️","🔼","🔽","◀️","▶️","🔝","🔙","🔚","🔛","🔜","➕","➖","✖️","➗","♻️","✔️","☑️"] },
];

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  return (
    <div className="max-h-72 overflow-y-auto space-y-3">
      {EMOJI_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-medium text-muted-foreground mb-1 px-1">{g.label}</p>
          <div className="grid grid-cols-8 gap-1">
            {g.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onSelect(e)}
                className="text-xl h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors"
                aria-label={`Вставить ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
