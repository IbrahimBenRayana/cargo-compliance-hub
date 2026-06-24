import * as React from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingApi } from '@/api/client';
import { useCreateSetupIntent, useSaveCard } from '@/hooks/useBilling';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';

/**
 * Card-on-file capture via Stripe Elements. Loads the publishable key from the
 * backend (works for staging-test / prod-live with the same bundle), creates a
 * SetupIntent (saves the card WITHOUT charging), confirms it client-side, then
 * persists it as the org's default payment method. Calls `onSaved` on success.
 */

// Memoize the Stripe.js promise per publishable key (loadStripe must run once).
const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(pk: string): Promise<Stripe | null> {
  if (!stripeCache.has(pk)) stripeCache.set(pk, loadStripe(pk));
  return stripeCache.get(pk)!;
}

function CardForm({ onSaved, submitLabel }: { onSaved?: () => void; submitLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const saveCard = useSaveCard();
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        toast.error(error.message || 'Could not save the card. Please try again.');
        return;
      }
      if (!setupIntent?.id) {
        toast.error('Card setup did not complete. Please try again.');
        return;
      }
      await saveCard.mutateAsync({ setupIntentId: setupIntent.id });
      toast.success('Card saved.');
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the card.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <Button type="submit" className="w-full" size="lg" disabled={!stripe || submitting}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        {submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your card is stored securely by Stripe. No charge now — you're only billed per shipment, when CBP accepts it.
      </p>
    </form>
  );
}

export function CardCapture({ onSaved, submitLabel = 'Save card' }: { onSaved?: () => void; submitLabel?: string }) {
  const config = useQuery({ queryKey: ['billing', 'config'], queryFn: () => billingApi.config() });
  const setupIntent = useCreateSetupIntent();
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const started = React.useRef(false);

  // Create the SetupIntent once the component mounts.
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    setupIntent
      .mutateAsync()
      .then((r) => setClientSecret(r.clientSecret))
      .catch(() => {
        /* surfaced below */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (config.isLoading || setupIntent.isPending || !clientSecret) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing secure card form…
      </div>
    );
  }
  if (config.isError || setupIntent.isError || !config.data?.publishableKey) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Could not load the secure card form. Please refresh and try again.
      </div>
    );
  }

  return (
    <Elements
      stripe={getStripePromise(config.data.publishableKey)}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0b1f3a' } } }}
    >
      <CardForm onSaved={onSaved} submitLabel={submitLabel} />
    </Elements>
  );
}
