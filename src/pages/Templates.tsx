import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, FileText, PlusCircle, Code, BarChart3, Megaphone, Briefcase, Layers } from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_default: boolean;
};

const categoryIcons: Record<string, any> = {
  web_design: Layers,
  consulting: Briefcase,
  development: Code,
  marketing: Megaphone,
  general: FileText,
};

const categoryLabels: Record<string, string> = {
  web_design: "Web Design",
  consulting: "Consulting",
  development: "Development",
  marketing: "Marketing",
  general: "General",
};

const categories = ["all", "web_design", "consulting", "development", "marketing", "general"];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("templates").select("id, name, description, category, is_default").order("name").then(({ data }) => {
      setTemplates((data ?? []) as Template[]);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? templates : templates.filter((t) => t.category === filter);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground">Choose a template to start a new proposal</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={filter === cat ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(cat)}
            >
              {cat === "all" ? "All" : categoryLabels[cat] ?? cat}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Start from blank */}
            <Card
              className="cursor-pointer border-dashed hover:border-primary/40 transition-colors"
              onClick={() => navigate("/proposals/new")}
            >
              <CardContent className="flex flex-col items-center justify-center h-48 gap-3">
                <PlusCircle className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-muted-foreground">Start from blank</p>
              </CardContent>
            </Card>

            {filtered.map((t) => {
              const Icon = categoryIcons[t.category] ?? FileText;
              return (
                <Card
                  key={t.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
                  onClick={() => navigate(`/proposals/new?template=${t.id}`)}
                >
                  <CardContent className="flex flex-col justify-between h-48 p-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                          <Icon className="h-4 w-4 text-accent-foreground" />
                        </div>
                        {t.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
                      </div>
                      <h3 className="font-display font-semibold text-card-foreground">{t.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {categoryLabels[t.category] ?? t.category}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No templates in this category</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
