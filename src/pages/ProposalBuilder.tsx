import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, PlusCircle, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

type Client = { id: string; name: string };
type Template = { id: string; name: string; sections: any; default_pricing_items: any };
type LineItem = { description: string; quantity: number; rate: number; discount: number };

const STEPS = ["Template", "Client", "Content", "Pricing", "Review"];

export default function ProposalBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [title, setTitle] = useState("Untitled Proposal");
  const [sections, setSections] = useState<{ title: string; content: string }[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, rate: 0, discount: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("templates").select("id, name, sections, default_pricing_items").order("name"),
      supabase.from("clients").select("id, name").order("name"),
    ]).then(([tRes, cRes]) => {
      setTemplates((tRes.data ?? []) as Template[]);
      setClients((cRes.data ?? []) as Client[]);

      const tmplId = searchParams.get("template");
      if (tmplId) {
        setSelectedTemplate(tmplId);
        const tmpl = (tRes.data ?? []).find((t: any) => t.id === tmplId);
        if (tmpl) {
          applyTemplate(tmpl as Template);
          setStep(1);
        }
      }
    });
  }, []);

  const applyTemplate = (tmpl: Template) => {
    const secs = Array.isArray(tmpl.sections) ? tmpl.sections.map((s: any) => ({ title: s.title ?? "", content: s.default_content ?? "" })) : [];
    setSections(secs);
    const items = Array.isArray(tmpl.default_pricing_items) ? tmpl.default_pricing_items.map((i: any) => ({
      description: i.description ?? "", quantity: i.quantity ?? 1, rate: i.rate ?? 0, discount: 0,
    })) : [];
    if (items.length > 0) setLineItems(items);
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplate(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) applyTemplate(tmpl);
  };

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.rate * (1 - i.discount / 100), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const addLineItem = () => setLineItems([...lineItems, { description: "", quantity: 1, rate: 0, discount: 0 }]);
  const removeLineItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase.from("proposals").insert({
      user_id: user.id,
      org_id: "00000000-0000-0000-0000-000000000001",
      title,
      client_id: selectedClient || null,
      template_id: selectedTemplate || null,
      content: { sections },
      pricing: { line_items: lineItems, tax_rate: taxRate },
      subtotal,
      tax_rate: taxRate,
      total,
      notes: notes || null,
      status: "draft",
    } as any).select("id").single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Insert line items
    if (data?.id) {
      const items = lineItems.map((li, idx) => ({
        proposal_id: data.id,
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        discount: li.discount,
        amount: li.quantity * li.rate * (1 - li.discount / 100),
        sort_order: idx,
      }));
      await supabase.from("line_items").insert(items);
    }

    toast.success("Proposal saved as draft");
    navigate(`/proposals/${data?.id}`);
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proposals")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">New Proposal</h1>
            <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex-1 rounded-full h-2 transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Step 0: Template */}
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Choose a template</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${!selectedTemplate ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  onClick={() => { setSelectedTemplate(""); setSections([]); }}
                >
                  <PlusCircle className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Blank</p>
                </div>
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={`cursor-pointer rounded-lg border-2 p-6 transition-colors ${selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    onClick={() => handleTemplateSelect(t.id)}
                  >
                    <p className="font-medium text-sm">{t.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Client */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Assign a client</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposal title" />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger><SelectValue placeholder="Select a client (optional)" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edit content</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setSections([...sections, { title: "", content: "" }])}>
                <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add Section
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No sections. Add one or go back to pick a template.</p>
              )}
              {sections.map((sec, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Input
                      value={sec.title}
                      onChange={(e) => {
                        const u = [...sections]; u[idx] = { ...u[idx], title: e.target.value }; setSections(u);
                      }}
                      placeholder="Section title"
                      className="font-medium border-0 p-0 h-auto text-base focus-visible:ring-0"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSections(sections.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={sec.content}
                    onChange={(e) => {
                      const u = [...sections]; u[idx] = { ...u[idx], content: e.target.value }; setSections(u);
                    }}
                    placeholder="Section content..."
                    rows={4}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pricing</CardTitle>
              <Button size="sm" variant="outline" onClick={addLineItem}>
                <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {idx === 0 && <Label className="text-xs">Description</Label>}
                    <Input value={item.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} placeholder="Item description" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {idx === 0 && <Label className="text-xs">Qty</Label>}
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {idx === 0 && <Label className="text-xs">Rate ($)</Label>}
                    <Input type="number" min={0} value={item.rate} onChange={(e) => updateLineItem(idx, "rate", Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {idx === 0 && <Label className="text-xs">Disc %</Label>}
                    <Input type="number" min={0} max={100} value={item.discount} onChange={(e) => updateLineItem(idx, "discount", Number(e.target.value))} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLineItem(idx)} disabled={lineItems.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-center gap-4">
                  <Label className="text-sm">Tax Rate (%)</Label>
                  <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-24" />
                </div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                {taxRate > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span className="font-medium">${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Review & Save</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{title}</span></div>
                <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{clients.find(c => c.id === selectedClient)?.name ?? "None"}</span></div>
                <div><span className="text-muted-foreground">Template:</span> <span className="font-medium">{templates.find(t => t.id === selectedTemplate)?.name ?? "Blank"}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes..." rows={3} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
