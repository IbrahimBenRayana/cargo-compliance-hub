import { Link, useParams } from 'react-router-dom';
import {
  Ship, MapPin, Container, AlertTriangle, RefreshCw, ArrowLeft, Clock, Anchor, Truck, ShieldAlert, DollarSign, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTrackedShipment, useRefreshTracking } from '@/hooks/useTracking';
import type { TrackedShipment, TrackedContainerSnapshot } from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'MMM d, yyyy'); } catch { return '—'; }
}
function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'MMM d, yyyy HH:mm'); } catch { return '—'; }
}

function StatusPill({ status }: { status: TrackedShipment['status'] }) {
  const map: Record<TrackedShipment['status'], { label: string; cls: string }> = {
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
    tracking: { label: 'Tracking', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    failed:   { label: 'Failed',   cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
    stopped:  { label: 'Stopped',  cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', cls)}>{label}</span>;
}

function MilestoneRow({ icon: Icon, label, dateStr, sub }: { icon: any; label: string; dateStr: string | null; sub?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 rounded-lg bg-muted p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className={cn('text-[12px] tabular-nums', dateStr ? 'text-foreground' : 'text-muted-foreground')}>
        {fmtDateTime(dateStr)}
      </div>
    </div>
  );
}

function ContainerCard({ c }: { c: TrackedContainerSnapshot }) {
  const holds = c.holdsAtPodTerminal ?? [];
  const fees  = c.feesAtPodTerminal ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-sky-100 dark:bg-sky-900/30 p-2.5">
              <Container className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-mono">{c.number}</CardTitle>
              <CardDescription className="text-[12px]">
                {[c.equipmentLength ? `${c.equipmentLength}'` : null, c.equipmentType, c.equipmentHeight].filter(Boolean).join(' · ') || '—'}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {c.currentStatus && (
              <Badge variant="secondary" className="capitalize text-[11px]">
                {c.currentStatus.replace(/_/g, ' ')}
              </Badge>
            )}
            {c.availableForPickup === true && (
              <Badge className="bg-emerald-100 text-emerald-800 text-[11px] dark:bg-emerald-900/30 dark:text-emerald-300">
                Available for pickup
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <div className="text-muted-foreground">Last free day</div>
            <div className={cn('font-medium', c.pickupLfd && new Date(c.pickupLfd) < new Date() && 'text-rose-600')}>
              {fmtDate(c.pickupLfd)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Location</div>
            <div className="font-medium truncate">{c.locationAtPodTerminal ?? '—'}</div>
          </div>
        </div>

        {holds.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" /> Holds at terminal
            </div>
            <ul className="space-y-1 text-[12px] text-amber-900 dark:text-amber-100">
              {holds.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{h.name}{h.description ? ` — ${h.description}` : ''}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{h.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fees.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold">
              <DollarSign className="h-3.5 w-3.5" /> Fees at terminal
            </div>
            <ul className="space-y-1 text-[12px]">
              {fees.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="capitalize">{f.type.replace(/_/g, ' ')}</span>
                  <span className="tabular-nums">
                    {Number(f.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {f.currency_code ?? 'USD'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrackingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useTrackedShipment(id);
  const refresh = useRefreshTracking();

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load shipment</AlertTitle>
          <AlertDescription>{(q.error as any)?.message ?? 'Unknown error'}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="ghost" asChild><Link to="/tracking"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        </div>
      </div>
    );
  }

  const ts = q.data.trackedShipment;
  const snap = ts.shipmentSnapshot;

  const onRefresh = () => {
    if (!ts.id) return;
    refresh.mutate(ts.id, {
      onSuccess: () => toast.success('Synced from Terminal 49'),
      onError: (err: any) => toast.error(err?.message ?? 'Refresh failed'),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" asChild size="sm">
          <Link to="/tracking"><ArrowLeft className="h-4 w-4 mr-1" /> All tracked</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refresh.isPending}>
          {refresh.isPending
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Refresh from Terminal 49
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{ts.requestNumber}</h2>
                <Badge variant="secondary" className="font-mono text-[11px]">{ts.scac}</Badge>
                <StatusPill status={ts.status} />
              </div>
              <CardDescription>
                {ts.shippingLineName ?? '—'} · {ts.requestType.replace(/_/g, ' ')}
              </CardDescription>
            </div>
            {ts.hasHolds && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" /> Holds at terminal
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Origin (POL)</div>
            <div className="font-medium">{ts.portOfLadingName ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Discharge (POD)</div>
            <div className="font-medium">{ts.portOfDischargeName ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Destination</div>
            <div className="font-medium">{ts.destinationName ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Vessel</div>
            <div className="font-medium flex items-center gap-1.5">
              {ts.podVesselName && <Ship className="h-3.5 w-3.5 text-muted-foreground" />}
              {ts.podVesselName ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Earliest LFD</div>
            <div className={cn('font-medium', ts.earliestPickupLfd && new Date(ts.earliestPickupLfd) < new Date() && 'text-rose-600')}>
              {fmtDate(ts.earliestPickupLfd)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Last sync</div>
            <div className="font-medium">{fmtDateTime(ts.lastSyncedAt)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Pending-state copy when there's nothing to show yet */}
      {ts.status === 'pending' && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Terminal 49 is fetching from the carrier</AlertTitle>
          <AlertDescription>
            This usually takes seconds to a few minutes. The page polls automatically; you can also refresh manually.
          </AlertDescription>
        </Alert>
      )}

      {ts.status === 'failed' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tracking failed</AlertTitle>
          <AlertDescription>{ts.failedReason ?? 'Unknown reason. Check the BOL + SCAC and try again.'}</AlertDescription>
        </Alert>
      )}

      {/* Voyage timeline */}
      {snap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voyage timeline</CardTitle>
            <CardDescription>Estimated vs. actual milestones from the carrier.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <MilestoneRow icon={Anchor} label="Departed origin (POL)" dateStr={snap.polAtdAt}
              sub={snap.polAtdAt ? 'Actual' : (snap.polEtdAt ? `Estimated ${fmtDateTime(snap.polEtdAt)}` : undefined)} />
            <MilestoneRow icon={Ship} label="Arrived discharge (POD)" dateStr={snap.podAtaAt}
              sub={snap.podAtaAt ? 'Actual' : (snap.podEtaAt ? `Estimated ${fmtDateTime(snap.podEtaAt)}` : undefined)} />
            <MilestoneRow icon={Truck} label="Arrived inland destination" dateStr={snap.destinationAtaAt}
              sub={snap.destinationAtaAt ? 'Actual' : (snap.destinationEtaAt ? `Estimated ${fmtDateTime(snap.destinationEtaAt)}` : undefined)} />
          </CardContent>
        </Card>
      )}

      {/* Containers */}
      {snap && snap.containers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Containers ({snap.containers.length})</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {snap.containers.map((c) => <ContainerCard key={c.id} c={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
