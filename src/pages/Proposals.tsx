import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PlusCircle, Search, FileText } from "lucide-react";
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

const statuses = ["all", "draft", "sent", "viewed", "accepted", "rejected"];

export default function Proposals() {
  const { user, role } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let query = supabase
        .from("proposals")
        .select("id, title, status, total, created_at, clients(name)")
        .order("created_at", { ascending: false });

      if (role === "agent") {
        query = query.eq("user_id", user.id);
      }

      const { data } = await query;
      setProposals((data ?? []) as Proposal[]);
      setLoading(false);
    };
    load();
  }, [user, role]);

  const filtered = proposals
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.clients?.name ?? "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Proposals</h1>
            <p className="text-sm text-muted-foreground">
              {role === "admin" ? "All organization proposals" : "Your proposals"}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/proposals/new"><PlusCircle className="h-4 w-4" /> New Proposal</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search proposals..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statuses.map((s) => (
              <Button key={s} variant={statusFilter === s ? "secondary" : "ghost"} size="sm" onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">{search || statusFilter !== "all" ? "No matching proposals" : "No proposals yet"}</p>
                {!search && statusFilter === "all" && (
                  <Button size="sm" className="mt-4 gap-2" asChild>
                    <Link to="/proposals/new"><PlusCircle className="h-4 w-4" /> Create your first proposal</Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/proposals/${p.id}`}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{p.clients?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${Number(p.total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
