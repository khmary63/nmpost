import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save, Loader2, Link2, ExternalLink, KeyRound } from "lucide-react";

const VK_CLIENT_ID = "54525610";
const VK_REDIRECT_URI = "https://oauth.vk.com/blank.html";
const VK_SCOPE = "wall,photos,groups,offline";
const VK_OAUTH_URL = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(VK_REDIRECT_URI)}&scope=${VK_SCOPE}&response_type=code&v=5.199`;

interface ChannelConfig {
  id?: string;
  channel: string;
  channel_chat_id: string;
  manager_url: string;
  personal_url: string;
  is_active: boolean;
  label: string;
  placeholder: string;
  hint: string;
  guide: { title: string; steps: string[]; note?: string };
}

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    channel: "telegram",
    channel_chat_id: "",
    manager_url: "",
    personal_url: "",
    is_active: false,
    label: "Telegram",
    placeholder: "@mychannel или -1001234567890",
    hint: "Добавьте бота администратором в канал, затем укажите @username канала или числовой Chat ID",
    guide: {
      title: "Как найти Chat ID канала Telegram",
      steps: [
        "Если у канала есть публичный @username — просто укажите его в формате @mychannel.",
        "Для приватного канала: добавьте нашего бота администратором в канал (с правом «Публикация сообщений»).",
        "Откройте бота @userinfobot или @getmyid_bot, перешлите ему любое сообщение из вашего канала — он пришлёт числовой Chat ID (например -1001234567890).",
        "Скопируйте этот ID (со знаком минус) и вставьте в поле ниже.",
      ],
      note: "Бот обязательно должен быть администратором канала, иначе публикация не пройдёт.",
    },
  },
  {
    channel: "vk",
    channel_chat_id: "",
    manager_url: "",
    personal_url: "",
    is_active: false,
    label: "ВКонтакте (сообщество)",
    placeholder: "123456789",
    hint: "Укажите числовой ID вашей группы ВК (без минуса). Бот опубликует пост от имени сообщества.",
    guide: {
      title: "Как найти ID сообщества ВКонтакте",
      steps: [
        "Откройте свою группу ВК в браузере.",
        "Зайдите в «Управление» → «Настройки» → «Работа с API» (или скопируйте короткий адрес группы).",
        "ID — это число в URL вида vk.com/club123456789 (берётся 123456789).",
        "Если у группы короткое имя (vk.com/myclub) — посмотрите ID в «Управление» → «Адрес страницы» → строка «ID сообщества».",
        "Вставьте только цифры, без «club» и без минуса.",
      ],
      note: "Вы должны быть администратором сообщества. Публикация идёт через токен сообщества, настроенный в системе.",
    },
  },
  {
    channel: "max",
    channel_chat_id: "",
    manager_url: "",
    personal_url: "",
    is_active: false,
    label: "MAX (мессенджер)",
    placeholder: "-1001234567890",
    hint: "Создайте бота через @MasterBot, добавьте его администратором в канал MAX и укажите Chat ID канала",
    guide: {
      title: "Как найти Chat ID канала MAX",
      steps: [
        "В мессенджере MAX откройте чат с @MasterBot и создайте своего бота — получите токен (он уже настроен в системе).",
        "Добавьте бота администратором в нужный канал MAX (с правом публикации).",
        "Опубликуйте в канале любое сообщение, затем перешлите его в чат с @getmyid_bot или используйте бота @MaxIDBot.",
        "Бот пришлёт числовой Chat ID канала (формат -1001234567890).",
        "Вставьте этот ID (со знаком минус) в поле ниже.",
      ],
      note: "Без прав администратора бот не сможет публиковать посты в канал.",
    },
  },
];

export function ChannelSettings() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("channel_settings")
        .select("*")
        .eq("user_id", user.id);

      if (data) {
        setChannels((prev) =>
          prev.map((ch) => {
            const saved = data.find((d: any) => d.channel === ch.channel);
            if (saved) {
              return {
                ...ch,
                id: saved.id,
                channel_chat_id: saved.channel_chat_id,
                manager_url: saved.manager_url || "",
                personal_url: saved.personal_url || "",
                is_active: saved.is_active,
              };
            }
            return ch;
          })
        );
      }
      setLoading(false);
    })();
  }, [user]);

  const updateChannel = (channel: string, field: keyof ChannelConfig, value: any) => {
    setChannels((prev) => prev.map((ch) => ch.channel === channel ? { ...ch, [field]: value } : ch));
  };

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      for (const ch of channels) {
        const payload = {
          channel_chat_id: ch.channel_chat_id,
          manager_url: ch.manager_url.trim(),
          personal_url: ch.personal_url.trim(),
          is_active: ch.is_active,
        };
        if (ch.id) {
          await supabase.from("channel_settings").update(payload).eq("id", ch.id);
        } else if (ch.channel_chat_id || ch.is_active || ch.manager_url || ch.personal_url) {
          const { data } = await supabase.from("channel_settings").insert({
            user_id: user.id,
            channel: ch.channel,
            ...payload,
          }).select().single();
          if (data) updateChannel(ch.channel, "id", data.id);
        }
      }
      toast.success("Настройки каналов сохранены");
    } catch (e: any) {
      toast.error(e.message || "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Настройки каналов
        </h2>
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      {channels.map((ch) => (
        <Card key={ch.channel}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{ch.label}</CardTitle>
              <Switch
                checked={ch.is_active}
                onCheckedChange={(v) => updateChannel(ch.channel, "is_active", v)}
              />
            </div>
            <CardDescription className="text-xs">{ch.hint}</CardDescription>
          </CardHeader>
          {ch.is_active && (
            <CardContent className="space-y-3">
              <div>
                <Label>Chat ID / ID канала</Label>
                <Input
                  placeholder={ch.placeholder}
                  value={ch.channel_chat_id}
                  onChange={(e) => updateChannel(ch.channel, "channel_chat_id", e.target.value)}
                />
              </div>

              {ch.channel === "vk" && <VkConnectBlock />}

              <details className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">
                  ❓ {ch.guide.title}
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  {ch.guide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {ch.guide.note && (
                  <p className="mt-2 text-foreground"><span className="font-medium">Важно:</span> {ch.guide.note}</p>
                )}
              </details>

              <div className="rounded-md border border-dashed p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  Подвал поста (ссылки)
                </div>
                <div>
                  <Label className="text-xs">Связаться с менеджером</Label>
                  <Input
                    placeholder="https://t.me/manager или https://wa.me/7900..."
                    value={ch.manager_url}
                    onChange={(e) => updateChannel(ch.channel, "manager_url", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Связаться со мной</Label>
                  <Input
                    placeholder="https://t.me/username"
                    value={ch.personal_url}
                    onChange={(e) => updateChannel(ch.channel, "personal_url", e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Подвал прикрепляется автоматически, если ссылка задана и включён чекбокс в редакторе поста.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function VkConnectBlock() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("channel_settings")
        .select("channel_chat_id")
        .eq("user_id", user.id)
        .eq("channel", "vk_user_token")
        .maybeSingle();
      if (data?.channel_chat_id) setHasToken(true);
    })();
  }, [user]);

  const parseToken = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/access_token=([^&\s]+)/);
    if (match) return match[1];
    return trimmed;
  };

  const save = async () => {
    if (!user) return;
    const parsed = parseToken(token);
    if (!parsed) {
      toast.error("Вставьте access_token или ссылку из адресной строки");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("channel_settings")
        .upsert(
          { user_id: user.id, channel: "vk_user_token", channel_chat_id: parsed, is_active: true },
          { onConflict: "user_id,channel" }
        );
      if (error) throw error;
      setHasToken(true);
      setToken("");
      toast.success("VK подключён — токен сохранён");
    } catch (e: any) {
      toast.error(e.message || "Не удалось сохранить токен");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    await supabase
      .from("channel_settings")
      .delete()
      .eq("user_id", user.id)
      .eq("channel", "vk_user_token");
    setHasToken(false);
    toast.success("VK отключён");
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-primary" />
          Подключение VK (для загрузки картинок)
        </div>
        {hasToken && (
          <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
            ✓ подключено
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Без этого токена картинки в ВК не прикрепятся. Нажмите «Подключить VK», авторизуйтесь, скопируйте всю ссылку из адресной строки (она начинается с <code className="rounded bg-muted px-1">https://oauth.vk.com/blank.html#access_token=...</code>) и вставьте ниже.
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => window.open(VK_OAUTH_URL, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="h-4 w-4" />
        {hasToken ? "Переподключить VK" : "Подключить VK"}
      </Button>
      <div className="space-y-2">
        <Label className="text-xs">Вставьте ссылку или access_token из VK</Label>
        <details className="rounded-md border bg-background/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            Как получить токен? (пошаговая инструкция)
          </summary>
          <ol className="mt-2 space-y-1.5 list-decimal pl-4 text-muted-foreground">
            <li>Нажмите кнопку <span className="font-medium text-foreground">«Подключить VK»</span> выше — откроется окно авторизации ВКонтакте.</li>
            <li>Войдите в свой аккаунт ВК (если ещё не вошли) и нажмите <span className="font-medium text-foreground">«Разрешить»</span> — VK запросит доступ к стене, фото и группам.</li>
            <li>После согласия откроется страница, которая выглядит как пустая или с надписью «Перенаправление». <span className="font-medium text-foreground">Не закрывайте её.</span></li>
            <li>Скопируйте <span className="font-medium text-foreground">всю ссылку из адресной строки браузера</span> целиком — она начинается с <code className="rounded bg-muted px-1">https://oauth.vk.com/blank.html#access_token=</code> и содержит длинный набор букв и цифр.</li>
            <li>Вставьте эту ссылку в поле ниже и нажмите <span className="font-medium text-foreground">«Сохранить токен»</span>. Сам access_token извлечётся автоматически.</li>
          </ol>
          <p className="mt-2 text-muted-foreground">
            💡 Если в адресной строке видна только часть <code className="rounded bg-muted px-1">access_token=...</code> — её тоже можно вставить, этого достаточно.
          </p>
        </details>
        <Input
          placeholder="https://oauth.vk.com/blank.html#access_token=..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving || !token.trim()} className="flex-1 min-w-[140px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить токен
          </Button>
          {hasToken && (
            <Button type="button" variant="ghost" onClick={disconnect}>
              Отключить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
