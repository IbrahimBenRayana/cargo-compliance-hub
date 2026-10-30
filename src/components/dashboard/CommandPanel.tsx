import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { formatDuration } from '@/lib/countdown';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';
import type { DashboardResponse } from '@/types/dashboard';

interface Props {
  attention: DashboardResponse['attention'];
  horizon: DashboardResponse['horizon'];
  updatedAt: number;
  isStale: boolean;
  now: number;
  canCreate: boolean;
  canEnter: boolean;
  onRetry: () => void;
}

const BRACKETS = 'M0 14V4a4 4 0 0 1 4-4h10M86 0h10a4 4 0 0 1 4 4v10M100 86v10a4 4 0 0 1-4 4H86M14 100H4a4 4 0 0 1-4-4V86';

/** The logo's four brackets, locked on the one number that matters. */
function FocusedCount({ value }: { value: number }) {
  const shown = useCountUp(value);
  const clear = value === 0;
  return (
    <div className="relative grid h-[116px] w-[116px] shrink-0 place-items-center sm:h-[132px] sm:w-[132px]" aria-hidden>
      <svg viewBox="-2 -2 104 104" className="absolute inset-0 h-full w-full text-[hsl(43_96%_56%)]">
        <path d={BRACKETS} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {clear
        ? <span className="h-9 w-9 rounded-[10px] bg-[hsl(43_96%_56%)]" />
        : <span className="text-[56px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[64px]">{shown.toLocaleString()}</span>}
    </div>
  );
}

function sentence(a: Props['attention'], now: number) {
  const next = a.nextCutoffAt ? `Next cutoff in ${formatDuration(new Date(a.nextCutoffAt).getTime() - now)}.` : null;
  if (a.now === 0) {
    return { count: null, lead: a.soon === 0 ? 'Nothing needs you right now.' : `Nothing urgent. ${a.soon.toLocaleString()} coming up.`, tail: next };
  }
  const overdue = a.overdue > 0 ? `${a.overdue.toLocaleString()} overdue.` : null;
  return { count: a.now, lead: `${a.now === 1 ? 'item needs' : 'items need'} you now.`, tail: [overdue, next].filter(Boolean).join(' ') || null };
}

function Horizon({ horizon }: { horizon: NonNullable<Props['horizon']> }) {
  const { buckets, bucketHours } = horizon;
  const max = Math.max(...buckets, 1);
  const total = buckets.reduce((a, b) => a + b, 0);
  const in24 = buckets.slice(0, 24 / bucketHours).reduce((a, b) => a + b, 0);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium text-white/70">ISF cutoffs, next 72 hours</h2>
        <span className="text-[13px] tabular-nums text-white/70"><span className="font-semibold text-white">{in24}</span> within 24h</span>
      </div>
      <div
        role="img"
        aria-label={`${total} ISF cutoffs in the next 72 hours, ${in24} within 24 hours.`}
        className="mt-3 flex h-[104px] items-end gap-1.5"
      >
        {buckets.map((n, i) => {
          const urgent = (i + 1) * bucketHours <= 24;
          return (
            <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 items-end">
              <div
                className={cn('grow-y w-full rounded-t-[4px] rounded-b-[1px]', n === 0 ? 'bg-white/10' : urgent ? 'bg-[hsl(0_90%_72%)]' : 'bg-[hsl(43_96%_56%)]')}
                style={{ height: n ? `${Math.max((n / max) * 100, 10)}%` : '3px', '--i': i } as React.CSSProperties}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[12px] font-medium text-[hsl(222_47%_11%)] shadow-lg group-hover/bar:block">
                {n} {n === 1 ? 'cutoff' : 'cutoffs'}, {i * bucketHours}-{(i + 1) * bucketHours}h
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] tabular-nums text-white/55">
        <span>Now</span><span>24h</span><span>48h</span><span>72h</span>
      </div>
      <div className="mt-2 flex gap-4 text-[11.5px] text-white/65">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[hsl(0_90%_72%)]" />Within 24h</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[hsl(43_96%_56%)]" />24 to 72h</span>
      </div>
    </div>
  );
}

export function CommandPanel({ attention, horizon, updatedAt, isStale, now, canCreate, canEnter, onRetry }: Props) {
  const { count, lead, tail } = sentence(attention, now);
  const date = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const ago = formatDuration(now - updatedAt);
  const pill = 'inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13.5px] font-medium transition-colors duration-150 can-hover:hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
  return (
    <section aria-label="What needs you" className="command-panel rise flex h-full flex-col justify-between gap-7 rounded-[22px] p-5 sm:p-7">
      <div className={cn('grid gap-7', horizon && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-9')}>
        <div className="flex min-w-0 items-center gap-5">
          <FocusedCount value={attention.now} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-balance sm:text-[26px]">
              {count !== null && <span className="sr-only">{count.toLocaleString()} </span>}
              {lead}
            </h1>
            {tail && <p className="mt-2 text-[14px] leading-5 text-white/70">{tail}</p>}
          </div>
        </div>
        {horizon && <Horizon horizon={horizon} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link to="/shipments/new" className="group inline-flex h-10 items-center gap-2 rounded-full bg-[hsl(43_96%_56%)] pl-4 pr-1.5 text-[13.5px] font-semibold text-[hsl(222_47%_11%)] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              New shipment
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[hsl(222_47%_11%)]/10 transition-transform duration-200 can-hover:group-hover:translate-x-0.5 can-hover:group-hover:-translate-y-px">
                <Plus className="h-4 w-4" aria-hidden />
              </span>
            </Link>
            {canEnter && (
              <Link to="/abi-documents/new" className={pill}>
                New entry
                <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            )}
            <Link to="/manifest-query" className={pill}>
              <Search className="h-3.5 w-3.5 opacity-70" aria-hidden />
              Manifest query
            </Link>
          </div>
        )}
        <p className="text-[12.5px] tabular-nums text-white/60">
          {isStale ? (
            <>
              Could not refresh. Showing {new Date(updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.{' '}
              <button type="button" onClick={onRetry} className="text-white underline">Retry</button>
            </>
          ) : (
            <>{date}. Updated {ago === '<1m' ? 'just now' : `${ago} ago`}.</>
          )}
        </p>
      </div>
    </section>
  );
}
