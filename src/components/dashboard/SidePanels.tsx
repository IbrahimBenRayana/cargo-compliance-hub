import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { AwaitingItem, DashboardResponse, Stage } from '@/types/dashboard';
import { FILL, type Tone } from './tones';

function Panel({ title, aside, index, children }: { title: string; aside?: ReactNode; index: number; children: ReactNode }) {
  return (
    <section className="dash-in min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-card" style={{ '--i': index } as React.CSSProperties}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {aside && <span className="text-[12.5px] tabular-nums text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function CutoffPanel({ horizon, index }: { horizon: NonNullable<DashboardResponse['horizon']>; index: number }) {
  const { buckets, bucketHours } = horizon;
  const max = Math.max(...buckets, 1);
  const in24 = buckets.slice(0, 24 / bucketHours).reduce((a, b) => a + b, 0);
  const total = buckets.reduce((a, b) => a + b, 0);
  return (
    <Panel title="ISF cutoffs" aside="Next 72 hours" index={index}>
      <div role="img" aria-label={`${total} ISF cutoffs in the next 72 hours, ${in24} within 24 hours.`} className="group/chart mt-3 flex h-[88px] items-end gap-1">
        {buckets.map((n, i) => {
          const soon = (i + 1) * bucketHours <= 24;
          return (
            <div key={i} className="group/bar relative flex h-full min-w-0 flex-1 items-end">
              <div
                className={cn('dash-col w-full rounded-t-[3px] rounded-b-[1px]', n === 0 ? 'bg-border' : soon ? FILL.urgent : FILL.soon, 'can-hover:group-hover/chart:opacity-50 can-hover:group-hover/bar:!opacity-100')}
                style={{ height: n ? `${Math.max((n / max) * 100, 8)}%` : '2px', '--i': i } as React.CSSProperties}
              />
              {/* The outer bars anchor their tip inward so it stays inside the page. */}
              <span
                className="dash-tip pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[12px] shadow-sm"
                style={{ left: i < 2 ? '0%' : i >= buckets.length - 2 ? '100%' : '50%', '--tx': i < 2 ? '0%' : i >= buckets.length - 2 ? '-100%' : '-50%' } as React.CSSProperties}
              >
                {n} in {i * bucketHours} to {(i + 1) * bucketHours}h
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>Now</span><span>24h</span><span>48h</span><span>72h</span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-[2px]', FILL.urgent)} /><b className="font-medium tabular-nums text-foreground">{in24}</b> within 24h</span>
        <span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-[2px]', FILL.soon)} /><b className="font-medium tabular-nums text-foreground">{total - in24}</b> within 72h</span>
      </div>
    </Panel>
  );
}

function awaitingWords(a: AwaitingItem, now: number): { text: string; tone: Tone; pulse: boolean } {
  const ago = a.sentAt ? formatDuration(now - new Date(a.sentAt).getTime()) : null;
  switch (a.state) {
    case 'NO_RESPONSE': return { text: ago ? `No response, ${ago}` : 'No response', tone: 'soon', pulse: false };
    case 'UNKNOWN': return { text: 'Outcome unknown', tone: 'urgent', pulse: false };
    case 'CONDITIONAL': return { text: 'Conditional', tone: 'soon', pulse: false };
    case 'QUEUED': return { text: 'Queued', tone: 'calm', pulse: true };
    default: return { text: ago ? `Sent ${ago} ago` : 'Sent', tone: 'info', pulse: true };
  }
}

export function AwaitingPanel({ awaiting, now, index }: { awaiting: DashboardResponse['awaiting']; now: number; index: number }) {
  return (
    <Panel title="Awaiting response" aside={awaiting.count.toLocaleString()} index={index}>
      {awaiting.items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Nothing is waiting.</p>
      ) : (
        <ul className="-mx-2 mt-1.5">
          {awaiting.items.map((a) => {
            const { text, tone, pulse } = awaitingWords(a, now);
            return (
              <li key={a.id}>
                <Link to={a.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors duration-150 can-hover:hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                      {pulse && <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping motion-reduce:animate-none', FILL[tone])} />}
                      <span className={cn('relative h-1.5 w-1.5 rounded-full', FILL[tone])} />
                    </span>
                    <span className="min-w-0 truncate font-mono text-[12.5px]">{a.ref}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function BarRow({ label, count, share, tone, index }: { label: string; count: number; share: number; tone: Tone; index: number }) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate" title={label}>{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{count.toLocaleString()}</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn('dash-bar block h-full rounded-full', FILL[tone])} style={{ transform: `scaleX(${share})`, '--i': index } as React.CSSProperties} />
      </span>
    </>
  );
}

const STAGE_TONE: Record<Stage, Tone> = {
  isf_to_send: 'info', isf_sent: 'info', entry_needed: 'soon', entry_to_send: 'entry', entry_sent: 'entry', accepted: 'done',
};

export function StagePanel({ flow, index }: { flow: DashboardResponse['flow']; index: number }) {
  const max = Math.max(...flow.map((s) => s.count), 1);
  return (
    <Panel title="Shipments by stage" index={index}>
      <ul className="-mx-2 mt-1.5">
        {flow.map((s, i) => (
          <li key={s.key}>
            <Link to={s.href} className="block rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 can-hover:hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
              <BarRow label={s.label} count={s.count} share={s.count / max} tone={STAGE_TONE[s.key]} index={i} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CountPanel({ title, aside, items, tone, index }: { title: string; aside?: string; items: Array<{ label: string; count: number }>; tone: Tone; index: number }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <Panel title={title} aside={aside} index={index}>
      <ul className="mt-2 space-y-2.5">
        {items.map((it, i) => (
          <li key={it.label}><BarRow label={it.label} count={it.count} share={it.count / max} tone={tone} index={i} /></li>
        ))}
      </ul>
    </Panel>
  );
}
