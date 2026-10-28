import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';
import { money, dollarsToCents } from '@/lib/pricing';

const centsToDollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(c % 100 === 0 ? 0 : 2));

/**
 * Set a client's own prices (pricing plan v2). Prices are per org and survive
 * every deploy. Entries have no public price: until both entry prices are set,
 * the client can't send entries. A change applies to shipments CBP accepts
 * from now on.
 */
export function PricingDialog({ org, onClose }: { org: AdminOrganization | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isf, setIsf] = useState('');
  const [linked, setLinked] = useState('');
  const [entryOnly, setEntryOnly] = useState('');

  useEffect(() => {
    if (!org) return;
    setIsf(centsToDollars(org.pricing?.isfCents));
    setLinked(centsToDollars(org.pricing?.entryLinkedCents));
    setEntryOnly(centsToDollars(org.pricing?.entryOnlyCents));
  }, [org]);

  const isfCents = dollarsToCents(isf);
  const linkedCents = dollarsToCents(linked);
  const entryOnlyCents = dollarsToCents(entryOnly);
  const defaultIsf = org?.pricing ? (org.pricing.isfCents == null ? org.pricing.effective.isfCents : null) : null;
  const effectiveIsf = isfCents ?? defaultIsf ?? 4500;

  const badNumber = [isfCents, linkedCents, entryOnlyCents].some((c) => Number.isNaN(c));
  const halfEntry = (linkedCents == null) !== (entryOnlyCents == null);
  const entriesSet = linkedCents != null && entryOnlyCents != null && !badNumber;
  // CR1: buying ISF + entry-only separately must never beat the linked bundle.
  const unbundleCheaper = entriesSet && entryOnlyCents! < linkedCents!;
  const error = badNumber ? 'Enter dollar amounts like 45 or 45.50.' : halfEntry ? 'Set both entry prices, or clear both.' : undefined;

  const save = useMutation({
    mutationFn: () => adminApi.setPricing(org!.id, { isfCents, entryLinkedCents: linkedCents, entryOnlyCents }),
    onSuccess: () => {
      toast.success(`Pricing saved for ${org!.name}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save pricing'),
  });

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pricing</DialogTitle>
          <DialogDescription>
            {org?.name}'s own prices, charged when CBP accepts a filing. New prices apply to filings accepted from now
            on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="price-isf">Per accepted ISF ($)</Label>
            <Input id="price-isf" inputMode="decimal" value={isf} onChange={(e) => setIsf(e.target.value)} placeholder={`${(defaultIsf ?? 4500) / 100} (plan default)`} />
            <p className="text-xs text-muted-foreground">Leave blank for the plan default.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-linked">Entry on an ISF ($)</Label>
              <Input id="price-linked" inputMode="decimal" value={linked} onChange={(e) => setLinked(e.target.value)} placeholder="Not offered" />
              <p className="text-xs text-muted-foreground">Charged on top of the ISF.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-entry">Entry without an ISF ($)</Label>
              <Input id="price-entry" inputMode="decimal" value={entryOnly} onChange={(e) => setEntryOnly(e.target.value)} placeholder="Not offered" />
              <p className="text-xs text-muted-foreground">Also a 2nd+ entry on one ISF.</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {entriesSet ? (
              <ul className="space-y-1">
                <li>ISF + entry on one shipment: <span className="font-medium tabular-nums">{money(effectiveIsf + linkedCents!)}</span></li>
                <li>ISF and an entry bought separately: <span className="font-medium tabular-nums">{money(effectiveIsf + entryOnlyCents!)}</span></li>
              </ul>
            ) : (
              <p className="text-muted-foreground">No entry pricing: this client can't send entries.</p>
            )}
            {unbundleCheaper && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Buying them separately is cheaper than the bundle. The pricing plan keeps entry-only above the linked price.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !!error}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
