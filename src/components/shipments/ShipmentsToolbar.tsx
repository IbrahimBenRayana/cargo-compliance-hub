import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, ChevronDown, Globe, Loader2, Search, Send, Trash2, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { countryName } from './countries';
import { hasFilters, toDay, type ListState } from './useListState';

const FILTER = 'h-8 gap-1.5 text-[13px] font-medium';
const ACTIVE = 'border-primary/40 text-primary';
const COUNT = 'rounded bg-primary px-1 text-[11px] tabular-nums text-primary-foreground';

const dayLabel = (d: string) => format(toDay(d), 'MMM d');

function departsLabel(from: string | null, to: string | null) {
  if (from && to) return from === to ? `Departs ${dayLabel(from)}` : `Departs ${dayLabel(from)} – ${dayLabel(to)}`;
  if (from) return `Departs from ${dayLabel(from)}`;
  if (to) return `Departs by ${dayLabel(to)}`;
  return 'Departs';
}

/** Typing waits a moment before it asks the server. */
function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(value);
  const latest = useRef(onChange);
  latest.current = onChange;
  // Follow outside changes (Clear filters, Back) without undoing a space mid-word.
  useEffect(() => setText((t) => (t.trim() === value ? t : value)), [value]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text.trim() !== value) latest.current(text.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, value]);
  return (
    <div className="relative w-full sm:w-72">
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search shipments"
        placeholder="Bill, importer, vessel or ISF number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-8 pl-8 text-[13px] [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button type="button" aria-label="Clear search" onClick={() => setText('')} className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground outline-none can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function FiltersBar({ state, update, clearFilters, origins }: {
  state: ListState; update: (p: Partial<ListState>) => void; clearFilters: () => void; origins: { code: string; count: number }[];
}) {
  const toggleOrigin = (code: string, on: boolean) =>
    update({ origins: on ? [...state.origins, code] : state.origins.filter((c) => c !== code) });
  const range = { from: state.from ? toDay(state.from) : undefined, to: state.to ? toDay(state.to) : undefined };
  const dated = !!(state.from || state.to);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <SearchBox value={state.q} onChange={(q) => update({ q })} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(FILTER, state.origins.length > 0 && ACTIVE)}>
            <Globe className="h-3.5 w-3.5" aria-hidden />
            Origin
            {state.origins.length > 0 && <span className={COUNT}>{state.origins.length}</span>}
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          {origins.length === 0 ? (
            <p className="px-2 py-3 text-[12.5px] text-muted-foreground">No countries of origin on file yet.</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {origins.map((o) => (
                <li key={o.code}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] can-hover:hover:bg-muted">
                    <Checkbox checked={state.origins.includes(o.code)} onCheckedChange={(v) => toggleOrigin(o.code, v === true)} />
                    <span className="flex-1 truncate">{countryName(o.code)}</span>
                    <span className="tabular-nums text-muted-foreground">{o.count.toLocaleString()}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(FILTER, dated && ACTIVE)}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {departsLabel(state.from, state.to)}
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(r) => update({ from: r?.from ? format(r.from, 'yyyy-MM-dd') : null, to: r?.to ? format(r.to, 'yyyy-MM-dd') : null })}
            initialFocus
          />
          {dated && (
            <div className="border-t border-border px-3 py-2 text-right">
              <Button variant="ghost" size="sm" className="h-7 text-[12.5px]" onClick={() => update({ from: null, to: null })}>Any date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {hasFilters(state) && (
        <Button variant="ghost" size="sm" className="h-8 text-[13px] text-muted-foreground" onClick={clearFilters}>Clear filters</Button>
      )}
    </div>
  );
}

export function SelectionBar({ count, drafts, sending, deleting, onSend, onDelete, onClear }: {
  count: number; drafts: number; sending: boolean; deleting: boolean; onSend: () => void; onDelete: () => void; onClear: () => void;
}) {
  const noun = drafts === 1 ? 'draft' : 'drafts';
  return (
    <div className="flex min-h-[49px] flex-wrap items-center gap-2 border-b border-border bg-primary/[0.03] px-4 py-2" role="region" aria-label="Selected shipments">
      <span className="mr-1 text-[13px] font-medium tabular-nums">{count.toLocaleString()} selected</span>
      {drafts > 0 ? (
        <>
          <Button size="sm" className="h-8 gap-1.5 text-[13px]" disabled={sending} onClick={onSend}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Send {drafts} {noun}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[13px]" disabled={deleting}>
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                Delete {drafts} {noun}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {drafts} {noun}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the selected {noun} and any documents attached to them. Shipments already sent to CBP are not affected. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep {noun}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete {noun}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {drafts < count && <span className="text-[12.5px] text-muted-foreground">Only drafts can be sent or deleted.</span>}
        </>
      ) : (
        <span className="text-[12.5px] text-muted-foreground">Only drafts can be sent or deleted.</span>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-8 text-[13px]" onClick={onClear}>Clear selection</Button>
    </div>
  );
}
