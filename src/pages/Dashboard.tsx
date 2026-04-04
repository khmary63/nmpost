import { DashboardLayout } from "@/components/DashboardLayout";
import { PostEditor } from "@/components/PostEditor";
import { PostsList } from "@/components/PostsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, List } from "lucide-react";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Tabs defaultValue="editor" className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Дашборд</h1>
          <TabsList>
            <TabsTrigger value="editor" className="gap-2">
              <PenLine className="h-4 w-4" /> Редактор
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <List className="h-4 w-4" /> Мои посты
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="editor">
          <PostEditor />
        </TabsContent>
        <TabsContent value="posts">
          <PostsList />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
