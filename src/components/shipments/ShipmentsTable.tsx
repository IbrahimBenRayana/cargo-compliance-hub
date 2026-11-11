import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Layers, Loader2, Pencil, Send } from 'lucide-react';
import { filingsApi } from '@/api/client';
import { CutoffBadge } from '@/components/dashboard/CutoffBadge';
import { FILL } from '@/components/dashboard/tones';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getFirstCommodity, type Filing, type ShipmentStatus } from '@/types/shipment';
import { countryName } from './countries';
import { cutoffMatters, refOf, STATUS } from './status';
import type { Sort } from './useListState';

const ROW = 'group relative border-t border-border/60 transition-colors duration-150 can-hover:hover:bg-muted/40';
const LINK = 'font-mono text-[13px] font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';
const TH = 'px-3 py-2 text-left text-[12px] font-medium text-muted-foreground';
/** Quiet until ticked: a column of strong rings competes with the data. */
const BOX = 'relative z-10 border-muted-foreground/45 data-[state=checked]:border-primary';

function shortDate(iso: string, now: number) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function StatusWord({ status }: { status: string }) {
  const s = STATUS[status as ShipmentStatus] ?? { word: status, tone: 'calm' as const };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[s.tone])} />
      {s.word}
    </span>
  );
}

/** Coarse on purpose: "3h ago", not "3h 12m ago". */
function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return minutes < 1 ? 'Just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : shortDate(iso, now);
}

function Cutoff({ f, now }: { f: Filing; now: number }) {
  if (!f.cutoff) return null;
  if (cutoffMatters(f.status)) return <CutoffBadge at={f.cutoff.at} basis={f.cutoff.basis} now={now} />;
  return <time dateTime={f.cutoff.at} className="tabular-nums text-muted-foreground">{shortDate(f.cutoff.at, now)}</time>;
}

