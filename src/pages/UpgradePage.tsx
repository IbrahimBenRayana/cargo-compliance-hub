import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Lock, ShieldCheck, RefreshCw, Users, FileText, Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscription, useCreateCheckoutSession, useCreatePortalSession } from '@/hooks/useBilling';
import { PLAN_META, KNOWN_PLAN_IDS } from '@/lib/planMeta';
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

  // Unknown / missing plan
  if (!isKnown) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-10 max-w-md w-full text-center"
        >
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">Invalid Plan</p>
          <h1 className="text-2xl font-semibold text-foreground mb-4">Plan not found</h1>
          <p className="text-muted-foreground mb-8 text-sm">
            The plan you're looking for doesn't exist. Head back to pricing to choose a plan.
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href={PRICING_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View pricing plans
            </a>
          </Button>
        </motion.div>
      </div>
    );
  }

  // Already on this plan
  const currentPlanId = billing?.plan?.id;
  const isAlreadyOnPlan = !subLoading && currentPlanId === planId;

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

  function handleCheckout() {
    const successUrl =
      `${window.location.origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${window.location.origin}/upgrade/cancel`;

    checkoutMutation.mutate(
      { planId, successUrl, cancelUrl },
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
          Upgrade your plan
        </p>

        {isAlreadyOnPlan ? (
          <div className="text-center py-6">
            <Check className="h-12 w-12 text-gold mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              You're already on {meta.name}
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              You're all set — your {meta.name} plan is active.
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
              <p className="text-muted-foreground text-sm">
                {meta.tier === 'Grower'
                  ? 'For small importers with consistent volume'
                  : 'For growing teams and 3PLs'}
              </p>
            </div>

            {/* Price block */}
            <div className="mb-6">
              <p className="text-6xl font-bold text-foreground">{meta.priceLabel}</p>
              <p className="text-muted-foreground text-sm mt-2">{meta.priceFooter}</p>
            </div>

            {/* Stats pills */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/60 px-4 py-3">
                <FileText className="h-5 w-5 text-gold shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Filings</p>
                  <p className="text-sm font-semibold text-foreground">
                    {meta.filings}/month
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/60 px-4 py-3">
                <Users className="h-5 w-5 text-gold shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Team seats</p>
                  <p className="text-sm font-semibold text-foreground">Up to {meta.seats}</p>
                </div>
              </div>
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
                onClick={handleCheckout}
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
