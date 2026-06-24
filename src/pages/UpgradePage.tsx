import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, ShieldCheck, Receipt, Loader2, ArrowRight, Star, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscription, useSelectTier } from '@/hooks/useBilling';
import { CardCapture } from '@/components/billing/CardCapture';
import { PLAN_META, KNOWN_PLAN_IDS, PUBLIC_TIERS } from '@/lib/planMeta';
import { cn } from '@/lib/utils';

/**
 * Pick (or change) a plan tier, then add a card if one isn't already on file.
 * No subscription, no Checkout redirect: choosing a tier is instant, and an
 * existing customer upgrading NEVER re-enters their card — the saved card
 * carries over and the new per-shipment rate applies to the next shipment.
 */
export default function UpgradePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const presetPlan = searchParams.get('plan') ?? '';

  const { data: billing, isLoading: subLoading } = useSubscription();
  const selectTier = useSelectTier();

  const [step, setStep] = React.useState<'pick' | 'card' | 'done'>('pick');
  const [chosen, setChosen] = React.useState<string>(KNOWN_PLAN_IDS.includes(presetPlan) ? presetPlan : '');

  const hasCard = !!billing?.card;
  const chosenMeta = chosen ? PLAN_META[chosen] : null;

  async function choose(tierId: string) {
    try {
      const res = await selectTier.mutateAsync({ planId: tierId });
      setChosen(tierId);
      const name = PLAN_META[tierId]?.name ?? 'your plan';
      if (res.canFile) {
        // Card already on file (an upgrade) or a $0 tier — done, no re-entry.
        setStep('done');
        toast.success(`You're on ${name} — your saved card carries over.`);
        setTimeout(() => navigate('/'), 1600);
      } else {
        setStep('card'); // need a card before they can file
      }
    } catch (err) {
      toast.error((err as Error).message || 'Could not select that plan. Please try again.');
    }
  }

  // ── Card step ─────────────────────────────────────────────────────────
  if (step === 'card' && chosenMeta) {
    return (
      <Shell label="Add your card">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Add a payment method</h1>
          <p className="text-sm text-muted-foreground">
            {chosenMeta.name} · {chosenMeta.priceLabel} {chosenMeta.priceFooter}. No charge now — you're billed per
            shipment, only when CBP accepts it.
          </p>
        </div>
        <CardCapture
          submitLabel="Save card & start filing"
          onSaved={() => {
            setStep('done');
            toast.success('All set — you can file now.');
            setTimeout(() => navigate('/'), 1200);
          }}
        />
        <button
          type="button"
          onClick={() => setStep('pick')}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          ← Choose a different plan
        </button>
      </Shell>
    );
  }

  // ── Done step ─────────────────────────────────────────────────────────
  if (step === 'done' && chosenMeta) {
    return (
      <Shell label="You're all set">
        <div className="text-center py-6">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-gold/15">
            <Check className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{chosenMeta.name} is active</h2>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </Shell>
    );
  }

  // ── Tier picker ───────────────────────────────────────────────────────
  return (
    <Shell label="Choose your tier" wide>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Pick a plan to start filing</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-xl">
        No subscription, no monthly fee. Your tier sets your flat per-shipment rate and unlocks its features. You're
        charged per shipment, only when CBP accepts it{hasCard ? ' — your saved card carries over.' : '.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PUBLIC_TIERS.map((tier) => {
          const isCurrent = !subLoading && billing?.plan?.id === tier.id;
          const busy = selectTier.isPending;
          return (
            <div
              key={tier.id}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-muted/30 p-6',
                tier.featured ? 'border-gold/60 ring-1 ring-gold/30' : 'border-border/60',
              )}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-yellow-950">
                  <Star className="h-3 w-3" /> Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold text-foreground">{tier.name}</h2>
              <p className="text-xs text-muted-foreground mb-4 min-h-[2rem]">{tier.blurb}</p>
              <div className="mb-4">
                <span className="text-4xl font-bold text-foreground">{tier.priceLabel}</span>
                <p className="text-xs text-muted-foreground mt-1">{tier.priceFooter}</p>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-xs text-foreground/85 leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={cn('w-full font-semibold', tier.featured ? 'bg-gold text-yellow-950 hover:bg-gold/90' : '')}
                variant={tier.featured ? 'default' : 'outline'}
                onClick={() => choose(tier.id)}
                disabled={busy || isCurrent}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : isCurrent ? null : hasCard ? (
                  <ArrowRight className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {isCurrent ? 'Current plan' : hasCard ? `Switch to ${tier.name}` : `Choose ${tier.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-border/60">
        <Badge icon={Lock}>TLS encrypted</Badge>
        <Badge icon={ShieldCheck}>Powered by Stripe</Badge>
        <Badge icon={Receipt}>No subscription · billed per shipment</Badge>
      </div>
    </Shell>
  );
}

function Shell({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn('glass rounded-2xl p-8 md:p-12 w-full shadow-xl', wide ? 'max-w-5xl' : 'max-w-lg')}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gradient-gold mb-6">{label}</p>
        {children}
      </motion.div>
    </div>
  );
}

function Badge({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
