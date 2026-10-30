/**
 * What the dashboard says about a shipment: which stage it is in, and whether
 * it needs someone (spec: docs/specs/dashboard-redesign.md §5.3, §9.3).
 *
 * Pure functions over a few scalar fields, so every rule can be tested at its
 * boundaries. The first matching rule wins and a shipment yields one action.
 * Everything here describes stored state; nothing promises what CBP will do.
 */
import { isfFilingDeadline } from '../isfDeadline.js';
import { isOverdue } from '../cbp/unanswered.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const FILING_STATUSES = ['draft', 'submitted', 'pending_cbp', 'accepted', 'rejected', 'on_hold', 'amended', 'cancelled'] as const;
export const ENTRY_STATUSES = ['DRAFT', 'SENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;

/** Overdue work stays in Now this long; after that it is a record to resolve, not a race. */
const OVERDUE_NOW_DAYS = 7;
const ACCEPTED_LOOKBACK_DAYS = 30;
/** An entry filed in another system never appears here, so Ready for entry has to expire. */
const ENTRY_NEEDED_MAX_DAYS_PAST_ARRIVAL = 15;
const ENTRY_NEEDED_SOON_DAYS = 5;
const ENTRY_NEEDED_UNKNOWN_ARRIVAL_DAYS = 60;

export type Lane = 'now' | 'soon' | 'later';
export type Stage = 'isf_to_send' | 'isf_sent' | 'entry_needed' | 'entry_to_send' | 'entry_sent' | 'accepted';
export type ActionKind =
  | 'isf_overdue' | 'isf_due' | 'isf_rejected' | 'isf_change_rejected'
  | 'isf_no_date' | 'isf_on_hold' | 'isf_draft'
  | 'entry_rejected' | 'entry_change_rejected' | 'entry_release_rejected'
  | 'entry_draft' | 'entry_needed'
  | 'cbp_no_response' | 'cbp_outcome_unknown' | 'cbp_conditional' | 'tracking_hold';

export interface Due { at: Date; basis: 'LADING' | 'ETD_ESTIMATE' }
export interface Classification { kind: ActionKind; lane: Lane; due: Due | null }
export interface TransmissionFacts { status: string; sentAt: Date | null }

export interface FilingFacts {
  id: string;
  filingType: string;
  status: string;
  cbpState: string;
  pendingAction: string | null;
  lastTransmissionId: string | null;
  estimatedDeparture: Date | null;
  estimatedLading: Date | null;
  estimatedArrival: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  amendedAt: Date | null;
  updatedAt: Date;
}

export interface EntryFacts {
  id: string;
  filingId: string | null;
  status: string;
  cbpState: string;
  pendingAction: string | null;
  lastTransmissionId: string | null;
  entrySummaryStatus: string | null;
  cargoReleaseStatus: string | null;
  releaseRequested: boolean;
  lastError: string | null;
  respondedAt: Date | null;
  updatedAt: Date;
}

/** Computed from the dates rather than `filingDeadline`, so it always follows the current rule. */
export function isfCutoff(f: Pick<FilingFacts, 'estimatedDeparture' | 'estimatedLading'>): Due | null {
  const anchor = f.estimatedDeparture ?? f.estimatedLading;
  if (!anchor) return null;
  return { at: isfFilingDeadline(anchor, f.estimatedLading), basis: f.estimatedLading ? 'LADING' : 'ETD_ESTIMATE' };
}

function inFlight(tx: TransmissionFacts | undefined, now: Date): Classification | null {
  if (!tx) return null;
  if (tx.status === 'UNKNOWN') return { kind: 'cbp_outcome_unknown', lane: 'now', due: null };
  if (tx.status === 'CONDITIONAL') return { kind: 'cbp_conditional', lane: 'now', due: null };
  if (isOverdue(tx, now)) return { kind: 'cbp_no_response', lane: 'now', due: null };
  return null;
}

/** Null when the shipment is past the window in which an entry is expected of it. */
function entryNeededLane(f: FilingFacts, now: Date): Lane | null {
  if (f.filingType !== 'ISF-10') return null;
  if (!f.estimatedArrival) {
    const accepted = (f.acceptedAt ?? f.updatedAt).getTime();
    return now.getTime() - accepted <= ENTRY_NEEDED_UNKNOWN_ARRIVAL_DAYS * DAY ? 'later' : null;
  }
  const daysAway = (f.estimatedArrival.getTime() - now.getTime()) / DAY;
  if (daysAway < -ENTRY_NEEDED_MAX_DAYS_PAST_ARRIVAL) return null;
  if (daysAway <= 0) return 'now';
  return daysAway <= ENTRY_NEEDED_SOON_DAYS ? 'soon' : 'later';
}

function changeRejected(f: FilingFacts): boolean {
  // Native filings only: older rows did not keep these dates consistently.
  if (f.status !== 'accepted' || !f.lastTransmissionId || !f.rejectedAt) return false;
  const lastGood = Math.max(f.acceptedAt?.getTime() ?? 0, f.amendedAt?.getTime() ?? 0);
  return f.rejectedAt.getTime() > lastGood;
}

export function classifyFiling(
  f: FilingFacts,
  ctx: { hasEntry: boolean; abi: boolean; transmission?: TransmissionFacts },
  now: Date,
): Classification | null {
  if (f.status === 'cancelled') return null;
  if (f.pendingAction) return inFlight(ctx.transmission, now);
  if (changeRejected(f)) return { kind: 'isf_change_rejected', lane: 'now', due: null };

  const due = isfCutoff(f);
  const hoursLeft = due ? (due.at.getTime() - now.getTime()) / HOUR : null;
  const aged = hoursLeft !== null && hoursLeft < -OVERDUE_NOW_DAYS * 24;

  switch (f.status) {
    case 'rejected':
      return { kind: 'isf_rejected', lane: aged ? 'later' : 'now', due };
    case 'draft':
      if (hoursLeft === null) return { kind: 'isf_no_date', lane: 'soon', due: null };
      if (hoursLeft < 0) return { kind: 'isf_overdue', lane: aged ? 'later' : 'now', due };
      if (hoursLeft <= 24) return { kind: 'isf_due', lane: 'now', due };
      if (hoursLeft <= 72) return { kind: 'isf_due', lane: 'soon', due };
      return { kind: 'isf_draft', lane: 'later', due };
    case 'on_hold':
      return { kind: 'isf_on_hold', lane: 'now', due: null };
    case 'accepted':
    case 'amended': {
      if (!ctx.abi || ctx.hasEntry) return null;
      const lane = entryNeededLane(f, now);
      return lane ? { kind: 'entry_needed', lane, due: null } : null;
    }
    default:
      return null;
  }
}

export function classifyEntry(e: EntryFacts, ctx: { transmission?: TransmissionFacts }, now: Date): Classification | null {
  if (e.status === 'CANCELLED') return null;
  if (e.pendingAction) return inFlight(ctx.transmission, now);
  switch (e.status) {
    case 'ACCEPTED':
      // A rejected replace leaves the status ACCEPTED: the earlier summary stands.
      return e.lastTransmissionId && e.lastError ? { kind: 'entry_change_rejected', lane: 'now', due: null } : null;
    case 'REJECTED':
      return e.cbpState === 'ON_FILE' && e.cargoReleaseStatus === 'REJECTED'
        ? { kind: 'entry_release_rejected', lane: 'now', due: null }
        : { kind: 'entry_rejected', lane: 'now', due: null };
    case 'DRAFT':
      return { kind: 'entry_draft', lane: 'later', due: null };
    default:
      return null;
  }
}

function assertKnown(status: string, known: readonly string[]): void {
  if (!known.includes(status)) throw new Error(`Dashboard has no mapping for status "${status}"`);
}

/** The one stage a live shipment is in; null when it is finished or aged out. */
export function stageOf(f: FilingFacts | null, entries: EntryFacts[], opts: { abi: boolean; now: Date }): Stage | null {
  if (f) assertKnown(f.status, FILING_STATUSES);
  entries.forEach((e) => assertKnown(e.status, ENTRY_STATUSES));

  const { abi, now } = opts;
  const within = (d: Date | null, days: number) => !!d && now.getTime() - d.getTime() <= days * DAY;
  const live = abi ? entries.filter((e) => e.status !== 'CANCELLED') : [];
  const filing = f && f.status !== 'cancelled' ? f : null;

  if (filing && (filing.pendingAction || ['submitted', 'pending_cbp', 'on_hold'].includes(filing.status))) return 'isf_sent';
  if (live.some((e) => e.pendingAction || e.status === 'SENDING' || e.status === 'SENT')) return 'entry_sent';
  if (live.some((e) => e.status === 'DRAFT' || e.status === 'REJECTED')) return 'entry_to_send';
  if (live.some((e) => e.status === 'ACCEPTED' && within(e.respondedAt ?? e.updatedAt, ACCEPTED_LOOKBACK_DAYS))) return 'accepted';
  if (!filing) return null;
  if (filing.status === 'draft' || filing.status === 'rejected') return 'isf_to_send';
  if (!abi) return within(filing.acceptedAt ?? filing.updatedAt, ACCEPTED_LOOKBACK_DAYS) ? 'accepted' : null;
  return live.length === 0 && entryNeededLane(filing, now) ? 'entry_needed' : null;
}

const LANE_RANK: Record<Lane, number> = { now: 0, soon: 1, later: 2 };

/** Lane, then earliest due, then newest, then id so the order never wobbles. */
export function compareActions(
  a: { lane: Lane; due: Due | null; occurredAt: Date; id: string },
  b: { lane: Lane; due: Due | null; occurredAt: Date; id: string },
): number {
  return LANE_RANK[a.lane] - LANE_RANK[b.lane]
    || (a.due?.at.getTime() ?? Infinity) - (b.due?.at.getTime() ?? Infinity)
    || b.occurredAt.getTime() - a.occurredAt.getTime()
    || a.id.localeCompare(b.id);
}
