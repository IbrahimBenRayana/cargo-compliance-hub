import * as React from 'react';
import { Check, Loader2, CreditCard, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscription, useSelectTier } from '@/hooks/useBilling';
import { CardCapture } from '@/components/billing/CardCapture';
import { PLAN_META, PUBLIC_TIERS } from '@/lib/planMeta';
import { cn } from '@/lib/utils';

/**
 * Optional onboarding step: pick a plan tier and add a card so the org is ready
 * to file. Adding a card is optional — signing up, browsing, and drafting are
 * free; the card is only needed to submit a filing. `onDone` advances the wizard
 * (whether they saved a card or skipped).
 */
export function OnboardingPaymentStep({ onDone }: { onDone: () => void }) {
  const { data: billing, isLoading } = useSubscription();
  const selectTier = useSelectTier();
  const [chosen, setChosen] = React.useState<string | null>(billing?.plan?.id ?? null);
  const [phase, setPhase] = React.useState<'pick' | 'card'>('pick');
  // Sales-led onboarding: the admin already chose this client's plan during the
  // meeting. When a plan is already assigned, skip the tier picker and go straight
  // to adding a card for that plan (don't ask them to choose again).
  const planPreassigned = React.useRef(false);
  const didInit = React.useRef(false);

  React.useEffect(() => {
    if (didInit.current || isLoading || !billing) return;
    didInit.current = true;
    if (billing.plan?.id && !billing.canFile) {
      setChosen(billing.plan.id);
      planPreassigned.current = true;
      setPhase('card');
    }
  }, [billing, isLoading]);

  // Already able to file (card on file or a $0 tier) — nothing to do here.
  if (!isLoading && billing?.canFile) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold mb-1">You're ready to file</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {billing.card
            ? `Card on file ending ${billing.card.last4}.`
            : 'Your plan is active.'}{' '}
          You're charged per shipment, only when CBP accepts it.
        </p>
        <Button onClick={onDone} className="w-full">Continue</Button>
      </div>
    );
  }

  async function choose(tierId: string) {
    try {
      const res = await selectTier.mutateAsync({ planId: tierId });
      setChosen(tierId);
      if (res.canFile) {
        toast.success('Plan selected.');
        onDone();
      } else {
        setPhase('card');
      }
    } catch (err) {
      toast.error((err as Error).message || 'Could not select that plan.');
    }
  }

  if (phase === 'card' && chosen) {
    const meta = PLAN_META[chosen];
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          {meta?.name} · {meta?.priceLabel} {meta?.priceFooter}. No charge now — you're billed per shipment, only when
          CBP accepts it.
        </p>
        <CardCapture
          submitLabel="Save card"
          onSaved={() => {
            toast.success('Card saved — you can file now.');
            onDone();
          }}
        />
        <div className="mt-4 flex items-center justify-between text-xs">
          {planPreassigned.current ? (
            <span />
          ) : (
            <button type="button" onClick={() => setPhase('pick')} className="text-muted-foreground hover:text-foreground">
              ← Change plan
            </button>
          )}
          <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-5">
        Pick a plan to set your per-shipment rate. Add a card now to be ready to file, or skip and add it the first time
        you submit — browsing and drafting are always free.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PUBLIC_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => choose(tier.id)}
            disabled={selectTier.isPending}
            className={cn(
              'relative flex flex-col rounded-xl border p-4 text-left transition-colors hover:border-foreground/30',
              tier.featured ? 'border-gold/60 ring-1 ring-gold/20' : 'border-border/60',
              selectTier.isPending && 'opacity-60',
            )}
          >
            {tier.featured && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-950">
                <Star className="h-2.5 w-2.5" /> Popular
              </span>
            )}
            <span className="text-sm font-semibold">{tier.name}</span>
            <span className="mt-1 text-2xl font-bold">{tier.priceLabel}</span>
            <span className="text-[11px] text-muted-foreground">{tier.priceFooter}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold-dark dark:text-gold">
              {selectTier.isPending && selectTier.variables?.planId === tier.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CreditCard className="h-3 w-3" />
              )}
              Choose
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onDone} className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground">
        Skip for now — I'll add a card when I file
      </button>
    </div>
  );
}
