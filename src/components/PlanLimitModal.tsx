import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Lock, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Capability,
  CAPABILITY_LABEL,
  PUBLIC_TIERS,
  minTierForCapability,
} from '@/lib/planMeta';

interface PlanLimitModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When set, the modal explains that the current plan doesn't include this
   * capability and highlights the cheapest tier that unlocks it (the
   * `feature_not_in_plan` / 403 case). When omitted, it's the "no active plan"
   * case (`subscription_required` / 402) — choose any plan to submit filings.
   */
  capability?: Capability;
}

/**
 * Reusable upgrade modal. Two situations, one component:
 *  (a) no active plan      → "Choose a plan to submit filings"
 *  (b) feature not in plan  → pass `capability` to highlight the unlocking tier
 *
 * Tier data comes from PLAN_META / PUBLIC_TIERS (the single source of truth) —
 * no hardcoded prices. CTAs link to /upgrade?plan=<id>.
 */
export function PlanLimitModal({ open, onClose, capability }: PlanLimitModalProps) {
  const navigate = useNavigate();
  const unlockingTier = capability ? minTierForCapability(capability) : undefined;
  const featureLabel = capability ? CAPABILITY_LABEL[capability] : null;

  // One-shot entrance: ease cards in from 0 → 1 on open. Respects
  // prefers-reduced-motion by skipping the transition entirely.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setEntered(true); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  function go(planId?: string) {
    onClose();
    navigate(planId ? `/upgrade?plan=${planId}` : '/upgrade');
  }

  const title = featureLabel
    ? `Unlock ${featureLabel}`
    : 'Choose a plan to submit filings';
  const description = featureLabel
    ? unlockingTier
      ? `${featureLabel} isn't part of your current plan. Upgrade to ${unlockingTier.name} to start using it — billed per shipment, no monthly fee.`
      : `${featureLabel} isn't part of your current plan.`
    : 'You need an active plan to submit filings. Pick the tier that matches your work — pay per shipment filed, no monthly fee.';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-white dark:bg-slate-950">
        {/* Header band */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-b from-primary/[0.06] to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-primary" strokeWidth={2.25} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/80">
              {featureLabel ?? 'Upgrade required'}
            </div>
          </div>

          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-[19px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tier cards */}
        <div className="px-6 pt-4 pb-4">
          <div className="space-y-2.5">
            {PUBLIC_TIERS.map((tier, i) => {
              const recommended = unlockingTier
                ? tier.id === unlockingTier.id
                : tier.featured;
              return (
                <button
                  key={tier.id}
                  onClick={() => go(tier.id)}
                  style={{ transitionDelay: entered ? `${i * 40}ms` : '0ms' }}
                  className={cn(
                    'group w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-300 cursor-pointer',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    'motion-reduce:transition-none',
                    entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5',
                    recommended
                      ? 'border-primary/50 bg-primary/[0.04] hover:bg-primary/[0.07] ring-1 ring-primary/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                          {tier.name}
                        </span>
                        {recommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            <Sparkles className="h-3 w-3" />
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                        {tier.blurb}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {tier.features.slice(0, 3).map((feat) => (
                          <li
                            key={feat}
                            className="flex items-start gap-1.5 text-[12px] text-slate-600 dark:text-slate-400"
                          >
                            <Check className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {tier.priceLabel}
                      </div>
                      <div className="text-[10.5px] text-slate-400 dark:text-slate-500 leading-tight">
                        {tier.priceFooter}
                      </div>
                      <ArrowRight className="ml-auto mt-2 h-4 w-4 text-slate-400 group-hover:text-primary transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => go()}
          >
            Compare all plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
