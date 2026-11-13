/**
 * Entry documents: every entry summary, paged and counted on the server,
 * in the same shape as the Shipments list. The tab, search and page live in
 * the address, so Back from an entry returns to the same view.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, FilePlus, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from '@/components/icons';
import { toast } from 'sonner';
import type { AbiDocument } from '@/api/client';
import { FilterTabs } from '@/components/dashboard/FilterTabs';
import { Pagination } from '@/components/dashboard/Pagination';
import { TINT } from '@/components/dashboard/tones';
import { EntryStatusPill, EntryStatusTile } from '@/components/entries/EntryStatus';
import { ENTRY_TABS, entryTabsWithCounts, isEntryTab } from '@/components/entries/status';
import { usePortName } from '@/components/shipment-detail/usePortName';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ENTRY_TYPES } from '@/data/abiEnums';
import { useAbiDocumentFacets, useAbiDocumentsPage, useDeleteAbiDocument } from '@/hooks/useAbiDocument';
import { useNow } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const TH = 'px-3 py-2 text-left text-[12px] font-medium text-muted-foreground';
const ROW = 'group relative border-t border-border/60 transition-colors duration-150 can-hover:hover:bg-muted/40';
const LINK = 'font-mono text-[13px] font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';

const TYPE_LABEL: Record<string, string> = Object.fromEntries(ENTRY_TYPES.map((t) => [t.value, t.label]));

/** Coarse on purpose: "3h ago", not "3h 12m ago". */
function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return minutes < 1 ? 'Just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Typing waits a moment before it asks the server. */
function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const [text, setText] = useState(value);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => setText((t) => (t.trim() === value ? t : value)), [value]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text.trim() !== value) latest.current(text.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, value]);
  return (
    <div className="relative w-full sm:w-60">
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-8 pl-8 text-[13px] [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => setText('')} className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground outline-none can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function Port({ code }: { code: string | null }) {
  const name = usePortName(code);
  if (!code) return <span className="text-muted-foreground">Not set</span>;
  return (
    <>
      <span className="font-mono text-[12.5px]">{code}</span>
      {name && <span className="block truncate text-[12px] text-muted-foreground" title={name}>{name}</span>}
    </>
  );
}

function Notice({ icon: Icon, tone, title, children }: { icon: typeof Search; tone: 'info' | 'urgent' | 'calm'; title: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-14 text-center">
      <span className={cn('mx-auto grid h-10 w-10 place-items-center rounded-xl', TINT[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-[13px] font-medium">{title}</p>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading entries" className={PAGE}>
      <div className="space-y-2"><div className="dash-sk h-7 w-44" /><div className="dash-sk h-4 w-56" style={{ '--i': 1 } as React.CSSProperties} /></div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
        <div className="flex gap-5 border-b border-border px-4 pb-3 pt-4">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="dash-sk h-4 w-16" style={{ '--i': i } as React.CSSProperties} />)}
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border/60 px-4 py-3 first:border-t-0">
            <div className="dash-sk h-7 w-7 shrink-0 rounded-lg" style={{ '--i': i } as React.CSSProperties} />
            <div className="dash-sk h-3.5 w-40" style={{ '--i': i } as React.CSSProperties} />
            <div className="dash-sk hidden h-3.5 flex-1 md:block" style={{ '--i': i } as React.CSSProperties} />
            <div className="dash-sk h-5 w-16 rounded-md" style={{ '--i': i } as React.CSSProperties} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ABIDocumentsListPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();

  const tabParam = params.get('tab');
  const tab = isEntryTab(tabParam) ? tabParam : 'all';
  const mbol = params.get('mbol') ?? '';
  const entry = params.get('entry') ?? '';
  const page = Math.max(1, parseInt(params.get('page') ?? '', 10) || 1);
  /** Any change but the page itself starts again at page 1. */
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (!('page' in patch)) next.delete('page');
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || (k === 'tab' && v === 'all') || (k === 'page' && v === '1')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const search = { mbolNumber: mbol || undefined, entryNumber: entry || undefined };
  const statuses = ENTRY_TABS.find((t) => t.key === tab)!.statuses;
  const list = useAbiDocumentsPage({ ...search, status: statuses.join(',') || undefined, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
  const facets = useAbiDocumentFacets(search);
  const deleteDoc = useDeleteAbiDocument();
  const [pendingDelete, setPendingDelete] = useState<AbiDocument | null>(null);

  const docs = list.data?.data ?? [];
  const total = list.data?.pagination.total ?? 0;
  const pageCount = Math.max(1, list.data?.pagination.totalPages ?? 1);
  const busy = list.isFetching && list.isPlaceholderData;

  // Deleting can empty the last page; step back to the one that is left.
  useEffect(() => {
    if (!list.isFetching && list.data && page > pageCount) update({ page: String(pageCount) });
  }, [list.isFetching, list.data, page, pageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  if (list.isLoading) return <Skeleton />;

  const tabs = entryTabsWithCounts(facets.data?.status);
  const all = tabs[0].count;
  const toSend = (facets.data?.status.DRAFT ?? 0) + (facets.data?.status.REJECTED ?? 0);
  const filtered = !!(mbol || entry);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDoc.mutateAsync(pendingDelete.id);
      toast.success('Draft entry deleted.');
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err?.status === 429 ? 'Please wait a moment before trying again.' : err?.body?.error || err?.message || 'The entry was not deleted.');
    }
  };

  let body: React.ReactNode;
  if (list.isError && !list.data) {
    body = (
      <Notice icon={AlertTriangle} tone="urgent" title="We could not load your entries.">
        <Button size="sm" className="mt-4" onClick={() => list.refetch()}>Try again</Button>
      </Notice>
    );
  } else if (total === 0 && !filtered && tab === 'all') {
    body = (
      <Notice icon={FilePlus} tone="info" title="No entries yet.">
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">Each entry summary you start shows here with where it stands with CBP.</p>
        <Button size="sm" className="mt-4" asChild><Link to="/abi-documents/new"><Plus aria-hidden />New entry</Link></Button>
      </Notice>
    );
  } else if (total === 0) {
    body = (
      <Notice icon={Search} tone="calm" title={filtered ? 'No entries match this search.' : 'No entries here.'}>
        {filtered && <Button size="sm" variant="outline" className="mt-4" onClick={() => update({ mbol: null, entry: null })}>Clear search</Button>}
      </Notice>
    );
  } else {
    body = (
      <>
        <div className={cn('transition-opacity duration-150', busy && 'opacity-60')}>
          <table className="w-full table-fixed text-[13px]">
            <thead className="max-sm:sr-only">
              <tr>
                <th scope="col" className={cn(TH, 'pl-4')}>Entry</th>
                <th scope="col" className={cn(TH, 'hidden w-[22%] md:table-cell')}>Importer</th>
                <th scope="col" className={cn(TH, 'hidden w-[150px] lg:table-cell')}>Master bill</th>
                <th scope="col" className={cn(TH, 'hidden w-[18%] xl:table-cell')}>Port of entry</th>
                <th scope="col" className={cn(TH, 'w-[108px]')}>Status</th>
                <th scope="col" className={cn(TH, 'hidden w-[96px] sm:table-cell')}>Created</th>
                <th scope="col" className="w-12 pr-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody key={`${tab}-${page}-${mbol}-${entry}`}>
              {docs.map((doc) => (
                <tr key={doc.id} className={cn(ROW, 'dash-row')}>
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <EntryStatusTile status={doc.status} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/abi-documents/${doc.id}`} className={cn(LINK, 'block truncate', !doc.entryNumber && 'font-sans')}>
                          {doc.entryNumber ?? 'No entry number yet'}
                        </Link>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          <span className="max-md:hidden">{TYPE_LABEL[doc.entryType] ?? (doc.entryType ? `Type ${doc.entryType}` : 'No entry type')}</span>
                          <span className="md:hidden">{doc.iorName || 'No importer yet'}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden truncate px-3 py-2.5 md:table-cell" title={doc.iorName ?? undefined}>{doc.iorName || <span className="text-muted-foreground">Not set</span>}</td>
                  <td className="hidden truncate px-3 py-2.5 font-mono text-[12.5px] lg:table-cell">{doc.mbolNumber || <span className="font-sans text-[13px] text-muted-foreground">Not set</span>}</td>
                  <td className="hidden px-3 py-2.5 xl:table-cell"><Port code={doc.portOfEntry} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5"><EntryStatusPill status={doc.status} /></td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground sm:table-cell">
                    {doc.createdAt && <time dateTime={doc.createdAt} title={new Date(doc.createdAt).toLocaleString()}>{ago(doc.createdAt, now)}</time>}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {doc.status === 'DRAFT' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="relative z-10 h-7 w-7" aria-label={`Actions for ${doc.entryNumber ?? 'draft entry'}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setPendingDelete(doc)}>
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={(p) => update({ page: String(p) })} label="Entry pages" layoutId="entries-page" />
      </>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={PAGE}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Entry documents</h1>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {facets.data ? (
                <>
                  {all.toLocaleString()} {all === 1 ? 'entry' : 'entries'}{filtered ? ' match your search' : ''}
                  {toSend > 0 && <>, <span className="font-medium text-soon">{toSend.toLocaleString()} to send or fix</span></>}.
                </>
              ) : ' '}
              {list.isRefetchError && <> Could not refresh. <button type="button" onClick={() => list.refetch()} className="text-foreground underline underline-offset-2">Retry</button></>}
            </p>
          </div>
          <Button asChild size="sm"><Link to="/abi-documents/new"><Plus aria-hidden />New entry</Link></Button>
        </header>

        <section aria-label="Entries" className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
          <div className="border-b border-border pt-3">
            <FilterTabs items={tabs} active={tab} onChange={(t) => update({ tab: t })} layoutId="entries-tab" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <SearchBox value={entry} onChange={(v) => update({ entry: v })} label="Search by entry number" placeholder="Entry number" />
            <SearchBox value={mbol} onChange={(v) => update({ mbol: v })} label="Search by master bill" placeholder="Master bill" />
            {filtered && <Button variant="ghost" size="sm" className="h-8 text-[13px] text-muted-foreground" onClick={() => update({ mbol: null, entry: null })}>Clear search</Button>}
          </div>
          {busy && <div className="dash-progress" role="progressbar" aria-label="Loading entries" />}
          {body}
        </section>

        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this draft entry?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete?.entryNumber ? `Entry ${pendingDelete.entryNumber} and everything entered on it` : 'This draft and everything entered on it'} will be permanently removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteDoc.isPending}>Keep draft</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                disabled={deleteDoc.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteDoc.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : 'Delete draft'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MotionConfig>
  );
}