/** House bills of one master: the row says how many, and lists them when asked. */
function Consolidation({ f }: { f: Filing }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['filings', 'consolidation', f.consolidationId],
    queryFn: () => filingsApi.list({ consolidationId: f.consolidationId!, sortBy: 'createdAt', sortOrder: 'asc', limit: 100 }),
    enabled: open,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium text-muted-foreground outline-none transition-colors duration-150 can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <Layers className="h-3 w-3" aria-hidden />
          {f.consolidationSize} house bills
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <p className="border-b border-border px-3 py-2 text-[12.5px] text-muted-foreground">
          Master bill <span className="font-mono text-foreground">{f.masterBol}</span>. Each house bill is its own ISF.
        </p>
        <ul className="max-h-72 overflow-auto py-1">
          {isLoading && <li className="px-3 py-2 text-[12.5px] text-muted-foreground">Loading…</li>}
          {data?.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/shipments/${s.id}`}
                aria-current={s.id === f.id ? 'page' : undefined}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] outline-none can-hover:hover:bg-muted focus-visible:bg-muted aria-[current=page]:font-medium"
              >
                <span className="truncate font-mono">{s.houseBol || s.id.slice(0, 8)}</span>
                <StatusWord status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function SortHead({ field, label, sort, dir, onSort, className }: {
  field: Sort; label: string; sort: Sort; dir: 'asc' | 'desc'; onSort: (f: Sort) => void; className?: string;
}) {
  const on = field === sort;
  const Icon = !on ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(TH, className)}>
      <button type="button" onClick={() => onSort(field)} className={cn('group/sort inline-flex items-center gap-1 outline-none transition-colors duration-150 can-hover:hover:text-foreground focus-visible:underline', on && 'text-foreground')}>
        {label}
        <Icon aria-hidden className={cn('h-3 w-3 transition-opacity duration-150', !on && 'opacity-0 can-hover:group-hover/sort:opacity-60')} />
      </button>
    </th>
  );
}

export interface TableProps {
  rows: Filing[];
  now: number;
  sort: Sort;
  dir: 'asc' | 'desc';
  onSort: (field: Sort) => void;
  canWrite: boolean;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  sendingId: string | null;
  onSend: (f: Filing) => void;
}

export function ShipmentsTable({ rows, now, sort, dir, onSort, canWrite, selected, onSelect, sendingId, onSend }: TableProps) {
  const ids = rows.map((r) => r.id);
  const picked = ids.filter((id) => selected.has(id)).length;
  const head = { sort, dir, onSort };
  return (
    <table className="w-full table-fixed text-[13px]">
      <thead className="max-sm:sr-only">
        <tr>
          {canWrite && (
            <th scope="col" className="hidden w-10 py-2 pl-4 pr-1 sm:table-cell">
              <Checkbox
                className={BOX}
                aria-label="Select every shipment on this page"
                checked={picked > 0 && picked === ids.length}
                onCheckedChange={(v) => onSelect(ids, v === true)}
              />
            </th>
          )}
          <SortHead field="masterBol" label="Shipment" {...head} className={cn(!canWrite && 'pl-4')} />
          <SortHead field="importerName" label="Importer" {...head} className="hidden w-[24%] md:table-cell xl:w-[15%]" />
          <th scope="col" className={cn(TH, 'hidden w-[17%] xl:table-cell')}>Goods</th>
          <SortHead field="status" label="Status" {...head} className="w-[100px]" />
          <SortHead field="estimatedDeparture" label="Departs" {...head} className="hidden w-[76px] lg:table-cell" />
          <SortHead field="filingDeadline" label="ISF cutoff" {...head} className="hidden w-[124px] sm:table-cell" />
          <SortHead field="createdAt" label="Created" {...head} className="hidden w-[80px] min-[1360px]:table-cell" />
          {canWrite && <th scope="col" className="hidden w-[84px] pr-4 sm:table-cell"><span className="sr-only">Actions</span></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => {
          const ref = refOf(f);
          const goods = getFirstCommodity(f);
          const on = selected.has(f.id);
          return (
            <tr key={f.id} className={cn(ROW, 'dash-row', on && 'bg-primary/[0.04]')}>
              {canWrite && (
                <td className="hidden py-2.5 pl-4 pr-1 sm:table-cell">
                  <Checkbox className={BOX} aria-label={`Select ${ref}`} checked={on} onCheckedChange={(v) => onSelect([f.id], v === true)} />
                </td>
              )}
              <td className={cn('py-2.5 pr-3', canWrite ? 'pl-4 sm:pl-3' : 'pl-4')}>
                <Link to={`/shipments/${f.id}`} className={cn(LINK, 'block truncate')}>{ref}</Link>
                <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {f.houseBol && f.masterBol && <span className="max-md:hidden">MBL <span className="font-mono">{f.masterBol}</span></span>}
                    <span className="md:hidden">{f.importerName || 'No importer yet'}</span>
                  </span>
                  {/* Phones keep the importer instead; the house bills are one tap away on the shipment. */}
                  {f.consolidationId && (f.consolidationSize ?? 0) > 1 && <span className="flex max-md:hidden"><Consolidation f={f} /></span>}
                </div>
              </td>
              <td className="hidden truncate px-3 py-2.5 md:table-cell" title={f.importerName ?? undefined}>
                {f.importerName || <span className="text-muted-foreground">Not set</span>}
              </td>
              <td className="hidden px-3 py-2.5 xl:table-cell">
                <p className="truncate" title={goods.description}>{goods.description || <span className="text-muted-foreground">Not set</span>}</p>
                {goods.countryOfOrigin && <p className="truncate text-[12px] text-muted-foreground">{countryName(goods.countryOfOrigin)}</p>}
              </td>
              <td className="w-[112px] whitespace-nowrap px-3 py-2.5">
                <StatusWord status={f.status} />
                <div className="mt-1 sm:hidden"><Cutoff f={f} now={now} /></div>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 tabular-nums lg:table-cell">
                {f.estimatedDeparture ? shortDate(f.estimatedDeparture, now) : <span className="text-muted-foreground">Not set</span>}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell"><Cutoff f={f} now={now} /></td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground min-[1360px]:table-cell">
                {f.createdAt && <time dateTime={f.createdAt} title={new Date(f.createdAt).toLocaleString()}>{ago(f.createdAt, now)}</time>}
              </td>
              {canWrite && (
                <td className="hidden py-2 pr-4 sm:table-cell">
                  {f.status === 'draft' && (
                    <div className="relative z-10 flex justify-end gap-0.5 transition-opacity duration-150 can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link to={`/shipments/${f.id}/edit`} aria-label={`Edit ${ref}`} title="Edit"><Pencil className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Send ${ref} to CBP`} title="Send to CBP" disabled={sendingId === f.id} onClick={() => onSend(f)}>
                        {sendingId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
