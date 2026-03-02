import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Copy, ExternalLink, Pencil, Shield, CalendarIcon, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  
  // Share settings
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState<Date | undefined>();
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("proposals").select("*, clients(name)").eq("id", id).single(),
      supabase.from("line_items").select("*").eq("proposal_id", id).order("sort_order"),
    ]).then(([pRes, liRes]) => {
      setProposal(pRes.data);
      setLineItems(liRes.data ?? []);
      if (pRes.data?.share_expires_at) {
        setShareExpiresAt(new Date(pRes.data.share_expires_at));
      }
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

  const saveShareSettings = async () => {
    setSavingShare(true);
    const updates: any = {
      share_expires_at: shareExpiresAt?.toISOString() ?? null,
    };

    // If a new password is set, hash it server-side via RPC
    if (sharePassword.trim()) {
      const { data: hash } = await (supabase.rpc as any)("hash_share_password", {
        _password: sharePassword,
      });
      updates.share_password_hash = hash;
    }

    await supabase.from("proposals").update(updates).eq("id", id!);
    setProposal({ ...proposal, ...updates, share_expires_at: shareExpiresAt?.toISOString() ?? null });
    toast.success("Share settings updated");
    setSharePassword("");
    setSavingShare(false);
    setShareDialogOpen(false);
  };

  const removeSharePassword = async () => {
    await supabase.from("proposals").update({ share_password_hash: null } as any).eq("id", id!);
    setProposal({ ...proposal, share_password_hash: null });
    toast.success("Share password removed");
  };

  const removeShareExpiration = async () => {
    await supabase.from("proposals").update({ share_expires_at: null } as any).eq("id", id!);
    setProposal({ ...proposal, share_expires_at: null });
    setShareExpiresAt(undefined);
    toast.success("Share expiration removed");
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
            {proposal.status === "draft" && (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate(`/proposals/${id}/edit`)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {proposal.share_id && proposal.status !== "draft" && (
              <>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={copyShareLink}><Copy className="mr-1 h-3.5 w-3.5" /> Copy Link</Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <a href={`/p/${proposal.share_id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview
                  </a>
                </Button>
                <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      <Shield className="mr-1 h-3.5 w-3.5" /> Share Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share Settings</DialogTitle>
                      <DialogDescription>Configure password protection and expiration for this shared proposal link.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Password protection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Lock className="h-4 w-4" /> Password Protection
                        </Label>
                        {proposal.share_password_hash ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Password set</Badge>
                            <Button variant="ghost" size="sm" onClick={removeSharePassword}>
                              <X className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No password set — anyone with the link can view.</p>
                        )}
                        <Input
                          type="password"
                          placeholder={proposal.share_password_hash ? "Set new password" : "Set a password (optional)"}
                          value={sharePassword}
                          onChange={(e) => setSharePassword(e.target.value)}
                        />
                      </div>

                      {/* Expiration */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" /> Link Expiration
                        </Label>
                        {proposal.share_expires_at && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Expires {format(new Date(proposal.share_expires_at), "MMM d, yyyy")}</Badge>
                            <Button variant="ghost" size="sm" onClick={removeShareExpiration}>
                              <X className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          </div>
                        )}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !shareExpiresAt && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {shareExpiresAt ? format(shareExpiresAt, "PPP") : "Set expiration date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={shareExpiresAt}
                              onSelect={setShareExpiresAt}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Cancel</Button>
                      <Button onClick={saveShareSettings} disabled={savingShare}>
                        {savingShare ? "Saving…" : "Save Settings"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Share protection indicators */}
        {proposal.status !== "draft" && (proposal.share_password_hash || proposal.share_expires_at) && (
          <div className="flex flex-wrap gap-2">
            {proposal.share_password_hash && (
              <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Password-protected</Badge>
            )}
            {proposal.share_expires_at && (
              <Badge variant="outline" className="gap-1"><CalendarIcon className="h-3 w-3" /> Expires {format(new Date(proposal.share_expires_at), "MMM d, yyyy")}</Badge>
            )}
          </div>
        )}

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
