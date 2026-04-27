import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, Loader2, FilePlus,
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
import { cn } from '@/lib/utils';
import { useAbiDocumentsList, useDeleteAbiDocument } from '@/hooks/useAbiDocument';
import type { AbiDocument, AbiDocumentStatus } from '@/api/client';
import {
  ABI_DOCUMENT_STATUSES,
  ABI_DOCUMENT_STATUS_MAP,
  ENTRY_TYPES,
} from '@/data/abiEnums';

const PAGE_SIZE = 20;
const STATUS_ALL = 'all';

const ENTRY_TYPE_LABELS: Record<string, string> = ENTRY_TYPES.reduce(
  (acc, t) => {
    acc[t.value] = t.label;
    return acc;
  },
  {} as Record<string, string>,
);

function StatusPill({ status }: { status: AbiDocumentStatus }) {
  const cfg = ABI_DOCUMENT_STATUS_MAP[status];
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

export default function ABIDocumentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const statusParam = (searchParams.get('status') as AbiDocumentStatus | null) ?? null;
  const mbolParam = searchParams.get('mbol') ?? '';
  const entryParam = searchParams.get('entry') ?? '';
  const skip = Number(searchParams.get('skip') ?? '0') || 0;

  // Local input state so typing doesn't thrash the URL on every keystroke.
  const [mbolInput, setMbolInput] = useState(mbolParam);
  const [entryInput, setEntryInput] = useState(entryParam);

  const [pendingDelete, setPendingDelete] = useState<AbiDocument | null>(null);

  const { data, isLoading, isError, error } = useAbiDocumentsList({
    status: statusParam ?? undefined,
    mbolNumber: mbolParam || undefined,
    entryNumber: entryParam || undefined,
    skip,
    take: PAGE_SIZE,
  });

  const deleteDoc = useDeleteAbiDocument();

  const docs = data?.data ?? [];
  const pagination = data?.pagination;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
    // Reset skip on any filter change (but not when paging).
    if (key !== 'skip') next.delete('skip');
    setSearchParams(next, { replace: true });
  };

  const handleStatusChange = (value: string) => {
    updateParam('status', value === STATUS_ALL ? null : value);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (mbolInput.trim()) next.set('mbol', mbolInput.trim());
    else next.delete('mbol');
    if (entryInput.trim()) next.set('entry', entryInput.trim());
    else next.delete('entry');
    next.delete('skip');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setMbolInput('');
    setEntryInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDoc.mutateAsync(pendingDelete.id);
      toast.success('Entry deleted');
      setPendingDelete(null);
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Failed to delete entry');
      }
    }
  };

  const hasActiveFilters = !!(statusParam || mbolParam || entryParam);
  const isEmptyFiltered = !isLoading && docs.length === 0 && hasActiveFilters;
  const isEmptyAbsolute = !isLoading && docs.length === 0 && !hasActiveFilters;

  const currentPage = pagination ? Math.floor(pagination.skip / pagination.take) + 1 : 1;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Page header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Entry Documents</h1>
            <p className="text-sm text-muted-foreground">
              ABI Entry Summary 7501 filings transmitted to U.S. Customs
            </p>
          </div>
        </div>
        <Button asChild className="gap-1.5">
          <Link to="/abi-documents/new">
            <Plus className="h-4 w-4" />
            New Entry
          </Link>
        </Button>
      </div>

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
              <Select value={statusParam ?? STATUS_ALL} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                  {ABI_DOCUMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Entry Number</label>
              <Input
                placeholder="e.g. 123-4567890-1"
                value={entryInput}
                onChange={(e) => setEntryInput(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">MBOL</label>
              <Input
                placeholder="Master BOL"
                value={mbolInput}
                onChange={(e) => setMbolInput(e.target.value)}
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
            {pagination ? `${pagination.total} entr${pagination.total === 1 ? 'y' : 'ies'}` : 'Entries'}
          </CardTitle>
          <CardDescription>Click a row to view details</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs pl-4">Entry Number</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">MBOL</TableHead>
                  <TableHead className="text-xs">IOR</TableHead>
                  <TableHead className="text-xs">Port</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {isError && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <p className="text-sm text-destructive">
                        Failed to load entries: {(error as any)?.message ?? 'Unknown error'}
                      </p>
                    </TableCell>
                  </TableRow>
                )}

                {isEmptyFiltered && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No entries match these filters.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    </TableCell>
                  </TableRow>
                )}

                {isEmptyAbsolute && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <FilePlus className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">No entries yet</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Get started by filing your first Entry Summary 7501.
                          </p>
                        </div>
                        <Button asChild size="sm" className="gap-1.5 mt-1">
                          <Link to="/abi-documents/new">
                            <Plus className="h-4 w-4" />
                            Create your first Entry Summary 7501
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  docs.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/abi-documents/${doc.id}`)}
                    >
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs">
                          {doc.entryNumber ?? <span className="text-muted-foreground italic">Draft</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={doc.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ENTRY_TYPE_LABELS[doc.entryType] ?? doc.entryType ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {doc.mbolNumber ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {doc.iorName ? (
                          <span className="block max-w-[180px] truncate" title={doc.iorName}>
                            {doc.iorName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {doc.portOfEntry ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {doc.createdAt
                          ? formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })
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
                            <DropdownMenuItem
                              onClick={() => navigate(`/abi-documents/${doc.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {doc.status === 'DRAFT' && (
                              <DropdownMenuItem
                                onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {doc.status === 'DRAFT' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setPendingDelete(doc)}
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
                  ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > pagination.take && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} — {pagination.total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={skip <= 0}
                  onClick={() =>
                    updateParam('skip', String(Math.max(0, skip - PAGE_SIZE)))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={skip + PAGE_SIZE >= pagination.total}
                  onClick={() => updateParam('skip', String(skip + PAGE_SIZE))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.entryNumber
                ? `Entry ${pendingDelete.entryNumber} and any draft data will be permanently removed.`
                : 'This draft and any data entered will be permanently removed.'}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDoc.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteDoc.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDoc.isPending ? (
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
