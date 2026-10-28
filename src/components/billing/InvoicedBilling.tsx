import * as React from 'react';
import { Landmark, Loader2, AlertTriangle, ExternalLink, Receipt, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCreatePortalSession } from '@/hooks/useBilling';
import { CardCapture } from '@/components/billing/CardCapture';
import type { billingApi } from '@/api/client';
import { money } from '@/lib/pricing';

type Subscription = Awaited<ReturnType<typeof billingApi.subscription>>;

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
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">New filings are on hold</p>
            <p className="text-muted-foreground">An invoice is overdue. Contact us to settle it and keep filing. Drafts, amendments and cancellations still work.</p>
          </div>
        </div>
      )}

      {!canManage && <p className="text-sm text-muted-foreground">Only owners and admins can change billing.</p>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Plan</CardTitle>
          <CardDescription>Invoiced monthly. Only filings CBP accepts count.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold">{data.plan?.name}</div>
          <ul className="text-sm text-muted-foreground">
            {inv && inv.monthlyMinimumCents > 0 && (
              <li>{money(inv.monthlyMinimumCents)} a month, including {inv.includedIsfs} accepted ISFs</li>
            )}
            <li>
              {isfRate > 0 ? `${money(isfRate)} per accepted ISF` : 'ISFs at no charge'}
              {inv && inv.includedIsfs > 0 ? ` above the ${inv.includedIsfs} included` : ''}
            </li>
            {linked != null && entryOnly != null && (
              <>
                <li>{money(linked)} per entry on an ISF shipment</li>
                <li>{money(entryOnly)} per entry without an ISF</li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank account (ACH)</CardTitle>
          <CardDescription>Your monthly invoice is debited from this account when it is issued.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingBank ? (
            <div>
              <CardCapture
                method="us_bank_account"
                submitLabel={bank ? 'Update bank account' : 'Save bank account'}
                onSaved={() => { setEditingBank(false); toast.success('Bank account saved.'); }}
              />
              <button type="button" onClick={() => setEditingBank(false)} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          ) : bank ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-muted"><Landmark className="h-5 w-5" /></div>
                <div className="text-sm font-medium">{bank.bankName ?? 'Bank account'} •••• {bank.last4}</div>
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditingBank(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Update
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">No bank account yet. Until one is added, invoices arrive by email with a link to pay by ACH.</p>
              {canManage && (
                <Button size="sm" onClick={() => setEditingBank(true)}>
                  <Landmark className="h-3.5 w-3.5 mr-1.5" /> Add bank account
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">This month so far</CardTitle>
          <CardDescription>An estimate. Your invoice is issued after the month ends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Accepted ISFs</span>
            <span className="font-medium tabular-nums">{inv?.monthToDate.isfs ?? 0}</span>
          </div>
          {(inv?.monthToDate.lines ?? []).map((l) => (
            <div key={l.code} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{l.description}</span>
              <span className="font-medium tabular-nums">{money(l.amountCents)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Estimated total</span>
            <span className="font-semibold tabular-nums">{money(inv?.monthToDate.estimatedCents ?? 0)}</span>
          </div>
          {canManage && (
            <Button variant="ghost" size="sm" onClick={openPortal} disabled={portal.isPending} className="px-0">
              {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Invoices &amp; payment methods in Stripe
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
