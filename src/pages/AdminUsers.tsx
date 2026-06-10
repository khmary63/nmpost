import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/proxy-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: "free" | "basic" | "pro";
  plan_active: boolean;
  period_end: string | null;
  posts_count: number;
  ai_text_count: number;
  ai_image_count: number;
  content_plan_count: number;
};

const PLAN_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  pro: "default",
  basic: "secondary",
  free: "outline",
};

export default function AdminUsers() {
  const { role, loading: authLoading, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !roleLoading && role !== "admin") {
      toast.error("Доступ только для администраторов");
      navigate("/dashboard");
    }
  }, [role, authLoading, roleLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-users");
    setLoading(false);
    if (error) {
      toast.error("Не удалось загрузить пользователей");
      return;
    }
    setUsers(data?.users || []);
  };

  useEffect(() => {
    if (role === "admin") load();
  }, [role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const exportExcel = () => {
    const rows = filtered.map((u) => ({
      Email: u.email,
      Имя: u.full_name,
      Телефон: u.phone,
      Провайдер: u.provider,
      Тариф: u.plan,
      "Активен": u.plan_active ? "да" : "нет",
      "Окончание периода": u.period_end ? new Date(u.period_end).toLocaleDateString("ru-RU") : "",
      "Постов в этом месяце": u.posts_count,
      "AI тексты": u.ai_text_count,
      "AI картинки": u.ai_image_count,
      "Контент-планы": u.content_plan_count,
      Регистрация: new Date(u.created_at).toLocaleString("ru-RU"),
      "Последний вход": u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("ru-RU") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
      { wch: 20 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Пользователи");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `users_${date}.xlsx`);
    toast.success("Excel-файл выгружен");
  };

  if (authLoading || roleLoading || role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = {
    total: users.length,
    pro: users.filter((u) => u.plan === "pro").length,
    basic: users.filter((u) => u.plan === "basic").length,
    free: users.filter((u) => u.plan === "free").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Пользователи
            </h1>
            <p className="text-sm text-muted-foreground">Все пользователи приложения</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Обновить
            </Button>
            <Button onClick={exportExcel} disabled={!filtered.length} className="gap-2">
              <Download className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Всего", value: stats.total },
            { label: "Free", value: stats.free },
            { label: "Basic", value: stats.basic },
            { label: "Pro", value: stats.pro },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по email, имени или телефону"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Пользователи не найдены</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Телефон</TableHead>
                      <TableHead>Тариф</TableHead>
                      <TableHead className="text-right">Постов</TableHead>
                      <TableHead className="text-right">AI текст</TableHead>
                      <TableHead className="text-right">AI img</TableHead>
                      <TableHead>Регистрация</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.full_name || "—"}</TableCell>
                        <TableCell>{u.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={PLAN_VARIANT[u.plan] || "outline"} className="uppercase">{u.plan}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{u.posts_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.ai_text_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.ai_image_count}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {new Date(u.created_at).toLocaleDateString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
