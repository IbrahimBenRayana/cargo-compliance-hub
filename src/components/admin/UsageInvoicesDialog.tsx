import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';
import { money } from '@/lib/pricing';

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
          <DialogTitle>Usage &amp; invoices</DialogTitle>
          <DialogDescription>
            {org?.name}: filings CBP accepted in a month (UTC).
            {invoiced ? ' Draft the monthly invoice here, then review and finalize it in Stripe.' : ' This client pays by card per filing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="usage-month">Month</Label>
              <Input id="usage-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" size="sm" onClick={() => download.mutate()} disabled={!validPeriod || download.isPending}>
              {download.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Usage CSV
            </Button>
          </div>

          {invoiced && (
            <div className="rounded-lg border p-3 text-sm">
              {preview.isLoading ? (
                <div className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rating the month…</div>
              ) : p ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.closed ? 'Usage invoice would bill' : 'Month to date (not closed yet)'}</span>
                    <span className="text-muted-foreground tabular-nums">{p.isfCount} ISFs · {p.accruedShipments} shipments</span>
                  </div>
                  {p.lines.length === 0 && <p className="text-muted-foreground">Nothing to invoice.</p>}
                  {p.lines.map((l) => (
                    <div key={l.code} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{l.description}</span>
                      <span className="tabular-nums">{money(l.amountCents)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">{money(p.totalCents)}</span>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => draft.mutate('usage')} disabled={draft.isPending || !p?.closed || !p?.totalCents}>
                  {draft.isPending && draft.variables === 'usage' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Draft usage invoice
                </Button>
                <Button size="sm" variant="outline" onClick={() => draft.mutate('prepay')} disabled={draft.isPending || !org?.billing?.monthlyMinimumCents}>
                  {draft.isPending && draft.variables === 'prepay' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Bill this month's minimum in advance
                </Button>
              </div>
              {!p?.closed && <p className="mt-2 text-xs text-muted-foreground">A usage invoice can be drafted once the month has ended.</p>}
            </div>
          )}

          {invoiced && (
            <div className="space-y-2">
              <Label>Invoices</Label>
              {(invoices.data?.invoices ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm">
                  {invoices.data!.invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        {i.period} · {i.kind === 'prepay' ? 'minimum in advance' : 'usage'}
                        {i.lastError && <span className="block text-xs text-destructive">{i.lastError}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{money(i.totalCents)}</span>
                        <Badge variant="secondary" className="text-[10px]">{i.status}</Badge>
                        {i.dashboardUrl && (
                          <a href={i.dashboardUrl} target="_blank" rel="noreferrer" aria-label="Open in Stripe" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
