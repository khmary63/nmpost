import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Users, DollarSign, Clock, PlusCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

type Proposal = {
  id: string;
  title: string;
  status: string;
  total: number;
  created_at: string;
  clients: { name: string } | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent text-accent-foreground",
  viewed: "bg-warning/10 text-warning",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export default function Dashboard() {
  const { user, role } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Agents see own, admins/managers see all org proposals
      let query = supabase
        .from("proposals")
        .select("id, title, status, total, created_at, clients(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (role === "agent") {
        query = query.eq("user_id", user.id);
      }

      const { data } = await query;
      const rows = (data ?? []) as Proposal[];
      setProposals(rows);

      const total = rows.length;
      const pending = rows.filter((p) => p.status === "sent" || p.status === "viewed").length;
      const accepted = rows.filter((p) => p.status === "accepted").length;
      const revenue = rows.filter((p) => p.status === "accepted").reduce((s, p) => s + (Number(p.total) || 0), 0);
      setStats({ total, pending, accepted, revenue });
      setLoading(false);
    };
    load();
  }, [user, role]);

  const statCards = [
    { label: "Total Proposals", value: stats.total, icon: FileText, color: "text-primary" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Accepted", value: stats.accepted, icon: Users, color: "text-success" },
    { label: "Revenue", value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {role === "admin" ? "Organization-wide overview" : "Your proposals and activity"}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/proposals/new"><PlusCircle className="h-4 w-4" /> New Proposal</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-accent ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold font-display text-card-foreground">{loading ? "—" : s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="font-display text-lg">Recent Proposals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/proposals" className="gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : proposals.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No proposals yet</p>
                <Button size="sm" className="mt-4 gap-2" asChild>
                  <Link to="/proposals/new"><PlusCircle className="h-4 w-4" /> Create your first proposal</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {proposals.map((p) => (
                  <Link
                    key={p.id}
                    to={`/proposals/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-card-foreground truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.clients?.name ?? "No client"} · {format(new Date(p.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium text-card-foreground">${Number(p.total || 0).toLocaleString()}</span>
                      <Badge variant="outline" className={statusColors[p.status]}>
                        {p.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
