import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, Loader2,
  FilePlus, Radio, X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useDeleteInbond, useInbondList } from '@/hooks/useInbond';
import type { InbondEntryType, InbondListItem, InbondStatus } from '@/api/client';
import {
  INBOND_ENTRY_TYPE_MAP,
  INBOND_STATUSES,
  INBOND_STATUS_MAP,
} from '@/data/inbondEnums';

const STATUS_ALL = 'all';
const BANNER_KEY = 'mcl_inbond_transport_banner_dismissed';

export function InbondStatusPill({ status }: { status: InbondStatus }) {
  const cfg = INBOND_STATUS_MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function InbondTypeBadge({ entryType }: { entryType: InbondEntryType }) {
  const meta = INBOND_ENTRY_TYPE_MAP[entryType];
  if (!meta) return <span className="text-xs text-muted-foreground">{entryType}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 cursor-default">
          {meta.value} {meta.code}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <p className="font-semibold">{meta.label}</p>
        <p className="text-xs opacity-80 mt-0.5">{meta.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function InbondListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const statusParam = (searchParams.get('status') as InbondStatus | null) ?? null;
  const searchParam = searchParams.get('search') ?? '';

  // Local input state so typing doesn't thrash the URL on every keystroke.
  const [searchInput, setSearchInput] = useState(searchParam);
  const [pendingDelete, setPendingDelete] = useState<InbondListItem | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });

  const { data, isLoading, isError, error } = useInbondList({
    status: statusParam ?? undefined,
    search: searchParam || undefined,
  });
  const deleteFiling = useDeleteInbond();

  const filings = data?.filings ?? [];

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', searchInput.trim() || null);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* private browsing */
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteFiling.mutateAsync(pendingDelete.id);
      toast.success('In-bond filing deleted');
      setPendingDelete(null);
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Failed to delete filing');
      }
    }
  };

  const hasActiveFilters = !!(statusParam || searchParam);
  const isEmptyFiltered = !isLoading && !isError && filings.length === 0 && hasActiveFilters;
  const isEmptyAbsolute = !isLoading && !isError && filings.length === 0 && !hasActiveFilters;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Page header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="space-y-4 w-full">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0 inline-flex items-center gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-500/60" aria-hidden />
              Operations · ABI
            </p>
            <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground inline-flex items-center gap-3">
                <ArrowLeftRight className="h-7 w-7 text-teal-500 shrink-0" strokeWidth={2} />
                In-Bond Movements
              </h1>
              <p className="text-[14px] text-muted-foreground mt-2">
                CBP Form 7512 in-bond transactions — move cargo under bond without paying duty
              </p>
            </div>
            <Button asChild className="gap-1.5 h-10 rounded-xl shrink-0">
              <Link to="/inbond/new">
                <Plus className="h-4 w-4" />
                New In-Bond
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Transport-pending banner */}
      {!bannerDismissed && (
        <div
          className="rounded-lg border border-blue-500/30 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 px-3 py-2.5 flex items-start gap-2 opacity-0 animate-fade-in-up"
          style={{ animationFillMode: 'forwards', animationDelay: '15ms' }}
        >
          <Radio className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">
            Transmission to CBP activates once our direct ABI connection is live. Until
            then, validated filings queue as <span className="font-semibold">Ready</span> and
            transmit automatically when the connection opens.
          </span>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-blue-500/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <Card
        className="opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards', animationDelay: '30ms' }}
      >
        <CardContent className="pt-6">
          <form
            onSubmit={handleFilterSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={statusParam ?? STATUS_ALL}
                onValueChange={(value) => updateParam('status', value === STATUS_ALL ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                  {INBOND_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input
                placeholder="In-bond number, bill or carrier"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="gap-1.5">
                <Search className="h-4 w-4" />
                Apply
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card
        className="opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards', animationDelay: '60ms' }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {!isLoading && !isError
              ? `${filings.length} filing${filings.length === 1 ? '' : 's'}`
              : 'Filings'}
          </CardTitle>
          <CardDescription>Click a row to view details</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs pl-4">Type</TableHead>
                  <TableHead className="text-xs">In-Bond #</TableHead>
                  <TableHead className="text-xs">Primary Bill</TableHead>
                  <TableHead className="text-xs">Carrier</TableHead>
                  <TableHead className="text-xs">Dest. Port</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Events</TableHead>
                  <TableHead className="text-xs">Updated</TableHead>
                  <TableHead className="text-xs w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {isError && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center">
                      <p className="text-sm text-destructive">
                        Failed to load in-bond filings: {(error as any)?.message ?? 'Unknown error'}
                      </p>
                    </TableCell>
                  </TableRow>
                )}

                {isEmptyFiltered && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No filings match these filters.
                      </p>
                      <Button variant="link" size="sm" className="mt-1" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </TableCell>
                  </TableRow>
                )}

                {isEmptyAbsolute && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                          <FilePlus className="h-6 w-6 text-teal-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">No in-bond movements yet</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            File an IT, T&amp;E or IE to move cargo under bond.
                          </p>
                        </div>
                        <Button asChild size="sm" className="gap-1.5 mt-1">
                          <Link to="/inbond/new">
                            <Plus className="h-4 w-4" />
                            Create your first in-bond
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  filings.map((filing) => {
                    const editable = filing.status === 'DRAFT' || filing.status === 'READY';
                    return (
                      <TableRow
                        key={filing.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => navigate(`/inbond/${filing.id}`)}
                      >
                        <TableCell className="pl-4">
                          <InbondTypeBadge entryType={filing.entryType} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {filing.inbondNumber ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {filing.primaryBill ? (
                            <span className="block max-w-[160px] truncate" title={filing.primaryBill}>
                              {filing.primaryBill}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {filing.carrierCode ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {filing.portOfDestination ?? '—'}
                        </TableCell>
                        <TableCell>
                          <InbondStatusPill status={filing.status} />
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {filing._count?.events ?? 0}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {filing.updatedAt
                            ? formatDistanceToNow(new Date(filing.updatedAt), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/inbond/${filing.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {editable && (
                                <DropdownMenuItem
                                  onClick={() => navigate(`/inbond/${filing.id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {editable && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setPendingDelete(filing)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete in-bond filing?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.inbondNumber
                ? `In-bond ${pendingDelete.inbondNumber} and any recorded events will be permanently removed.`
                : 'This filing and any data entered will be permanently removed.'}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFiling.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteFiling.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFiling.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
