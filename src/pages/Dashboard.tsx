import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PostEditor } from "@/components/PostEditor";
import { PostsList } from "@/components/PostsList";
import { ChannelSettings } from "@/components/ChannelSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, List, Settings } from "lucide-react";

export interface EditingPost {
  id: string;
  title: string;
  content: string;
  style: string;
  channels: string[];
  scheduled_at: string | null;
  status: string;
  image_url: string | null;
  image_urls?: string[] | null;
  include_footer: boolean;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("editor");
  const [editingPost, setEditingPost] = useState<EditingPost | null>(null);

  const handleEdit = (post: EditingPost) => {
    setEditingPost(post);
    setActiveTab("editor");
  };

  const handleEditorDone = () => {
    setEditingPost(null);
  };

  return (
    <DashboardLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Дашборд</h1>
          <TabsList>
            <TabsTrigger value="editor" className="gap-2">
              <PenLine className="h-4 w-4" /> Редактор
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <List className="h-4 w-4" /> Мои посты
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" /> Каналы
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="editor">
          <PostEditor editingPost={editingPost} onDone={handleEditorDone} />
        </TabsContent>
        <TabsContent value="posts">
          <PostsList onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="settings">
          <ChannelSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
