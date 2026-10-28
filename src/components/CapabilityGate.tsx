import { Link } from 'react-router-dom';
import { Lock, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/hooks/useBilling';
import {
  type Capability,
  CAPABILITY_LABEL,
  TALK_TO_US_URL,
  minTierForCapability,
} from '@/lib/planMeta';

interface CapabilityGateProps {
  capability: Capability;
  children: React.ReactNode;
}

/**
 * Route-level (or inline) capability gate. Renders `children` only when the
 * org's active plan includes `capability`. While entitlements load we show a
 * neutral spinner — never flash the locked panel before we know the truth.
 *
 * When locked, renders an "Upgrade to unlock" panel IN PLACE (the URL is kept
 * — we never redirect) naming the self-serve plan that unlocks the feature, or,
 * for features our team sets up per account (entries etc.), a "talk to us".
 *
 * This is cosmetic only; the server enforces the real boundary (402/403).
 */
export function CapabilityGate({ capability, children }: CapabilityGateProps) {
  const { isLoading, can } = useCapabilities();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" aria-busy="true" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
        <span className="sr-only">Checking your plan…</span>
      </div>
    );
  }

  if (can(capability)) {
    return <>{children}</>;
  }

  return <UpgradePanel capability={capability} />;
}

function UpgradePanel({ capability }: { capability: Capability }) {
  const featureLabel = CAPABILITY_LABEL[capability];
  const tier = minTierForCapability(capability);

  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-lg border-border/60 shadow-sm">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {featureLabel}
            </div>
            <CardTitle className="text-[20px] leading-tight font-semibold">
              {tier ? `Upgrade to unlock ${featureLabel}` : `${featureLabel} isn't on your plan yet`}
            </CardTitle>
            <CardDescription className="text-[13.5px] leading-relaxed">
              {tier ? (
                <>
                  {featureLabel} is included in the{' '}
                  <span className="font-semibold text-foreground">{tier.name}</span> plan
                  {' '}({tier.priceLabel} {tier.priceFooter}). Upgrade your account to
                  start using it.
                </>
              ) : (
                <>{featureLabel} is set up for your account by our team, with pricing that fits your volume. Talk to us to add it.</>
              )}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {tier && (
            <ul className="space-y-2">
              {tier.features.slice(0, 4).map((feat) => (
                <li key={feat} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          )}

          <Button asChild size="lg" className="w-full font-semibold">
            {tier ? (
              <Link to={`/upgrade?plan=${tier.id}`}>
                Upgrade to {tier.name}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            ) : (
              <a href={TALK_TO_US_URL} target="_blank" rel="noreferrer">
                Talk to us
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
