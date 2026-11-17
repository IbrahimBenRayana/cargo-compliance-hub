import * as React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ExternalLink } from '@/components/icons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscription, useCreatePortalSession } from '@/hooks/useBilling';
import { useAuthStore } from '@/hooks/useAuth';
import { CardCapture } from '@/components/billing/CardCapture';
import { InvoicedBilling } from '@/components/billing/InvoicedBilling';
import { money, pricingLines } from '@/lib/pricing';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TEXT_BUTTON = 'mt-3 w-full rounded-md text-center text-[12px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground';

export function BillingSettings() {
  const { data, isLoading } = useSubscription();
  const portal = useCreatePortalSession();
  const [editingCard, setEditingCard] = React.useState(false);
  // Plan, card and the Stripe portal are owner/admin actions (the server
  // refuses everyone else); operators see the details but not the controls.
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'owner' || role === 'admin';

  function openPortal() {
    portal.mutate(undefined, {
      onSuccess: (d) => { window.location.href = d.url; },
      onError: () => toast.error('Could not open the billing portal.'),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading billing…
      </div>
    );
  }

  // Invoiced accounts (pilots, contracts) pay a monthly invoice by ACH.
  if (data?.billingMode === 'invoiced') return <InvoicedBilling data={data} canManage={canManage} />;

  const plan = data?.plan ?? null;
  const card = data?.card ?? null;

  return (
    <div className="space-y-6">
      {data?.delinquent && (
        <div role="alert" className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px]">
          <p className="font-semibold text-urgent">A recent charge failed</p>
          <p className="mt-0.5 text-foreground/80">{canManage ? 'Update your card below to settle it and keep filing.' : 'Ask an owner or admin to update the card to settle it and keep filing.'} We retry automatically once a working card is on file.</p>
        </div>
      )}

      {!canManage && (
        <p className="text-[13px] text-muted-foreground">Only owners and admins can change billing.</p>
      )}

      {/* Plan */}
      <section aria-labelledby="billing-plan-title" className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 id="billing-plan-title" className="text-[14px] font-semibold">Plan</h2>
          <p className="text-[13px] text-muted-foreground">No subscription, no monthly fee. You're charged per shipment, only when CBP accepts it.</p>
        </div>
        <div className="border-t border-border/70 px-5 py-4">
          {plan ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-[12px] text-muted-foreground">Current plan</p>
                <p className="mt-0.5 text-[14px] font-medium">{plan.name}</p>
                <ul className="mt-3 divide-y divide-border/60 text-[13px] tabular-nums">
                  {pricingLines(data?.pricing).map((line) => <li key={line} className="py-2">{line}</li>)}
                </ul>
                {plan.isPublic && <p className="mt-2 text-[12px] text-muted-foreground">Customs entries or volume pricing: talk to us.</p>}
              </div>
              {canManage && plan.isPublic && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/upgrade">Change plan</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">No plan selected yet.</p>
              {canManage && <Button size="sm" asChild><Link to="/upgrade">Choose a plan</Link></Button>}
            </div>
          )}
        </div>
      </section>

      {/* Payment method */}
      <section aria-labelledby="billing-card-title" className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 id="billing-card-title" className="text-[14px] font-semibold">Payment method</h2>
          <p className="text-[13px] text-muted-foreground">The card we charge for each accepted shipment.</p>
        </div>
        <div className="space-y-3 border-t border-border/70 px-5 py-4">
          {editingCard ? (
            <div>
              <CardCapture
                submitLabel={card ? 'Update card' : 'Save card'}
                onSaved={() => { setEditingCard(false); toast.success(card ? 'Card updated.' : 'Card saved.'); }}
              />
              <button type="button" onClick={() => setEditingCard(false)} className={TEXT_BUTTON}>
                Cancel
              </button>
            </div>
          ) : card ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dl className="min-w-0">
                <dt className="text-[12px] text-muted-foreground">Card on file</dt>
                <dd className="mt-0.5 text-[14px] font-medium capitalize tabular-nums">{card.brand} •••• {card.last4}</dd>
                {card.expMonth && card.expYear && (
                  <dd className="text-[12.5px] tabular-nums text-muted-foreground">Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}</dd>
                )}
              </dl>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditingCard(true)} disabled={!plan}>
                  Update
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">No card on file. Add one to start filing.</p>
              {canManage && (
                <Button size="sm" onClick={() => setEditingCard(true)} disabled={!plan}>
                  Add card
                </Button>
              )}
            </div>
          )}
          {canManage && !plan && !editingCard && (
            <p className="text-[12px] text-muted-foreground">Choose a plan first, then add a card.</p>
          )}
        </div>
      </section>

      {/* Usage + Stripe portal */}
      <section aria-labelledby="billing-month-title" className={PANEL}>
        <h2 id="billing-month-title" className="px-5 py-3.5 text-[14px] font-semibold">This month</h2>
        <dl className="divide-y divide-border/60 border-t border-border/70 px-5 text-[13px]">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Shipments charged</dt>
            <dd className="font-medium tabular-nums">{data?.usage.filingsBilled ?? 0}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Total charged</dt>
            <dd className="font-medium tabular-nums">{money(data?.usage.amountCents ?? 0)}</dd>
          </div>
        </dl>
        {canManage && (
          <div className="border-t border-border/70 px-5 py-3.5">
            <Button variant="outline" size="sm" onClick={openPortal} disabled={portal.isPending || !card}>
              {portal.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ExternalLink aria-hidden />}
              Manage cards and receipts in Stripe
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
