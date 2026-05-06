import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { EditingPost } from "@/pages/Dashboard";

interface Post {
  id: string;
  title: string;
  content: string;
  style: string;
  status: string;
  channels: string[];
  scheduled_at: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; class: string }> = {
  draft: { label: "Черновик", class: "bg-muted text-muted-foreground" },
  scheduled: { label: "Запланирован", class: "bg-yellow-100 text-yellow-700" },
  published: { label: "Опубликован", class: "bg-green-100 text-green-700" },
};

const channelLabels: Record<string, string> = {
  telegram: "Telegram",
  vk: "ВКонтакте",
  ok: "Макс",
};

interface PostsListProps {
  onEdit?: (post: EditingPost) => void;
}

export function PostsList({ onEdit }: PostsListProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setPosts(data as Post[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session?.access_token) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPosts();
  }, [user?.id, session?.access_token, authLoading]);

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { toast.error("Ошибка удаления"); return; }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Пост удалён");
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Загрузка...</div>;
  if (posts.length === 0) return <div className="text-center py-8 text-muted-foreground">Постов пока нет. Создайте первый!</div>;

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const st = statusMap[post.status] || statusMap.draft;
        return (
          <Card key={post.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={cn("text-xs", st.class)}>{st.label}</Badge>
                    {post.channels.map((ch) => (
                      <Badge key={ch} variant="outline" className="text-xs">
                        {channelLabels[ch] || ch}
                      </Badge>
                    ))}
                  </div>
                  {post.title && <p className="font-medium text-sm">{post.title}</p>}
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {post.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Создан:{" "}
                    {new Date(post.created_at).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {post.status === "scheduled" && post.scheduled_at && (
                    <p className="text-xs font-medium text-foreground mt-1">
                      📅 Запланирован на:{" "}
                      {new Date(post.scheduled_at).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit({
                        id: post.id,
                        title: post.title,
                        content: post.content,
                        style: post.style,
                        channels: post.channels,
                        scheduled_at: post.scheduled_at,
                        status: post.status,
                        image_url: post.image_url,
                        image_urls: (post as any).image_urls ?? null,
                        include_footer: (post as any).include_footer ?? true,
                      })}
                      className="text-primary/60 hover:text-primary"
                    >
                      <FileEdit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deletePost(post.id)} className="text-destructive/60 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
