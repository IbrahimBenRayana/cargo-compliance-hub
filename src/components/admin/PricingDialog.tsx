import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';
import { money, dollarsToCents } from '@/lib/pricing';

const centsToDollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(c % 100 === 0 ? 0 : 2));

/** Founder-approved pilot terms (pricing plan v2 §5.1), prefilled when an
 *  org is switched to invoiced. Mirrors server PILOT_DEFAULTS. */
const PILOT = { minimum: '250', included: '50', isf: '5' };

/**
 * Set a client's own prices and how it pays (pricing plan v2). Prices are per
 * org and survive every deploy. Entries have no public price: until both entry
 * prices are set, the client can't send entries. Changes apply to filings CBP
 * accepts from now on.
 *
 * Card: each accepted filing is charged to the client's card at once.
 * Invoiced (pilots, contracts): accepted filings accrue for a monthly Stripe
 * invoice, debited by ACH — a minimum that includes N ISFs, then the ISF price
 * for each ISF above N.
 */
export function PricingDialog({ org, onClose }: { org: AdminOrganization | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'card' | 'invoiced'>('card');
  const [isf, setIsf] = useState('');
  const [linked, setLinked] = useState('');
  const [entryOnly, setEntryOnly] = useState('');
  const [minimum, setMinimum] = useState('');
  const [included, setIncluded] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (!org) return;
    setMode(org.billing?.mode ?? 'card');
    setIsf(centsToDollars(org.pricing?.isfCents));
    setLinked(centsToDollars(org.pricing?.entryLinkedCents));
    setEntryOnly(centsToDollars(org.pricing?.entryOnlyCents));
    setMinimum(centsToDollars(org.billing?.monthlyMinimumCents));
    setIncluded(org.billing?.includedIsfs == null ? '' : String(org.billing.includedIsfs));
    setStartsOn(org.billing?.billingStartsOn ?? '');
    setHold(org.billing?.billingHold ?? false);
  }, [org]);

  function chooseMode(next: 'card' | 'invoiced' | '') {
    if (!next) return;
    setMode(next);
    if (next === 'invoiced') {
      // Prefill the pilot terms for anything not set yet.
      if (!minimum) setMinimum(PILOT.minimum);
      if (!included) setIncluded(PILOT.included);
      if (org?.billing?.mode !== 'invoiced') setIsf(PILOT.isf);
    } else if (org?.billing?.mode === 'invoiced') {
      setIsf(''); // back to the plan default card price
    }
  }

  const invoiced = mode === 'invoiced';
  const isfCents = dollarsToCents(isf);
  const linkedCents = dollarsToCents(linked);
  const entryOnlyCents = dollarsToCents(entryOnly);
  const minimumCents = dollarsToCents(minimum);
  const includedTrim = included.trim();
  const includedIsfs = includedTrim === '' ? null : /^\d+$/.test(includedTrim) ? Number(includedTrim) : Number.NaN;
  const defaultIsf = org?.pricing ? (org.pricing.isfCents == null ? org.pricing.effective.isfCents : null) : null;
  const effectiveIsf = isfCents ?? defaultIsf ?? 4500;

  const badNumber = [isfCents, linkedCents, entryOnlyCents, ...(invoiced ? [minimumCents, includedIsfs] : [])].some((c) => Number.isNaN(c));
  const halfEntry = (linkedCents == null) !== (entryOnlyCents == null);
  const entriesSet = linkedCents != null && entryOnlyCents != null && !badNumber;
  // CR1: buying ISF + entry-only separately must never beat the linked bundle.
  const unbundleCheaper = !invoiced && entriesSet && entryOnlyCents! < linkedCents!;
  const error = badNumber
    ? 'Enter dollar amounts like 45 or 45.50, and a whole number of ISFs.'
    : halfEntry ? 'Set both entry prices, or clear both.' : undefined;

  const save = useMutation({
    mutationFn: () =>
      adminApi.setPricing(org!.id, {
        isfCents,
        entryLinkedCents: linkedCents,
        entryOnlyCents,
        billingMode: mode,
        billingHold: hold,
        ...(invoiced && { monthlyMinimumCents: minimumCents, includedIsfs, billingStartsOn: startsOn || null }),
      }),
    onSuccess: () => {
      toast.success(`Pricing saved for ${org!.name}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save pricing'),
  });

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pricing &amp; billing</DialogTitle>
          <DialogDescription>
            {org?.name}'s own prices, for filings CBP accepts. Changes apply to filings accepted from now on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1.5">
            <Label>How they pay</Label>
            <ToggleGroup type="single" value={mode} onValueChange={(v) => chooseMode(v as 'card' | 'invoiced' | '')} className="justify-start">
              <ToggleGroupItem value="card" variant="outline" size="sm">Card, per filing</ToggleGroupItem>
              <ToggleGroupItem value="invoiced" variant="outline" size="sm">Invoiced monthly (ACH)</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {invoiced
                ? 'No card charges. Accepted filings add up to one Stripe invoice a month, debited from their bank account.'
                : 'Each accepted filing is charged to their card right away.'}
            </p>
          </div>

          {invoiced && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bill-min">Monthly minimum ($)</Label>
                <Input id="bill-min" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill-incl">ISFs included</Label>
                <Input id="bill-incl" inputMode="numeric" value={included} onChange={(e) => setIncluded(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bill-start">Billing starts</Label>
                <Input id="bill-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Nothing accepted before the start date is invoiced. Leave it blank to bill from now.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="price-isf">{invoiced ? 'Per accepted ISF above the included ones ($)' : 'Per accepted ISF ($)'}</Label>
            <Input
              id="price-isf"
              inputMode="decimal"
              value={isf}
              onChange={(e) => setIsf(e.target.value)}
              placeholder={invoiced ? PILOT.isf : `${(defaultIsf ?? 4500) / 100} (plan default)`}
            />
            {!invoiced && <p className="text-xs text-muted-foreground">Leave blank for the plan default.</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-linked">Entry on an ISF ($)</Label>
              <Input id="price-linked" inputMode="decimal" value={linked} onChange={(e) => setLinked(e.target.value)} placeholder="Not offered" />
              <p className="text-xs text-muted-foreground">{invoiced ? 'One entry per ISF.' : 'Charged on top of the ISF.'}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-entry">Entry without an ISF ($)</Label>
              <Input id="price-entry" inputMode="decimal" value={entryOnly} onChange={(e) => setEntryOnly(e.target.value)} placeholder="Not offered" />
              <p className="text-xs text-muted-foreground">Also a 2nd+ entry on one ISF.</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {invoiced && minimumCents != null && !badNumber && (
              <p className="mb-1">
                {money(minimumCents)} a month including {includedIsfs ?? 0} ISFs, then {money(isfCents ?? 0)} per ISF.
              </p>
            )}
            {!entriesSet ? (
              <p className="text-muted-foreground">No entry pricing: this client can't send entries.</p>
            ) : !invoiced ? (
              <ul className="space-y-1">
                <li>ISF + entry on one shipment: <span className="font-medium tabular-nums">{money(effectiveIsf + linkedCents!)}</span></li>
                <li>ISF and an entry bought separately: <span className="font-medium tabular-nums">{money(effectiveIsf + entryOnlyCents!)}</span></li>
              </ul>
            ) : null}
            {unbundleCheaper && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Buying them separately is cheaper than the bundle. The pricing plan keeps entry-only above the linked price.
              </p>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="bill-hold">Hold new submissions</Label>
              <p className="text-xs text-muted-foreground">For an overdue invoice. Drafts, amendments and cancellations still work.</p>
            </div>
            <Switch id="bill-hold" checked={hold} onCheckedChange={setHold} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !!error}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
