import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileStack, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PlanLimitModalProps {
  open: boolean;
  onClose: () => void;
  usage: { current: number; limit: number };
}

const TIERS: Array<{
  id: string;
  name: string;
  filings: number;
  seats: number;
  price: string;
}> = [
  { id: 'grower_monthly', name: 'Grower', filings: 15, seats: 3,  price: '$99/mo'  },
  { id: 'scale_monthly',  name: 'Scale',  filings: 60, seats: 10, price: '$299/mo' },
];

export function PlanLimitModal({ open, onClose, usage }: PlanLimitModalProps) {
  const navigate = useNavigate();
  const target = Math.min(100, Math.round((usage.current / Math.max(usage.limit, 1)) * 100));

  // One-shot progress fill on mount — eases from 0 → target so the bar
  // arrives with the modal instead of being already pinned. Respects
  // prefers-reduced-motion by skipping the animation entirely.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    if (!open) { setFill(0); return; }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setFill(target); return; }
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [open, target]);

  function go(planId?: string) {
    onClose();
    navigate(planId ? `/upgrade?plan=${planId}` : '/upgrade');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-amber-200/60 dark:border-amber-500/20 bg-white dark:bg-slate-950">
        {/* Header band — soft amber wash, no flashy gradient */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-b from-amber-50/80 to-transparent dark:from-amber-500/[0.06] dark:to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" strokeWidth={2.25} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">
              Monthly limit reached
            </div>
          </div>

          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-[19px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
              You've used all <span className="tabular-nums">{usage.limit}</span> filings on Starter this month.
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              Upgrade for higher monthly volume and more team seats. Your existing filings stay intact.
            </DialogDescription>
          </DialogHeader>

          {/* Progress strip */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-[11px] mb-1.5">
              <span className="font-medium text-slate-500 dark:text-slate-400">Monthly filings used</span>
              <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {usage.current}<span className="text-slate-400 dark:text-slate-500">/{usage.limit}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${fill}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tier comparison */}
        <div className="px-6 pt-5 pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 mb-2.5">
            Recommended upgrades
          </div>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className="group w-full flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-4 py-3 text-left transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">{t.name}</span>
                    <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">{t.price}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[12px] text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <FileStack className="h-3.5 w-3.5 text-slate-400" />
                      <span className="tabular-nums">{t.filings}</span>/mo
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="tabular-nums">{t.seats}</span> seats
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full font-semibold"
            onClick={() => go()}
          >
            Compare all plans
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={onClose}
          >
            Continue later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
