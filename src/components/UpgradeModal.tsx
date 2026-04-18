import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { PLAN_LABELS, type PlanTier } from "@/hooks/useSubscription";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentPlan: PlanTier;
  reason?: string;
}

export function UpgradeModal({ open, onOpenChange, feature, currentPlan, reason }: UpgradeModalProps) {
  const navigate = useNavigate();
  const recommended: PlanTier = currentPlan === "free" ? "basic" : "pro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Доступно на платных тарифах</DialogTitle>
          <DialogDescription className="text-center">
            Функция «{feature}» недоступна на тарифе{" "}
            <span className="font-medium text-foreground">{PLAN_LABELS[currentPlan]}</span>.
            {reason ? <> {reason}</> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-primary/30 bg-accent/30 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Рекомендуем</p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">
            Тариф «{PLAN_LABELS[recommended]}»
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Не сейчас
          </Button>
          <Button className="w-full" onClick={() => { onOpenChange(false); navigate("/pricing"); }}>
            Перейти к тарифам
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
