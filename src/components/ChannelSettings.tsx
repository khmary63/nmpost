import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save, Loader2 } from "lucide-react";

interface ChannelConfig {
  id?: string;
  channel: string;
  channel_chat_id: string;
  is_active: boolean;
  label: string;
  placeholder: string;
  hint: string;
}

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
    channel: "max",
    channel_chat_id: "",
    is_active: false,
    label: "MAX (мессенджер)",
    placeholder: "-1001234567890",
    hint: "Создайте бота через @MasterBot, добавьте его администратором в канал MAX и укажите Chat ID канала",
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
              return { ...ch, id: saved.id, channel_chat_id: saved.channel_chat_id, is_active: saved.is_active };
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
              <Switch
                checked={ch.is_active}
                onCheckedChange={(v) => updateChannel(ch.channel, "is_active", v)}
              />
            </div>
            <CardDescription className="text-xs">{ch.hint}</CardDescription>
          </CardHeader>
          {ch.is_active && (
            <CardContent>
              <Label>Chat ID / ID канала</Label>
              <Input
                placeholder={ch.placeholder}
                value={ch.channel_chat_id}
                onChange={(e) => updateChannel(ch.channel, "channel_chat_id", e.target.value)}
              />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
