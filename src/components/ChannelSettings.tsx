import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save, Loader2, RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";

interface ChannelConfig {
  id?: string;
  channel: string;
  channel_chat_id: string;
  is_active: boolean;
  label: string;
  placeholder: string;
  hint: string;
}

const VK_CLIENT_ID = "54525496";
const VK_AUTH_URL = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&scope=8192&response_type=code&v=5.199&redirect_uri=https://oauth.vk.com/blank.html`;

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    channel: "telegram",
    channel_chat_id: "",
    is_active: false,
    label: "Telegram",
    placeholder: "@mychannel или -1001234567890",
    hint: "Добавьте бота администратором в канал, затем укажите @username канала или числовой Chat ID",
  },
  {
    channel: "vk",
    channel_chat_id: "",
    is_active: false,
    label: "ВКонтакте (сообщество)",
    placeholder: "123456789",
    hint: "Укажите числовой ID вашей группы ВК (без минуса). Бот опубликует пост от имени сообщества.",
  },
  {
    channel: "vk_personal",
    channel_chat_id: "",
    is_active: false,
    label: "ВКонтакте (личная страница)",
    placeholder: "",
    hint: "Публикация на вашу личную стену ВК. Требуется авторизация через VK.",
  },
  {
    channel: "ok",
    channel_chat_id: "",
    is_active: false,
    label: "Макс (ok.ru)",
    placeholder: "ID группы",
    hint: "Интеграция с Макс будет доступна в ближайшем обновлении",
  },
];

export function ChannelSettings() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vkCode, setVkCode] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [vkTokenActive, setVkTokenActive] = useState(false);

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
              return { ...ch, id: saved.id, channel_chat_id: saved.channel_chat_id, is_active: saved.is_active };
            }
            return ch;
          })
        );
        const vkPersonal = data.find((d: any) => d.channel === "vk_personal");
        if (vkPersonal?.channel_chat_id && vkPersonal.is_active) {
          setVkTokenActive(true);
        }
      }
      setLoading(false);
    })();
  }, [user]);

  const updateChannel = (channel: string, field: keyof ChannelConfig, value: any) => {
    setChannels((prev) => prev.map((ch) => ch.channel === channel ? { ...ch, [field]: value } : ch));
  };

  const exchangeVkCode = useCallback(async () => {
    if (!vkCode.trim()) {
      toast.error("Вставьте code из URL");
      return;
    }
    setIsExchanging(true);
    try {
      const { data, error } = await supabase.functions.invoke("exchange-vk-token", {
        body: { code: vkCode.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setVkTokenActive(true);
      setVkCode("");
      updateChannel("vk_personal", "is_active", true);
      
      const expiresHours = data.expires_in ? Math.round(data.expires_in / 3600) : null;
      toast.success(
        `VK токен обновлён!${expiresHours ? ` Действует ${expiresHours}ч.` : ""}`
      );
    } catch (e: any) {
      toast.error(e.message || "Ошибка обмена кода на токен");
    } finally {
      setIsExchanging(false);
    }
  }, [vkCode]);

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      for (const ch of channels) {
        // Skip vk_personal — managed via token exchange
        if (ch.channel === "vk_personal") continue;
        
        if (ch.id) {
          await supabase.from("channel_settings").update({
            channel_chat_id: ch.channel_chat_id,
            is_active: ch.is_active,
          }).eq("id", ch.id);
        } else if (ch.channel_chat_id || ch.is_active) {
          const { data } = await supabase.from("channel_settings").insert({
            user_id: user.id,
            channel: ch.channel,
            channel_chat_id: ch.channel_chat_id,
            is_active: ch.is_active,
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
              {ch.channel !== "vk_personal" && (
                <Switch
                  checked={ch.is_active}
                  onCheckedChange={(v) => updateChannel(ch.channel, "is_active", v)}
                />
              )}
              {ch.channel === "vk_personal" && vkTokenActive && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Активен
                </span>
              )}
            </div>
            <CardDescription className="text-xs">{ch.hint}</CardDescription>
          </CardHeader>
          
          {ch.channel === "vk_personal" ? (
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={VK_AUTH_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    1. Авторизоваться в VK
                  </a>
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  2. Скопируйте <code className="bg-muted px-1 rounded">code</code> из URL после редиректа и вставьте сюда:
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Вставьте code из URL"
                    value={vkCode}
                    onChange={(e) => setVkCode(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button onClick={exchangeVkCode} disabled={isExchanging || !vkCode.trim()} size="sm">
                    {isExchanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Обновить
                  </Button>
                </div>
              </div>
              {vkTokenActive && (
                <p className="text-xs text-muted-foreground">
                  ⏱ Токен действует ~24 часа. Повторите шаги выше для обновления.
                </p>
              )}
            </CardContent>
          ) : (
            ch.is_active && (
              <CardContent>
                <Label>Chat ID / ID канала</Label>
                <Input
                  placeholder={ch.placeholder}
                  value={ch.channel_chat_id}
                  onChange={(e) => updateChannel(ch.channel, "channel_chat_id", e.target.value)}
                />
              </CardContent>
            )
          )}
        </Card>
      ))}
    </div>
  );
}
