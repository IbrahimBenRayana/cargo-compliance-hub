/**
 * The top of a shipment: its state in one sentence on the status colour, the
 * number that matters beside it (time to the ISF cutoff, or the ISF number),
 * and the voyage facts a filer checks first underneath.
 */
import { FILL, type Tone } from '@/components/dashboard/tones';
import { cutoffMatters, statusOf } from '@/components/shipments/status';
import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { Filing } from '@/types/shipment';
import { CopyButton } from './CopyButton';
import { relDay, stamp, type Summary } from './summary';
import { isUsPort, usePortName } from './usePortName';

const BAND: Record<Tone, string> = {
  urgent: 'bg-urgent-tint', soon: 'bg-soon-tint', info: 'bg-info-tint', entry: 'bg-entry-tint', done: 'bg-done-tint', calm: 'bg-muted/60',
};
const TEXT: Record<Tone, string> = {
  urgent: 'text-urgent', soon: 'text-soon', info: 'text-info', entry: 'text-entry', done: 'text-done', calm: 'text-foreground',
};

function day(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function Fact({ label, sub, mono, children }: { label: string; sub?: React.ReactNode; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-[14px] font-medium', mono && 'font-mono text-[13.5px]')}>
        {children || <span className="font-sans font-normal text-muted-foreground">Not on file</span>}
      </dd>
      {sub && <dd className="truncate text-[12px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** The number worth the most room: how long is left, or the ISF number to quote. */
function Aside({ filing, now, tone }: { filing: Filing; now: number; tone: Tone }) {
  if (cutoffMatters(filing.status) && filing.cutoff) {
    const left = new Date(filing.cutoff.at).getTime() - now;
    const about = filing.cutoff.basis === 'ETD_ESTIMATE' && left >= 0 ? 'About ' : '';
    return (
      <div className="sm:text-right">
        <p className="text-[12px] text-foreground/70">ISF cutoff</p>
        <p className={cn('text-[20px] font-semibold leading-7 tabular-nums tracking-[-0.01em]', TEXT[tone])}>
          <time dateTime={filing.cutoff.at}>{about}{formatDuration(left)} {left < 0 ? 'over' : 'left'}</time>
        </p>
      </div>
    );
  }
  if (filing.cbpTransactionId) {
    return (
      <div className="sm:text-right">
        <p className="text-[12px] text-foreground/70">ISF number</p>
        <p className="flex items-center gap-1 sm:justify-end">
          <span className="font-mono text-[15px] font-semibold">{filing.cbpTransactionId}</span>
          <CopyButton value={filing.cbpTransactionId} label="ISF number" />
        </p>
      </div>
    );
  }
  return null;
}

export function SummaryCard({ filing, summary, now }: { filing: Filing; summary: Summary; now: number }) {
  const { icon: Icon } = statusOf(filing.status);
  const usPort = [filing.isf5Data?.USPortOfArrival, filing.foreignPortOfUnlading, filing.placeOfDelivery].find(isUsPort) ?? null;
  const otherPort = usPort ? null : filing.foreignPortOfUnlading || filing.placeOfDelivery || null;
  const portName = usePortName(usPort ?? otherPort);
  const { estimatedDeparture: etd, estimatedArrival: eta, cutoff } = filing;

  return (
    <section aria-label="Status" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4', BAND[summary.tone])}>
        <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL[summary.tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[16px] font-semibold leading-6">{summary.title}</p>
          {summary.detail && <p className="mt-0.5 text-[13px] text-foreground/75">{summary.detail}</p>}
        </div>
        <Aside filing={filing} now={now} tone={summary.tone} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Est. departure" sub={etd ? relDay(etd, now) ?? undefined : undefined}>{etd && day(etd)}</Fact>
        <Fact label="Est. arrival" sub={eta ? relDay(eta, now) ?? undefined : undefined}>{eta && day(eta)}</Fact>
        <Fact label="ISF cutoff" sub={cutoff ? (cutoff.basis === 'ETD_ESTIMATE' ? 'Estimated from the sailing date' : '24 hours before lading') : undefined}>
          {cutoff && <time dateTime={cutoff.at}>{stamp(cutoff.at)}</time>}
        </Fact>
        <Fact label="Vessel" sub={filing.voyageNumber ? <>Voyage <span className="font-mono">{filing.voyageNumber}</span></> : undefined}>{filing.vesselName}</Fact>
        <Fact label={usPort ? 'US port' : 'Port of unlading'} sub={portName ?? undefined} mono>{usPort ?? otherPort}</Fact>
      </dl>
    </section>
  );
}
