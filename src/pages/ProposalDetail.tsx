import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent text-accent-foreground",
  viewed: "bg-warning/10 text-warning",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("proposals").select("*, clients(name)").eq("id", id).single(),
      supabase.from("line_items").select("*").eq("proposal_id", id).order("sort_order"),
    ]).then(([pRes, liRes]) => {
      setProposal(pRes.data);
      setLineItems(liRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const updateStatus = async (status: string) => {
    await supabase.from("proposals").update({ status } as any).eq("id", id!);
    setProposal({ ...proposal, status });
    toast.success(`Status updated to ${status}`);
  };

  const copyShareLink = () => {
    if (proposal?.share_id) {
      navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.share_id}`);
      toast.success("Share link copied");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!proposal) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Proposal not found</p>
          <Button className="mt-4" onClick={() => navigate("/proposals")}>Back to proposals</Button>
        </div>
      </DashboardLayout>
    );
  }

  const sections = Array.isArray((proposal.content as any)?.sections) ? (proposal.content as any).sections : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proposals")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{proposal.title}</h1>
              <p className="text-sm text-muted-foreground">
                {proposal.clients?.name ?? "No client"} · Created {format(new Date(proposal.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={proposal.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["draft", "sent", "viewed", "accepted", "rejected"].map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {proposal.share_id && proposal.status !== "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={copyShareLink}><Copy className="mr-1 h-3.5 w-3.5" /> Copy Link</Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/p/${proposal.share_id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content sections */}
        {sections.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {sections.map((sec: any, idx: number) => (
                <div key={idx}>
                  <h3 className="font-display font-semibold text-card-foreground">{sec.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{sec.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        {lineItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell>{li.description}</TableCell>
                      <TableCell className="text-right">{li.quantity}</TableCell>
                      <TableCell className="text-right">${Number(li.rate).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{li.discount ?? 0}%</TableCell>
                      <TableCell className="text-right font-medium">${Number(li.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 border-t border-border pt-4 space-y-1 text-right">
                <div className="text-sm"><span className="text-muted-foreground mr-4">Subtotal</span>${Number(proposal.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                {Number(proposal.tax_rate) > 0 && (
                  <div className="text-sm"><span className="text-muted-foreground mr-4">Tax ({proposal.tax_rate}%)</span>${(Number(proposal.subtotal || 0) * Number(proposal.tax_rate) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                )}
                <div className="text-lg font-bold">${Number(proposal.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {proposal.notes && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{proposal.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
