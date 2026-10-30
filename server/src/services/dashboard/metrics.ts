/**
 * The dashboard's measures of the last 30 days, each compared with the 30 before.
 * Pure, and computed from recorded dates only. A rate with nothing behind it is
 * null, never a flattering 100%.
 */
import { isfCutoff } from './rules.js';
import { safeRejectionSummary } from './present.js';
import type { DashboardMetrics } from './types.js';

const DAY = 86_400_000;
const WINDOW_DAYS = 30;
const ARRIVAL_DAYS = 7;
const REASONS_SHOWN = 3;

export interface MetricRows {
  filings: Array<{
    id: string;
    status: string;
    submittedAt: Date | null;
    acceptedAt: Date | null;
    rejectedAt: Date | null;
    estimatedDeparture: Date | null;
    estimatedLading: Date | null;
    estimatedArrival: Date | null;
    rejectionReason: string | null;
  }>;
  /** When each entry was accepted. */
  entries: Array<{ at: Date }>;
  /** Filings with a rejection in their history, even if later accepted. */
  everRejected: Set<string>;
}

export function computeMetrics(rows: MetricRows, opts: { abi: boolean; now: Date }): DashboardMetrics {
  const { abi, now } = opts;
  const age = (d: Date) => (now.getTime() - d.getTime()) / DAY;
  const inWindow = (d: Date | null): d is Date => !!d && age(d) >= 0 && age(d) < WINDOW_DAYS;
  const inPrior = (d: Date | null): d is Date => !!d && age(d) >= WINDOW_DAYS && age(d) < 2 * WINDOW_DAYS;

  const series = (dates: Array<Date | null>, offsetDays = 0) => {
    const out = new Array<number>(WINDOW_DAYS).fill(0);
    for (const d of dates) {
      if (!d) continue;
      const days = Math.floor(age(d)) - offsetDays;
      if (days >= 0 && days < WINDOW_DAYS) out[WINDOW_DAYS - 1 - days] += 1;
    }
    return out;
  };
  const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pct = (hit: number, of: number) => (of === 0 ? null : Math.round((hit / of) * 100));

  const { filings } = rows;

  function onTime(inRange: (d: Date | null) => d is Date) {
    const measured = filings.filter((f) => inRange(f.submittedAt) && isfCutoff(f));
    const hit = measured.filter((f) => f.submittedAt! <= isfCutoff(f)!.at).length;
    return { rate: pct(hit, measured.length), sample: measured.length };
  }
  function firstPass(inRange: (d: Date | null) => d is Date) {
    const accepted = filings.filter((f) => inRange(f.acceptedAt));
    const clean = accepted.filter((f) => !rows.everRejected.has(f.id)).length;
    return { rate: pct(clean, accepted.length), sample: accepted.length };
  }

  const count = (dates: Array<Date | null>) => {
    const current = series(dates);
    const prior = series(dates, WINDOW_DAYS);
    return { total: sumOf(current), prior: sumOf(prior), series: current, priorSeries: prior };
  };

  const arrivals = new Array<number>(ARRIVAL_DAYS).fill(0);
  for (const f of filings) {
    if (f.status === 'cancelled' || !f.estimatedArrival) continue;
    const ahead = (f.estimatedArrival.getTime() - now.getTime()) / DAY;
    if (ahead >= 0 && ahead < ARRIVAL_DAYS) arrivals[Math.floor(ahead)] += 1;
  }

  const reasons = new Map<string, number>();
  for (const f of filings) {
    if (!inWindow(f.rejectedAt)) continue;
    const reason = safeRejectionSummary(f.rejectionReason) ?? 'Other reason';
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return {
    windowDays: WINDOW_DAYS,
    sentOnTime: { ...onTime(inWindow), prior: onTime(inPrior).rate },
    firstPass: { ...firstPass(inWindow), prior: firstPass(inPrior).rate },
    isfSent: count(filings.map((f) => f.submittedAt)),
    isfAccepted: count(filings.map((f) => f.acceptedAt)),
    isfRejected: count(filings.map((f) => f.rejectedAt)),
    entriesAccepted: abi ? count(rows.entries.map((e) => e.at)) : null,
    arrivals,
    rejectionReasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, REASONS_SHOWN)
      .map(([reason, n]) => ({ reason, count: n })),
  };
}
