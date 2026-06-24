import * as React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, AlertTriangle, ExternalLink, Receipt, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSubscription, useCreatePortalSession } from '@/hooks/useBilling';
import { CardCapture } from '@/components/billing/CardCapture';

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function BillingSettings() {
  const { data, isLoading } = useSubscription();
  const portal = useCreatePortalSession();
  const [editingCard, setEditingCard] = React.useState(false);

  function openPortal() {
    portal.mutate(undefined, {
      onSuccess: (d) => { window.location.href = d.url; },
      onError: () => toast.error('Could not open the billing portal.'),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading billing…
      </div>
    );
  }

  const plan = data?.plan ?? null;
  const card = data?.card ?? null;

  return (
    <div className="space-y-6">
      {data?.delinquent && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">A recent charge failed</p>
            <p className="text-muted-foreground">Update your card below to settle it and keep filing. We retry automatically once a working card is on file.</p>
          </div>
        </div>
      )}

      {/* Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Plan</CardTitle>
          <CardDescription>No subscription, no monthly fee — you're charged per shipment, only when CBP accepts it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{plan.name}</div>
                <div className="text-sm text-muted-foreground">
                  {plan.perFilingCents > 0 ? `${money(plan.perFilingCents)} per shipment filed` : 'Custom pricing'}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/upgrade">Change plan</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">No plan selected yet.</p>
              <Button size="sm" asChild><Link to="/upgrade">Choose a plan</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment method</CardTitle>
          <CardDescription>The card we charge for each accepted shipment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingCard ? (
            <div>
              <CardCapture
                submitLabel={card ? 'Update card' : 'Save card'}
                onSaved={() => { setEditingCard(false); toast.success('Card updated.'); }}
              />
              <button type="button" onClick={() => setEditingCard(false)} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          ) : card ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-muted"><CreditCard className="h-5 w-5" /></div>
                <div className="text-sm">
                  <div className="font-medium capitalize">{card.brand} •••• {card.last4}</div>
                  {card.expMonth && card.expYear && (
                    <div className="text-muted-foreground">Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}</div>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingCard(true)} disabled={!plan}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Update
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">No card on file. Add one to start filing.</p>
              <Button size="sm" onClick={() => setEditingCard(true)} disabled={!plan}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Add card
              </Button>
            </div>
          )}
          {!plan && !editingCard && (
            <p className="text-xs text-muted-foreground">Choose a plan first, then add a card.</p>
          )}
        </CardContent>
      </Card>

      {/* Usage + Stripe portal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">This month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Shipments charged</span>
            <span className="font-medium tabular-nums">{data?.usage.filingsBilled ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total charged</span>
            <span className="font-medium tabular-nums">{money(data?.usage.amountCents ?? 0)}</span>
          </div>
          <Separator />
          <Button variant="ghost" size="sm" onClick={openPortal} disabled={portal.isPending || !card} className="px-0">
            {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage cards &amp; receipts in Stripe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
