import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Loader2, RefreshCw, Package, Ship, Plane, MapPin, Hash, Calendar, AlertCircle, FileCheck, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useManifestQuery, useManifestQueries, useCreateManifestQuery, usePollManifestQuery } from '@/hooks/useManifestQuery';
import { getDispositionInfo, getDispositionBadgeColor } from '@/data/dispositionCodes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Date helper ────────────────────────────────────────────────
function parseCCDate(mmddyy: string | undefined): string {
  if (!mmddyy || mmddyy.length !== 6) return mmddyy || '—';
  const mm = mmddyy.slice(0, 2);
  const dd = mmddyy.slice(2, 4);
  const yy = mmddyy.slice(4, 6);
  const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
  return `${year}-${mm}-${dd}`;
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    timeout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', classes[status] ?? classes['timeout'])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Result display ─────────────────────────────────────────────
function ManifestResult({ queryData }: { queryData: any }) {
  const response = queryData?.response;
  // CC returns `response` as either an array (multi-result) or a single
  // object (single BOL — including the "BILL NBR NOT ON FILE" case where
  // the only meaningful field is `errorMessage`). Normalise to an object.
  const raw = response?.data?.response;
  const manifest = Array.isArray(raw) ? raw[0] : raw;
  const ccErrorMessage: string | undefined = manifest?.errorMessage;

  // CBP-side error: BOL not on file, formatting issue, etc. Surface the
  // raw CC code+text rather than hiding behind a generic empty state.
  if (ccErrorMessage) {
    return (
      <div className="flex items-start gap-3 py-4 px-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            CBP responded but had no manifest data
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300/90">
            {ccErrorMessage}
          </p>
          {(manifest?.carrierCode || manifest?.masterBLNumber) && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Carrier {manifest.carrierCode || '—'} · BOL {manifest.masterBLNumber || '—'}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!manifest || (Array.isArray(manifest.houses) && manifest.houses.length === 0 && !manifest.carrierCode)) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No manifest data found in the CBP response.</span>
      </div>
    );
  }

  const houses: any[] = manifest.houses ?? [];
  const modeIcon = manifest.modeOfTransport === 'AIR' ? <Plane className="h-4 w-4" /> : <Ship className="h-4 w-4" />;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: <Hash className="h-3.5 w-3.5" />, label: 'BOL', value: queryData.bolNumber },
          { icon: modeIcon, label: 'Mode', value: manifest.modeOfTransport ?? '—' },
          { icon: <Ship className="h-3.5 w-3.5" />, label: 'Carrier', value: manifest.carrierCode ?? '—' },
          { icon: <Package className="h-3.5 w-3.5" />, label: 'Conveyance', value: manifest.conveyanceName ?? '—' },
          { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Arrival', value: parseCCDate(manifest.scheduledArrivalDate) },
          { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Port', value: manifest.manifestedPortOfUnlading ?? '—' },
        ].map((item) => (
          <div key={item.label} className="bg-muted/40 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">{item.icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span></div>
            <p className="text-sm font-medium truncate" title={item.value}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Houses table */}
      {houses.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">HAWB / AWB</TableHead>
                <TableHead className="text-xs">Flight / Vessel</TableHead>
                <TableHead className="text-xs">Carrier</TableHead>
                <TableHead className="text-xs">Arrival Date</TableHead>
                <TableHead className="text-xs">Qty</TableHead>
                <TableHead className="text-xs">Port</TableHead>
                <TableHead className="text-xs">Dispositions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {houses.map((house: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{house.hawbNumber ?? house.awbNumber ?? '—'}</TableCell>
                  <TableCell className="text-xs">{house.flightNumber ?? '—'}</TableCell>
                  <TableCell className="text-xs">{house.importingCarrierCode ?? '—'}</TableCell>
                  <TableCell className="text-xs">{parseCCDate(house.scheduledArrivalDate)}</TableCell>
                  <TableCell className="text-xs">{house.manifestQty ?? '—'}</TableCell>
                  <TableCell className="text-xs">{house.manifestedPort ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(house.dispositionMsg ?? []).map((d: any, j: number) => {
                        const info = getDispositionInfo(d.dispositionCode);
                        const color = getDispositionBadgeColor(info.severity);
                        return (
                          <span
                            key={j}
                            title={`${info.description}${d.entryNumber ? ` — Entry: ${d.entryNumber}` : ''}`}
                            className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-default', color)}
                          >
                            {d.dispositionCode} {info.label}
                          </span>
                        );
                      })}
                      {(!house.dispositionMsg || house.dispositionMsg.length === 0) && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {houses.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No house entries returned for this BOL.</p>
      )}

      {/* Next-step CTA: turn this manifest into an ABI Entry Summary draft */}
      {queryData?.id && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">File an Entry Summary (7501)</p>
              <p className="text-xs text-muted-foreground truncate">
                Start a new ABI entry pre-populated with this manifest's MBOL, carrier,
                and port data.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to={`/abi-documents/new?fromManifest=${queryData.id}`}>
              Create Entry <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Active query panel ─────────────────────────────────────────
function ActiveQueryPanel({ queryId, onClose }: { queryId: string; onClose: () => void }) {
  const { data, isLoading } = useManifestQuery(queryId);
  const pollQuery = usePollManifestQuery();

  const queryData = data?.data;
  const status = queryData?.status;

  const handleRetry = () => {
    pollQuery.mutate(queryId, {
      onSuccess: () => toast.success('Query re-polled'),
      onError: (err: any) => toast.error(err.message ?? 'Poll failed'),
    });
  };

  return (
    <Card className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards', animationDelay: '50ms' }}>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base">Query Result</CardTitle>
          {queryData && (
            <CardDescription className="font-mono text-xs mt-0.5">{queryData.bolNumber}</CardDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          {queryData && <StatusBadge status={queryData.status} />}
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onClose}>Dismiss</Button>
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading || status === 'pending') && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span className="text-sm text-muted-foreground">Querying CBP manifest data… this may take up to 30 seconds.</span>
          </div>
        )}
        {status === 'completed' && queryData && (
          <ManifestResult queryData={queryData} />
        )}
        {(status === 'failed' || status === 'timeout') && (
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Query {status}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{queryData?.errorMessage ?? 'CBP did not return a result within the timeout window.'}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 ml-4" onClick={handleRetry} disabled={pollQuery.isPending}>
              {pollQuery.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ManifestQueryPage() {
  const [searchParams] = useSearchParams();
  const initialBol = searchParams.get('bol') ?? '';

  const [bolInput, setBolInput] = useState(initialBol);
  const [bolType, setBolType] = useState<'BOLNUMBER' | 'AWBNUMBER'>('BOLNUMBER');
  const [activeQueryId, setActiveQueryId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const createQuery = useCreateManifestQuery();
  const { data: historyData, isLoading: historyLoading } = useManifestQueries({ page, limit: 10 });

  const history = historyData?.data ?? [];
  const pagination = historyData?.pagination;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bolInput.trim()) return;
    try {
      const result = await createQuery.mutateAsync({ bolNumber: bolInput.trim(), bolType });
      setActiveQueryId(result.data.id);
      toast.success('Manifest query submitted');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit query');
    }
  };

  const handleHistoryRowClick = (id: string) => {
    setActiveQueryId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto">
      {/* Page header */}
      <header className="space-y-4 opacity-0 animate-fade-in-up motion-reduce:animate-none motion-reduce:opacity-100" style={{ animationFillMode: 'forwards' }}>
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0 inline-flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500/60" aria-hidden />
            Lookups · CBP
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground inline-flex items-center gap-3">
            <Search className="h-7 w-7 text-amber-500 shrink-0" strokeWidth={2} />
            Manifest Query
          </h1>
          <p className="text-[14px] text-muted-foreground mt-2">Look up cargo status at CBP by BOL number</p>
        </div>
      </header>

      {/* Search section */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards', animationDelay: '30ms' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New Query</CardTitle>
          <CardDescription>Enter a Bill of Lading number to retrieve manifest status from CBP</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="bol-input" className="text-xs font-medium">BOL Number</Label>
              <Input
                id="bol-input"
                placeholder="e.g. MAEU123456789"
                value={bolInput}
                onChange={(e) => setBolInput(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div className="sm:w-44 space-y-1.5">
              <Label className="text-xs font-medium">BOL Type</Label>
              <Select value={bolType} onValueChange={(v) => setBolType(v as 'BOLNUMBER' | 'AWBNUMBER')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLNUMBER">Bill of Lading</SelectItem>
                  <SelectItem value="AWBNUMBER">Air Waybill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:self-end space-y-1.5">
              <div className="hidden sm:block text-xs opacity-0 select-none">x</div>
              <Button
                type="submit"
                disabled={createQuery.isPending || !bolInput.trim()}
                className="w-full sm:w-auto gap-2 bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold"
              >
                {createQuery.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Querying…</>
                ) : (
                  <><Search className="h-4 w-4" />Query Manifest</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Active query result */}
      {activeQueryId && (
        <ActiveQueryPanel
          key={activeQueryId}
          queryId={activeQueryId}
          onClose={() => setActiveQueryId(undefined)}
        />
      )}

      {/* Query history */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards', animationDelay: '80ms' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Query History</CardTitle>
          <CardDescription>Previous manifest queries — click a row to view results</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs pl-4">BOL Number</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Submitted</TableHead>
                  <TableHead className="text-xs">Completed</TableHead>
                  <TableHead className="text-xs text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
                {!historyLoading && history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No queries yet — submit a BOL number above to get started.
                    </TableCell>
                  </TableRow>
                )}
                {!historyLoading && history.map((q: any) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => handleHistoryRowClick(q.id)}
                  >
                    <TableCell className="font-mono text-xs pl-4">{q.bolNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{q.bolType}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.completedAt
                        ? new Date(q.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleHistoryRowClick(q.id); }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} &mdash; {pagination.total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
