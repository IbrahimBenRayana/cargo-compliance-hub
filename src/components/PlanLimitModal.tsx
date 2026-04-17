import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const PRICING_URL = 'https://mycargolens.com/pricing';

interface PlanLimitModalProps {
  open: boolean;
  onClose: () => void;
  usage: { current: number; limit: number };
}

export function PlanLimitModal({ open, onClose, usage }: PlanLimitModalProps) {
  const pct = Math.min(100, Math.round((usage.current / Math.max(usage.limit, 1)) * 100));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md glass border-amber-500/30">
        {/* Warning icon */}
        <div className="flex justify-center mb-2">
          <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-amber-500" strokeWidth={2} />
          </div>
        </div>

        <DialogHeader className="text-center space-y-2">
          <DialogTitle className="text-xl font-bold text-foreground">
            You've reached your monthly filing limit
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            You've used{' '}
            <span className="font-semibold text-foreground">{usage.current}</span> of{' '}
            <span className="font-semibold text-foreground">{usage.limit}</span> filings this month
            on the Starter plan. Upgrade to Grower or Scale for higher volume — starting at $99/month.
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Monthly filings used</span>
            <span>{usage.current}/{usage.limit}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <Button
            asChild
            size="lg"
            className="w-full font-semibold bg-gold text-yellow-950 hover:bg-gold/90"
          >
            <a href={PRICING_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View plans
            </a>
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={onClose}>
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
