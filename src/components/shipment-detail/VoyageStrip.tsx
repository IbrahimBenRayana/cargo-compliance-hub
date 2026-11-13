/**
 * The voyage at a glance: where the container was stuffed, the vessel, the
 * US port, and how far the sailing has got by its estimated dates, beside
 * the ISF's own state. Dates are the filer's estimates, and say so.
 */
import { Ship } from 'lucide-react';
import { CutoffBadge } from '@/components/dashboard/CutoffBadge';
import { FILL, TINT } from '@/components/dashboard/tones';
import { formatDuration } from '@/lib/countdown';
import { cn } from '@/lib/utils';
import type { Filing, PartyInfo } from '@/types/shipment';
import { countryName } from '@/components/shipments/countries';
import { cutoffMatters } from '@/components/shipments/status';
import { StatusPill } from '@/components/shipments/StatusPill';

const LABEL = 'text-[12px] text-muted-foreground';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const stamp = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function party(value: Filing['containerStuffingLocation']): PartyInfo | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { name: value };
  } catch {
    return { name: value };
  }
}

/** Where the goods start: the stuffing location if given, else the first commodity's origin. */
function startOf(filing: Filing): { label: string; place: string } | null {
  const p = party(filing.containerStuffingLocation);
  if (p?.city || p?.country) return { label: 'Stuffed in', place: [p.city, p.country].filter(Boolean).join(', ') };
  const origin = filing.commodities?.[0]?.countryOfOrigin;
  return origin ? { label: 'Goods from', place: countryName(origin) } : null;
}

/** How far the sailing has got between its estimated departure and arrival, 0 to 1. */
export function sailing(etd: string | null | undefined, eta: string | null | undefined, now: number) {
  if (!etd) return null;
  const start = new Date(etd).getTime();
  if (now < start) return { share: 0, text: `Sails in ${formatDuration(start - now)}` };
  if (!eta) return { share: 0, text: 'Sailed, no ETA on file' };
  const end = new Date(eta).getTime();
  if (now >= end) return { share: 1, text: `ETA was ${day(eta)}` };
  return { share: (now - start) / (end - start), text: `At sea, ETA in ${formatDuration(end - now)}` };
}

function IsfPanel({ filing, now }: { filing: Filing; now: number }) {
  const s = filing.status;
  if (cutoffMatters(s)) {
    return (
      <>
        <p className={LABEL}>ISF cutoff</p>
        {filing.cutoff ? (
          <>
            <div className="mt-1.5 [&>time]:px-2.5 [&>time]:py-1 [&>time]:text-[15px]">
              <CutoffBadge at={filing.cutoff.at} basis={filing.cutoff.basis} now={now} />
            </div>
            <p className="mt-1.5 text-[12px] tabular-nums text-muted-foreground">
              {stamp(filing.cutoff.at)}
              <span className="block">{filing.cutoff.basis === 'ETD_ESTIMATE' ? 'Estimated from the sailing date' : '24 hours before lading'}</span>
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted-foreground">Add a sailing or lading date to see it.</p>
        )}
        {s === 'rejected' && <StatusPill status={s} className="mt-2" />}
      </>
    );
  }
  const when =
    s === 'accepted' || s === 'amended' ? (filing.amendedAt ?? filing.acceptedAt)
    : s === 'cancelled' ? filing.cancelledAt
    : filing.submittedAt;
  const verb = s === 'amended' ? 'Amended' : s === 'accepted' ? 'Accepted' : s === 'cancelled' ? 'Cancelled' : 'Sent';
  return (
    <>
      <p className={LABEL}>ISF</p>
      <StatusPill status={s} className="mt-1.5 px-2.5 py-1 text-[14px]" />
      {when && <p className="mt-1.5 text-[12px] tabular-nums text-muted-foreground">{verb} {stamp(when)}</p>}
    </>
  );
}

export function VoyageStrip({ filing, now }: { filing: Filing; now: number }) {
  const start = startOf(filing);
  // Shown under the names they were filed with: these fields hold US and foreign codes alike.
  const end = filing.placeOfDelivery
    ? { label: 'Place of delivery', code: filing.placeOfDelivery, also: filing.foreignPortOfUnlading && `Port of unlading ${filing.foreignPortOfUnlading}` }
    : filing.foreignPortOfUnlading ? { label: 'Port of unlading', code: filing.foreignPortOfUnlading, also: null } : null;
  const trip = sailing(filing.estimatedDeparture, filing.estimatedArrival, now);
  const share = trip?.share ?? 0;
  const vessel = filing.vesselName && (
    <>
      {filing.vesselName}
      {filing.voyageNumber && <span className="ml-1.5 font-mono text-[12px] text-muted-foreground">{filing.voyageNumber}</span>}
    </>
  );

  return (
    <section aria-label="Voyage" className="grid overflow-hidden rounded-xl border border-border/70 bg-card shadow-card lg:grid-cols-[minmax(0,1fr)_232px]">
      <div className="min-w-0 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
          <div className="min-w-0">
            <p className={LABEL}>{start?.label ?? 'From'}</p>
            <p className="truncate text-[15px] font-semibold">{start?.place ?? <span className="font-normal text-muted-foreground">Not on file</span>}</p>
          </div>
          <div className="min-w-0 text-center max-sm:hidden">
            <p className={LABEL}>Vessel</p>
            <p className="truncate text-[15px] font-semibold">{vessel || <span className="font-normal text-muted-foreground">Not on file</span>}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className={LABEL}>{end?.label ?? 'Destination'}</p>
            <p className="truncate font-mono text-[15px] font-semibold">{end?.code || <span className="font-sans font-normal text-muted-foreground">Not on file</span>}</p>
            {end?.also && <p className="truncate font-mono text-[11.5px] text-muted-foreground">{end.also}</p>}
          </div>
        </div>

        {/* The track: filled to how far the sailing has got by its estimated dates. */}
        <div className="relative mt-3 h-7" aria-hidden>
          <span className="absolute inset-x-1.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
          <span className="absolute inset-x-1.5 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full">
            <span className={cn('dash-bar block h-full w-full origin-left rounded-full', FILL.info)} style={{ transform: `scaleX(${share})` }} />
          </span>
          <span className={cn('absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-card', trip ? FILL.info : 'bg-border')} />
          <span className={cn('absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-2 ring-card', share >= 1 ? FILL.info : 'bg-border')} />
          {trip && share > 0 && share < 1 && (
            <span
              className={cn('absolute top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-card', TINT.info)}
              style={{ left: `calc(6px + (100% - 12px) * ${share})` }}
            >
              <Ship className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="mt-1 flex items-start justify-between gap-3 text-[12px] tabular-nums text-muted-foreground">
          <span>
            {filing.estimatedDeparture ? <>ETD {day(filing.estimatedDeparture)}</> : 'No ETD'}
            {filing.estimatedLading && <span className="block">Laden {day(filing.estimatedLading)}</span>}
          </span>
          <span className={cn('text-center', trip && share > 0 && share < 1 && 'font-medium text-info')}>{trip?.text ?? 'Add a sailing date to follow it'}</span>
          <span className="text-right">{filing.estimatedArrival ? <>ETA {day(filing.estimatedArrival)}</> : 'No ETA'}</span>
        </div>
        {vessel && <p className="mt-2 truncate text-[13px] font-medium sm:hidden"><span className={LABEL}>Vessel </span>{vessel}</p>}
      </div>

      <div className="border-t border-border/70 bg-muted/30 p-5 lg:border-l lg:border-t-0">
        <IsfPanel filing={filing} now={now} />
      </div>
    </section>
  );
}
