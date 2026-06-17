import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Lock, ShieldCheck, RefreshCw, Receipt, Loader2,
  ExternalLink, ArrowRight, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscription, useCreateCheckoutSession, useCreatePortalSession } from '@/hooks/useBilling';
import { PLAN_META, KNOWN_PLAN_IDS, PUBLIC_TIERS } from '@/lib/planMeta';
import { cn } from '@/lib/utils';

const PRICING_URL = 'https://mycargolens.com/pricing';

export default function UpgradePage() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan') ?? '';

  const { data: billing, isLoading: subLoading } = useSubscription();
  const checkoutMutation = useCreateCheckoutSession();
  const portalMutation = useCreatePortalSession();

  const meta = PLAN_META[planId];
  const isKnown = KNOWN_PLAN_IDS.includes(planId);

  function handleOpenPortal() {
    portalMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        toast.error('Could not open billing portal. Please try again.');
      },
    });
  }

  function handleCheckout(id: string) {
    const successUrl =
      `${window.location.origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${window.location.origin}/upgrade/cancel`;

    checkoutMutation.mutate(
      { planId: id, successUrl, cancelUrl },
      {
        onSuccess: (data) => {
          window.location.href = data.url;
        },
        onError: (err) => {
          const msg = (err as Error).message || 'Could not start checkout. Please try again.';
          toast.error(msg);
        },
      }
    );
  }

  const isPending = checkoutMutation.isPending || portalMutation.isPending;

  // ── No / unknown plan → tier picker ───────────────────────────────────
  if (!isKnown) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass rounded-2xl p-8 md:p-12 max-w-5xl w-full shadow-xl"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gradient-gold mb-3">
            Choose your tier
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Pick a plan to start filing
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-xl">
            No monthly fee — you're billed per shipment filed, invoiced monthly.
            Your tier sets your per-shipment rate and unlocks the features you need.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PUBLIC_TIERS.map((tier) => {
              const isCurrent = !subLoading && billing?.plan?.id === tier.id;
              return (
                <div
                  key={tier.id}
                  className={cn(
                    'relative flex flex-col rounded-2xl border bg-muted/30 p-6',
                    tier.featured
                      ? 'border-gold/60 ring-1 ring-gold/30'
                      : 'border-border/60'
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
                  {isCurrent ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleOpenPortal}
                      disabled={isPending}
                    >
                      {portalMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Manage subscription
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        'w-full font-semibold',
                        tier.featured
                          ? 'bg-gold text-yellow-950 hover:bg-gold/90'
                          : ''
                      )}
                      variant={tier.featured ? 'default' : 'outline'}
                      onClick={() => handleCheckout(tier.id)}
                      disabled={isPending}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Choose {tier.name}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-border/60">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              TLS encrypted
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Powered by Stripe
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              No monthly fee · billed per shipment
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Known plan ────────────────────────────────────────────────────────
  const currentPlanId = billing?.plan?.id;
  const isAlreadyOnPlan = !subLoading && currentPlanId === planId;

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-2xl p-8 md:p-12 max-w-3xl w-full shadow-xl"
      >
        {/* Top label */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gradient-gold mb-6">
          {isAlreadyOnPlan ? 'Your plan' : 'Activate your tier'}
        </p>

        {isAlreadyOnPlan ? (
          <div className="text-center py-6">
            <Check className="h-12 w-12 text-gold mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              You're already on {meta.name}
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              You're all set — your {meta.name} tier is active. You're billed{' '}
              {meta.priceLabel} {meta.priceFooter}, with no monthly fee.
            </p>
            <Button
              onClick={handleOpenPortal}
              disabled={isPending}
              className="bg-gold text-yellow-950 hover:bg-gold/90 font-semibold"
            >
              {portalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Manage subscription
            </Button>
          </div>
        ) : (
          <>
            {/* Plan name + tagline */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold text-foreground mb-1">{meta.name}</h1>
              <p className="text-muted-foreground text-sm">{meta.blurb}</p>
            </div>

            {/* Price block */}
            <div className="mb-6">
              <p className="text-6xl font-bold text-foreground">{meta.priceLabel}</p>
              <p className="text-muted-foreground text-sm mt-2">{meta.priceFooter}</p>
            </div>

            {/* No-monthly-fee callout */}
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 border border-border/60 px-4 py-3 mb-8">
              <Receipt className="h-5 w-5 text-gold shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/85 leading-relaxed">
                No monthly fee — you're only charged when you file. Usage is
                metered and invoiced monthly through Stripe.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-3 mb-10">
              {meta.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className="h-4 w-4 text-gold shrink-0 mt-0.5"
                    strokeWidth={2.5}
                  />
                  <span className="text-sm text-foreground/85 leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-4 mb-10 pb-8 border-b border-border/60">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                TLS encrypted
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Powered by Stripe
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Cancel anytime
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className={cn(
                  'flex-1 font-semibold bg-gold text-yellow-950 hover:bg-gold/90',
                  isPending && 'opacity-70 pointer-events-none'
                )}
                onClick={() => handleCheckout(planId)}
                disabled={isPending}
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Continue to secure payment
              </Button>
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="flex-shrink-0"
              >
                <a href={PRICING_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Back to pricing
                </a>
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
