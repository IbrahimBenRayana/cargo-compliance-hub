import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Ship, MapPin, AlertTriangle, Loader2, RefreshCw, Search, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTrackingStatus, useTrackedShipments, useCreateTracking } from '@/hooks/useTracking';
import type { TrackedShipment } from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── helpers ──────────────────────────────────────────────

function StatusPill({ status }: { status: TrackedShipment['status'] }) {
  const map: Record<TrackedShipment['status'], { label: string; cls: string }> = {
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
    tracking: { label: 'Tracking', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    failed:   { label: 'Failed',   cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
    stopped:  { label: 'Stopped',  cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', cls)}>{label}</span>;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return format(new Date(s), 'MMM d, yyyy'); } catch { return '—'; }
}

// ─── Create form ──────────────────────────────────────────

function CreateTrackingCard() {
  const create = useCreateTracking();
  const [requestType, setRequestType] = useState<TrackedShipment['requestType']>('bill_of_lading');
  const [requestNumber, setRequestNumber] = useState('');
  const [scac, setScac] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestNumber.trim() || scac.trim().length !== 4) {
      toast.error('Need a request number and 4-character SCAC');
      return;
    }
    create.mutate(
      { requestType, requestNumber: requestNumber.trim(), scac: scac.trim().toUpperCase() },
      {
        onSuccess: () => {
          toast.success('Tracking request created — Terminal 49 is fetching from the carrier.');
          setRequestNumber('');
          setScac('');
        },
        onError: (err: any) => {
          toast.error(err?.message ?? 'Failed to create tracking request');
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-2.5">
            <Plus className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <CardTitle>Track a new shipment</CardTitle>
            <CardDescription>Bill of lading, booking, or container number — plus the 4-char SCAC.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_120px_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as TrackedShipment['requestType'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bill_of_lading">Bill of Lading</SelectItem>
                <SelectItem value="booking_number">Booking Number</SelectItem>
                <SelectItem value="container">Container Number</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Number</Label>
            <Input
              value={requestNumber}
              onChange={(e) => setRequestNumber(e.target.value)}
              placeholder="e.g. MEDUF5399896"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SCAC</Label>
            <Input
              value={scac}
              onChange={(e) => setScac(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="MSCU"
              maxLength={4}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending} className="w-full md:w-auto">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── List + filters ───────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: 'all' | TrackedShipment['status']; label: string }> = [
  { value: 'all',      label: 'All statuses' },
  { value: 'pending',  label: 'Pending' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'failed',   label: 'Failed' },
  { value: 'stopped',  label: 'Stopped' },
];

function ListCard() {
  const [statusFilter, setStatusFilter] = useState<'all' | TrackedShipment['status']>('all');
  const [q, setQ] = useState('');

  const list = useTrackedShipments({
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: q.trim() || undefined,
    limit: 100,
  });

  const rows = list.data?.trackedShipments ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-100 dark:bg-sky-900/30 p-2.5">
              <Container className="h-5 w-5 text-sky-700 dark:text-sky-300" />
            </div>
            <div>
              <CardTitle>Tracked shipments</CardTitle>
              <CardDescription>Live container status from Terminal 49.</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search BOL, vessel, line…"
                className="pl-8 w-[220px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => list.refetch()} aria-label="Refresh list">
              <RefreshCw className={cn('h-4 w-4', list.isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {list.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No tracked shipments yet. Add one above to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BOL / Booking</TableHead>
                  <TableHead>SCAC</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>POD</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell className="font-medium">{r.requestNumber}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-mono text-[11px]">{r.scac}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.shippingLineName ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {r.podVesselName ? (
                        <div className="flex items-center gap-1.5">
                          <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{r.podVesselName}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.portOfDischargeName ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{r.portOfDischargeName}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.podEtaAt ?? r.podAtaAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={r.status} />
                        {r.hasHolds && (
                          <span title="Holds at terminal" className="inline-flex">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/tracking/${r.id}`}>
                          Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function TrackingPage() {
  const status = useTrackingStatus();

  if (status.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status.data && !status.data.enabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Container Tracking is not configured</AlertTitle>
          <AlertDescription>
            Set <code className="rounded bg-muted px-1.5 py-0.5 text-xs">TERMINAL49_API_KEY</code> in
            the server environment to enable this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Container Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Live shipment & container status from Terminal 49 — ETA, vessel, holds, and last free day.
        </p>
      </header>

      <CreateTrackingCard />
      <ListCard />
    </div>
  );
}
