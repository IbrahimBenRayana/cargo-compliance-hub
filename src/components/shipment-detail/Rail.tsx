/**
 * Beside the record: what hangs off this ISF (manifest, entry), the other
 * house bills on its master bill, and its history. Each part shows only
 * when it has something to say.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from '@/components/icons';
import { FILL, type Tone } from '@/components/dashboard/tones';
import { statusOf } from '@/components/shipments/status';
import { StatusPill } from '@/components/shipments/StatusPill';
import { Button } from '@/components/ui/button';
import { useConsolidationSiblings } from '@/hooks/useFilings';
import { cn } from '@/lib/utils';
import type { Filing } from '@/types/shipment';
import type { RelatedItem } from './related';
import { relDay, stamp } from './summary';

const H2 = 'text-[13px] font-semibold';
const TEXT: Record<Tone, string> = {
  urgent: 'text-urgent', soon: 'text-soon', info: 'text-info', entry: 'text-entry', done: 'text-done', calm: 'text-muted-foreground',
};

function Related({ items, now }: { items: RelatedItem[]; now: number }) {
  return (
    <section aria-labelledby="related-title" className="p-5">
      <h2 id="related-title" className={H2}>Related</h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const when = item.at ? relDay(item.at, now) ?? stamp(item.at) : null;
          return (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{item.title}</p>
                <p className="flex items-start gap-1.5 text-[12.5px]">
                  <span aria-hidden className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', FILL[item.tone])} />
                  <span className={TEXT[item.tone]}>{item.text}</span>
                </p>
                {when && <p className="pl-3 text-[12px] tabular-nums text-muted-foreground">{when}</p>}
              </div>
              {item.action && (
                <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-[12px]">
                  <Link to={item.action.to}>{item.action.label}<ArrowRight className="h-3 w-3" aria-hidden /></Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The other ISFs under the same master bill, one click away. */
function HouseBills({ consolidationId, currentId, masterBol }: { consolidationId: string; currentId: string; masterBol: string | null }) {
  const { data } = useConsolidationSiblings(consolidationId);
  const siblings = data?.filings ?? [];
  if (siblings.length < 2) return null;
  return (
    <section aria-labelledby="house-bills-title" className="p-5">
      <h2 id="house-bills-title" className={H2}>House bills on this master bill</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        {masterBol && <span className="font-mono">{masterBol}</span>}{masterBol && '. '}Each is its own ISF.
      </p>
      <ul className="-mx-2 mt-2">
        {siblings.map((s) => {
          const current = s.id === currentId;
          return (
            <li key={s.id}>
              <Link
                to={`/shipments/${s.id}`}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                  current ? 'bg-muted font-medium' : 'can-hover:hover:bg-muted/60',
                )}
              >
                <span className="truncate font-mono">{s.houseBol || s.id.slice(0, 8)}</span>
                <StatusPill status={s.status} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function History({ entries }: { entries: NonNullable<Filing['statusHistory']> }) {
  return (
    <section aria-labelledby="history-title" className="p-5">
      <h2 id="history-title" className={H2}>History</h2>
      <ol className="mt-3">
        {entries.map((h, i) => (
          <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden className="absolute bottom-0 left-[4px] top-3.5 w-px bg-border" />}
            <span aria-hidden className={cn('relative mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full', FILL[statusOf(h.status).tone])} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
                <span className="font-medium">{statusOf(h.status).word}</span>
                <time dateTime={h.createdAt} className="text-[12px] tabular-nums text-muted-foreground">{stamp(h.createdAt)}</time>
              </p>
              {h.message && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{h.message}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Rail({ filing, related, now }: { filing: Filing; related: RelatedItem[]; now: number }) {
  const history = filing.statusHistory ?? [];
  return (
    <aside aria-label="Related and history" className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card shadow-card lg:sticky lg:top-4">
      {related.length > 0 && <Related items={related} now={now} />}
      {filing.consolidationId && <HouseBills consolidationId={filing.consolidationId} currentId={filing.id} masterBol={filing.masterBol ?? null} />}
      {history.length > 0 && <History entries={history} />}
    </aside>
  );
}
