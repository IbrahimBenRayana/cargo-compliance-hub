import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from '@/components/icons';
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
import { money, dollarsToCents, isfBandLines } from '@/lib/pricing';

const centsToDollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(c % 100 === 0 ? 0 : 2));

/** Founder-approved pilot terms (pricing plan v2 §5.1), prefilled when an
 *  org is switched to invoiced. Mirrors server PILOT_DEFAULTS. */
const PILOT = { minimum: '250', included: '50', isf: '5', bandFrom: '251', bandIsf: '4' };

/**
 * Set a client's own prices and how it pays (pricing plan v2). Prices are per
 * org and survive every deploy. Entries have no public price: until both entry
 * prices are set, the client can't send entries. Changes apply to filings CBP
 * accepts from now on.
 *
 * Card: each accepted filing is charged to the client's card at once.
 * Invoiced (pilots, contracts): accepted filings accrue for a monthly Stripe
 * invoice, debited by ACH — a minimum that includes N ISFs, then the ISF price
 * for each ISF above N, and a lower band rate from a set ISF count (the pilot
 * ladder: $4 from the 251st). Further bands are kept as they are.
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
  const [bandFrom, setBandFrom] = useState('');
  const [bandIsf, setBandIsf] = useState('');
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
    const band = org.billing?.isfBands?.[0];
    setBandFrom(band ? String(band.fromIsf) : '');
    setBandIsf(centsToDollars(band?.cents));
    setHold(org.billing?.billingHold ?? false);
  }, [org]);

  function chooseMode(next: 'card' | 'invoiced' | '') {
    if (!next) return;
    setMode(next);
    if (next === 'invoiced') {
      // Prefill the pilot terms for anything not set yet.
      if (!minimum) setMinimum(PILOT.minimum);
      if (!included) setIncluded(PILOT.included);
      if (org?.billing?.mode !== 'invoiced') {
        setIsf(PILOT.isf);
        if (!bandFrom && !bandIsf) {
          setBandFrom(PILOT.bandFrom);
          setBandIsf(PILOT.bandIsf);
        }
      }
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
  const bandFromTrim = bandFrom.trim();
  const bandFromIsf = bandFromTrim === '' ? null : /^\d+$/.test(bandFromTrim) ? Number(bandFromTrim) : Number.NaN;
  const bandCents = dollarsToCents(bandIsf);
  const halfBand = (bandFromIsf == null) !== (bandCents == null);
  const laterBands = org?.billing?.isfBands?.slice(1) ?? [];
  const bandOrder = bandFromIsf != null && laterBands.length > 0 && bandFromIsf >= laterBands[0].fromIsf;
  const bandTooLow = bandFromIsf != null && includedIsfs != null && bandFromIsf <= includedIsfs;
  const isfBands = bandFromIsf != null && bandCents != null ? [{ fromIsf: bandFromIsf, cents: bandCents }, ...laterBands] : [];
  const defaultIsf = org?.pricing ? (org.pricing.isfCents == null ? org.pricing.effective.isfCents : null) : null;
  const effectiveIsf = isfCents ?? defaultIsf ?? 4500;

  const badNumber = [isfCents, linkedCents, entryOnlyCents, ...(invoiced ? [minimumCents, includedIsfs, bandFromIsf, bandCents] : [])].some((c) => Number.isNaN(c));
  const halfEntry = (linkedCents == null) !== (entryOnlyCents == null);
  const entriesSet = linkedCents != null && entryOnlyCents != null && !badNumber;
  // CR1: buying ISF + entry-only separately must never beat the linked bundle.
  const unbundleCheaper = !invoiced && entriesSet && entryOnlyCents! < linkedCents!;
  const error = badNumber
    ? 'Enter dollar amounts like 45 or 45.50, and a whole number of ISFs.'
    : halfEntry ? 'Set both entry prices, or clear both.'
    : invoiced && halfBand ? 'Set both the band start and its price, or clear both.'
    : invoiced && bandTooLow ? 'The lower rate must start after the included ISFs.'
    : invoiced && bandOrder ? `The lower rate must start before the next band (ISF ${laterBands[0].fromIsf}).` : undefined;

  // Display only: in invoiced mode with entry prices set and no minimum, the summary has no lines.
  const showSummary = !entriesSet || !invoiced || minimumCents != null;

  const save = useMutation({
    mutationFn: () =>
      adminApi.setPricing(org!.id, {
        isfCents,
        entryLinkedCents: linkedCents,
        entryOnlyCents,
        billingMode: mode,
        billingHold: hold,
        ...(invoiced && { monthlyMinimumCents: minimumCents, includedIsfs, isfBands, billingStartsOn: startsOn || null }),
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
          <DialogTitle>Pricing and billing</DialogTitle>
          <DialogDescription>
            {org?.name}'s own prices, for filings CBP accepts. Changes apply to filings accepted from now on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>How they pay</Label>
            <ToggleGroup type="single" value={mode} onValueChange={(v) => chooseMode(v as 'card' | 'invoiced' | '')} className="justify-start">
              <ToggleGroupItem value="card" variant="outline" size="sm" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Card, per filing</ToggleGroupItem>
              <ToggleGroupItem value="invoiced" variant="outline" size="sm" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Invoiced monthly (ACH)</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[12px] text-muted-foreground">
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
              <p className="text-[12px] text-muted-foreground sm:col-span-3">
                Nothing accepted before the start date is invoiced. Leave it blank to bill from now.
              </p>
            </div>
          )}

          <div className="space-y-1.5 border-t border-border/70 pt-4">
            <h3 className="pb-1.5 text-[13px] font-semibold">Prices</h3>
            <Label htmlFor="price-isf">{invoiced ? 'Per accepted ISF above the included ones ($)' : 'Per accepted ISF ($)'}</Label>
            <Input
              id="price-isf"
              inputMode="decimal"
              value={isf}
              onChange={(e) => setIsf(e.target.value)}
              placeholder={invoiced ? PILOT.isf : `${(defaultIsf ?? 4500) / 100} (plan default)`}
            />
            {!invoiced && <p className="text-[12px] text-muted-foreground">Leave blank for the plan default.</p>}
          </div>
          {invoiced && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="band-from">Lower rate from ISF number</Label>
                <Input id="band-from" inputMode="numeric" value={bandFrom} onChange={(e) => setBandFrom(e.target.value)} placeholder="None" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="band-isf">Lower rate per ISF ($)</Label>
                <Input id="band-isf" inputMode="decimal" value={bandIsf} onChange={(e) => setBandIsf(e.target.value)} placeholder="None" />
              </div>
              <p className="text-[12px] text-muted-foreground sm:col-span-2">
                Counted each month. Leave both blank for one rate above the included ISFs.
                {laterBands.length > 0 && ` ${laterBands.length} further band${laterBands.length > 1 ? 's are' : ' is'} kept as set.`}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-linked">Entry on an ISF ($)</Label>
              <Input id="price-linked" inputMode="decimal" value={linked} onChange={(e) => setLinked(e.target.value)} placeholder="Not offered" />
              <p className="text-[12px] text-muted-foreground">{invoiced ? 'One entry per ISF.' : 'Charged on top of the ISF.'}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-entry">Entry without an ISF ($)</Label>
              <Input id="price-entry" inputMode="decimal" value={entryOnly} onChange={(e) => setEntryOnly(e.target.value)} placeholder="Not offered" />
              <p className="text-[12px] text-muted-foreground">Also a 2nd+ entry on one ISF.</p>
            </div>
          </div>

          {showSummary && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-[13px]">
              {invoiced && minimumCents != null && !badNumber && (
                <p className="mb-1 tabular-nums">
                  {money(minimumCents)} a month including {includedIsfs ?? 0} ISFs, then {money(isfCents ?? 0)} per ISF
                  {isfBands.length > 0 ? `; ${isfBandLines(isfBands).join('; ')}.` : '.'}
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
                <p className="mt-2 text-[12px] font-medium text-soon">
                  Buying them separately is cheaper than the bundle. The pricing plan keeps entry-only above the linked price.
                </p>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
            <div>
              <Label htmlFor="bill-hold">Hold new submissions</Label>
              <p className="mt-0.5 text-[12px] text-muted-foreground">For an overdue invoice. Drafts, amendments and cancellations still work.</p>
            </div>
            <Switch id="bill-hold" checked={hold} onCheckedChange={setHold} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px] text-urgent">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !!error}>
            {save.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
