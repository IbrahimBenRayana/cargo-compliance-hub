import * as React from 'react';
import { Loader2, ExternalLink } from '@/components/icons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreatePortalSession } from '@/hooks/useBilling';
import { CardCapture } from '@/components/billing/CardCapture';
import type { billingApi } from '@/api/client';
import { isfBandLines, money } from '@/lib/pricing';

type Subscription = Awaited<ReturnType<typeof billingApi.subscription>>;

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

/**
 * Settings → Billing for an invoiced account (paid pilots, contracts): no
 * per-filing card charge. Accepted filings accrue for one monthly Stripe
 * invoice, debited from the saved US bank account (ACH Direct Debit).
 */
export function InvoicedBilling({ data, canManage }: { data: Subscription; canManage: boolean }) {
  const portal = useCreatePortalSession();
  const [editingBank, setEditingBank] = React.useState(false);
  const inv = data.invoicing;
  const bank = inv?.bankAccount ?? null;
  const isfRate = data.pricing?.isfCents ?? 0;
  const linked = data.pricing?.entryLinkedCents;
  const entryOnly = data.pricing?.entryOnlyCents;

  function openPortal() {
    portal.mutate(undefined, {
      onSuccess: (d) => { window.location.href = d.url; },
      onError: () => toast.error('Could not open the billing portal.'),
    });
  }

  return (
    <div className="space-y-6">
      {data.billingHold && (
        <div role="alert" className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px]">
          <p className="font-semibold text-urgent">New filings are on hold</p>
          <p className="mt-0.5 text-foreground/80">An invoice is overdue. Contact us to settle it and keep filing. Drafts, amendments and cancellations still work.</p>
        </div>
      )}

      {!canManage && <p className="text-[13px] text-muted-foreground">Only owners and admins can change billing.</p>}

      <section aria-labelledby="invoiced-plan-title" className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 id="invoiced-plan-title" className="text-[14px] font-semibold">Plan</h2>
          <p className="text-[13px] text-muted-foreground">Invoiced monthly. Only filings CBP accepts count.</p>
        </div>
        <div className="border-t border-border/70 px-5 py-4">
          <p className="text-[12px] text-muted-foreground">Current plan</p>
          <p className="mt-0.5 text-[14px] font-medium">{data.plan?.name}</p>
          <ul className="mt-3 divide-y divide-border/60 text-[13px] tabular-nums [&>li]:py-2">
            {inv && inv.monthlyMinimumCents > 0 && (
              <li>{money(inv.monthlyMinimumCents)} a month, including {inv.includedIsfs} accepted ISFs</li>
            )}
            <li>
              {isfRate > 0 ? `${money(isfRate)} per accepted ISF` : 'ISFs at no charge'}
              {inv && inv.includedIsfs > 0 ? ` above the ${inv.includedIsfs} included` : ''}
            </li>
            {isfBandLines(inv?.isfBands).map((line) => <li key={line}>{line}</li>)}
            {linked != null && entryOnly != null && (
              <>
                <li>{money(linked)} per entry on an ISF shipment</li>
                <li>{money(entryOnly)} per entry without an ISF</li>
              </>
            )}
          </ul>
        </div>
      </section>

      <section aria-labelledby="invoiced-bank-title" className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 id="invoiced-bank-title" className="text-[14px] font-semibold">Bank account (ACH)</h2>
          <p className="text-[13px] text-muted-foreground">Your monthly invoice is debited from this account when it is issued.</p>
        </div>
        <div className="border-t border-border/70 px-5 py-4">
          {editingBank ? (
            <div>
              <CardCapture
                method="us_bank_account"
                submitLabel={bank ? 'Update bank account' : 'Save bank account'}
                onSaved={() => { setEditingBank(false); toast.success('Bank account saved.'); }}
              />
              <button
                type="button"
                onClick={() => setEditingBank(false)}
                className="mt-3 w-full rounded-md text-center text-[12px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : bank ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dl className="min-w-0">
                <dt className="text-[12px] text-muted-foreground">Account on file</dt>
                <dd className="mt-0.5 text-[14px] font-medium tabular-nums">{bank.bankName ?? 'Bank account'} •••• {bank.last4}</dd>
              </dl>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditingBank(true)}>
                  Update
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 basis-64 text-[13px] text-muted-foreground">No bank account yet. Until one is added, invoices arrive by email with a link to pay by ACH.</p>
              {canManage && (
                <Button size="sm" onClick={() => setEditingBank(true)}>
                  Add bank account
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="invoiced-month-title" className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 id="invoiced-month-title" className="text-[14px] font-semibold">This month so far</h2>
          <p className="text-[13px] text-muted-foreground">An estimate. Your invoice is issued after the month ends.</p>
        </div>
        <dl className="divide-y divide-border/60 border-t border-border/70 px-5 text-[13px]">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Accepted ISFs</dt>
            <dd className="font-medium tabular-nums">{inv?.monthToDate.isfs ?? 0}</dd>
          </div>
          {(inv?.monthToDate.lines ?? []).map((l) => (
            <div key={l.code} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{l.description}</dt>
              <dd className="font-medium tabular-nums">{money(l.amountCents)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-medium">Estimated total</dt>
            <dd className="text-[14px] font-semibold tabular-nums">{money(inv?.monthToDate.estimatedCents ?? 0)}</dd>
          </div>
        </dl>
        {canManage && (
          <div className="border-t border-border/70 px-5 py-3.5">
            <Button variant="outline" size="sm" onClick={openPortal} disabled={portal.isPending}>
              {portal.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ExternalLink aria-hidden />}
              Invoices and payment methods in Stripe
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
