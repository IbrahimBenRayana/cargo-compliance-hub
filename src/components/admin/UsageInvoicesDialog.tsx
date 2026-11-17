import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ExternalLink, FileText, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';
import { money } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';

const TH = 'py-2 text-left text-[12px] font-medium text-muted-foreground';

/** Display only: the colour of an invoice status pill. Unknown statuses stay neutral. */
const STATUS_TONE: Record<string, Tone> = {
  paid: 'done', open: 'info', error: 'urgent', uncollectible: 'urgent',
};

/** The last full UTC month, as YYYY-MM. */
function lastMonth(): string {
  const d = new Date();
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return m.toISOString().slice(0, 7);
}

/**
 * A client's month: what the usage invoice would bill, the CSV of every
 * accepted shipment, and (invoiced accounts) drafting the month's Stripe
 * invoice. Drafts are reviewed and finalized in the Stripe dashboard, which
 * then debits the client's bank account or emails the invoice.
 */
export function UsageInvoicesDialog({ org, onClose }: { org: AdminOrganization | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(lastMonth());
  const invoiced = org?.billing?.mode === 'invoiced';
  const validPeriod = /^\d{4}-\d{2}$/.test(period);

  const preview = useQuery({
    queryKey: ['admin', 'usage', org?.id, period],
    queryFn: () => adminApi.usage(org!.id, period),
    enabled: !!org && validPeriod,
  });
  const invoices = useQuery({
    queryKey: ['admin', 'invoices', org?.id],
    queryFn: () => adminApi.invoices(org!.id),
    enabled: !!org,
  });

  const download = useMutation({
    mutationFn: () => adminApi.usageCsv(org!.id, period),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Could not download the usage CSV'),
  });

  const draft = useMutation({
    mutationFn: (kind: 'usage' | 'prepay') => adminApi.createInvoice(org!.id, { period, kind }),
    onSuccess: (r) => {
      toast.success(`Draft invoice for ${money(r.invoice.totalCents)} created in Stripe`, {
        action: { label: 'Open', onClick: () => window.open(r.invoice.dashboardUrl, '_blank', 'noreferrer') },
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices', org?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage', org?.id] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not create the invoice'),
  });

  const p = preview.data;

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usage and invoices</DialogTitle>
          <DialogDescription>
            {org?.name}: filings CBP accepted in a month (UTC).
            {invoiced ? ' Draft the monthly invoice here, then review and finalize it in Stripe.' : ' This client pays by card per filing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="usage-month">Month</Label>
              <Input id="usage-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44 tabular-nums" />
            </div>
            <Button variant="outline" onClick={() => download.mutate()} disabled={!validPeriod || download.isPending}>
              {download.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Download aria-hidden />}
              Usage CSV
            </Button>
          </div>

          {invoiced && (
            <section aria-label="Usage for the month" className="border-t border-border/70 pt-4 text-[13px]">
              {preview.isLoading ? (
                <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Rating the month…</div>
              ) : p ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <h3 className="text-[13px] font-semibold">{p.closed ? 'Usage invoice would bill' : 'Month to date (not closed yet)'}</h3>
                    <span className="text-[12px] tabular-nums text-muted-foreground">{p.isfCount} ISFs · {p.accruedShipments} shipments</span>
                  </div>
                  {p.lines.length === 0 && <p className="mt-2 text-muted-foreground">Nothing to invoice.</p>}
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="sr-only">
                        <tr><th scope="col">Line</th><th scope="col">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {p.lines.map((l) => (
                          <tr key={l.code}>
                            <td className="py-2 pr-4 text-muted-foreground">{l.description}</td>
                            <td className="py-2 text-right tabular-nums">{money(l.amountCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border/70 font-medium">
                          <th scope="row" className="py-2 pr-4 text-left font-medium">Total</th>
                          <td className="py-2 text-right tabular-nums">{money(p.totalCents)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => draft.mutate('usage')} disabled={draft.isPending || !p?.closed || !p?.totalCents}>
                  {draft.isPending && draft.variables === 'usage' ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <FileText aria-hidden />}
                  Draft usage invoice
                </Button>
                <Button size="sm" variant="outline" onClick={() => draft.mutate('prepay')} disabled={draft.isPending || !org?.billing?.monthlyMinimumCents}>
                  {draft.isPending && draft.variables === 'prepay' && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
                  Bill this month's minimum in advance
                </Button>
              </div>
              {!p?.closed && <p className="mt-2 text-[12px] text-muted-foreground">A usage invoice can be drafted once the month has ended.</p>}
            </section>
          )}

          {invoiced && (
            <section aria-labelledby="usage-invoices-title" className="border-t border-border/70 pt-4">
              <h3 id="usage-invoices-title" className="text-[13px] font-semibold">Invoices</h3>
              {(invoices.data?.invoices ?? []).length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">None yet.</p>
              ) : (
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/70">
                        <th scope="col" className={TH}>Month</th>
                        <th scope="col" className={cn(TH, 'px-3')}>Type</th>
                        <th scope="col" className={cn(TH, 'text-right')}>Amount</th>
                        <th scope="col" className={cn(TH, 'pl-3')}>Status</th>
                        <th scope="col" aria-label="Stripe" className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {invoices.data!.invoices.map((i) => {
                        const tone = STATUS_TONE[i.status] ?? 'calm';
                        return (
                          <tr key={i.id}>
                            <td className="whitespace-nowrap py-2 align-top tabular-nums">{i.period}</td>
                            <td className="px-3 py-2 align-top">
                              {i.kind === 'prepay' ? 'Minimum in advance' : 'Usage'}
                              {i.lastError && <span className="block text-xs text-urgent">{i.lastError}</span>}
                            </td>
                            <td className="py-2 text-right align-top tabular-nums">{money(i.totalCents)}</td>
                            <td className="py-2 pl-3 align-top">
                              <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium capitalize', TINT[tone])}>
                                <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />{i.status}
                              </span>
                            </td>
                            <td className="py-2 pl-2 text-right align-top">
                              {i.dashboardUrl && (
                                <a
                                  href={i.dashboardUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label="Open in Stripe"
                                  className="inline-flex rounded-md p-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
