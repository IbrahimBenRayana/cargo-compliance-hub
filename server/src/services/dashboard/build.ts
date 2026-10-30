/**
 * Turns the loaded rows into the dashboard response. Counts, rows and stages all
 * come from one pass over the same shipments, so they cannot disagree.
 */
import logger from '../../config/logger.js';
import { isOverdue } from '../cbp/unanswered.js';
import { classifyEntry, classifyFiling, compareActions, isfCutoff, stageOf } from './rules.js';
import type { Classification, EntryFacts, FilingFacts, Lane, Stage, TransmissionFacts } from './rules.js';
import { primaryFor, safeRejectionSummary, titleFor } from './present.js';
import type { ActionFilter, ActionItem, AwaitingItem, DashboardResponse } from './types.js';

export const PAGE_SIZE = 25;
const HOUR = 3_600_000;
const HORIZON_BUCKETS = 12;
const HORIZON_BUCKET_HOURS = 6;
const AWAITING_SHOWN = 5;
const WORKLOAD_SHOWN = 5;
const LANES: Lane[] = ['now', 'soon', 'later'];

export interface FilingRow extends FilingFacts {
  houseBol: string | null;
  masterBol: string | null;
  importerName: string | null;
  vesselName: string | null;
  consolidationId: string | null;
  rejectionReason: string | null;
  createdById: string;
  submittedAt: Date | null;
}
export interface EntryRow extends EntryFacts {
  entryNumber: string | null;
  mbolNumber: string | null;
  iorName: string | null;
  userId: string;
  sentAt: Date | null;
}
export interface HoldRow { id: string; filingId: string | null; requestNumber: string; updatedAt: Date; createdById: string }

export interface Loaded {
  filings: FilingRow[];
  entries: EntryRow[];
  transmissions: Map<string, TransmissionFacts>;
  holds: HoldRow[];
}

/** One line in the queue before grouping, carrying what filters and sorting need. */
export interface QueueRow {
  id: string;
  lane: Lane;
  due: Classification['due'];
  occurredAt: Date;
  item: ActionItem;
  consolidationId: string | null;
  createdById: string;
  importer: string | null;
}

interface Shipment {
  filing: FilingRow | null;
  entries: EntryRow[];
  stage: Stage | null;
  row: QueueRow | null;
}

const refOfFiling = (f: FilingRow) => f.houseBol || f.masterBol || f.id.slice(0, 8);
const refOfEntry = (e: EntryRow) => e.entryNumber || e.mbolNumber || e.id.slice(0, 8);
// One shared formatter: building one per row took most of the request at 120,000 filings.
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortDate = (d: Date) => SHORT_DATE.format(d);

function filingMeta(f: FilingRow): string | null {
  const parts = [
    f.vesselName,
    f.estimatedDeparture && `ETD ${shortDate(f.estimatedDeparture)}`,
    f.estimatedArrival && `Arrives ${shortDate(f.estimatedArrival)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function toRow(args: {
  id: string; c: Classification; filing: FilingRow | null; entry: EntryRow | null; canAct: boolean; now: Date;
}): QueueRow {
  const { id, c, filing, entry, canAct, now } = args;
  const reason = safeRejectionSummary(entry ? (c.kind === 'entry_rejected' ? entry.lastError : null) : filing?.rejectionReason);
  const arrived = !!filing?.estimatedArrival && filing.estimatedArrival.getTime() <= now.getTime();
  const occurredAt = entry?.updatedAt ?? filing!.updatedAt;
  return {
    id, lane: c.lane, due: c.due, occurredAt,
    consolidationId: entry ? null : filing?.consolidationId ?? null,
    createdById: entry?.userId ?? filing!.createdById,
    importer: entry?.iorName ?? filing?.importerName ?? null,
    item: {
      id,
      kind: c.kind,
      lane: c.lane,
      title: titleFor(c, reason, arrived),
      ref: entry ? refOfEntry(entry) : refOfFiling(filing!),
      party: entry?.iorName ?? filing?.importerName ?? null,
      meta: filing ? filingMeta(filing) : entry?.mbolNumber ? `MBOL ${entry.mbolNumber}` : null,
      due: c.due ? { at: c.due.at.toISOString(), basis: c.due.basis } : null,
      occurredAt: occurredAt.toISOString(),
      group: null,
      primary: primaryFor(c, { filingId: filing?.id ?? null, entryId: entry?.id ?? null }, canAct),
    },
  };
}

function assemble(data: Loaded, opts: { abi: boolean; canAct: boolean; now: Date }): Shipment[] {
  const { abi, canAct, now } = opts;
  const byFiling = new Map<string, EntryRow[]>();
  const orphans: EntryRow[] = [];
  const filingIds = new Set(data.filings.map((f) => f.id));
  for (const e of abi ? data.entries : []) {
    if (e.filingId && filingIds.has(e.filingId)) byFiling.set(e.filingId, [...(byFiling.get(e.filingId) ?? []), e]);
    else orphans.push(e);
  }
  const txOf = (x: { lastTransmissionId: string | null }) => (x.lastTransmissionId ? data.transmissions.get(x.lastTransmissionId) : undefined);

  const pick = (rows: QueueRow[]) => rows.sort(compareRows)[0] ?? null;
  const entryRow = (e: EntryRow, filing: FilingRow | null) => {
    const c = classifyEntry(e, { transmission: txOf(e) }, now);
    return c ? toRow({ id: `entry:${e.id}`, c, filing, entry: e, canAct, now }) : null;
  };
  const stageSafely = (f: FilingRow | null, entries: EntryRow[]) => {
    try {
      return stageOf(f, entries, { abi, now });
    } catch (err) {
      logger.error({ err, filingId: f?.id }, '[dashboard] status with no mapping');
      return null;
    }
  };

  const shipments: Shipment[] = data.filings.map((filing) => {
    const entries = byFiling.get(filing.id) ?? [];
    const hasEntry = entries.some((e) => e.status !== 'CANCELLED');
    const c = classifyFiling(filing, { hasEntry, abi, transmission: txOf(filing) }, now);
    const rows = entries.map((e) => entryRow(e, filing)).filter((r): r is QueueRow => !!r);
    if (c) rows.push(toRow({ id: `isf:${filing.id}`, c, filing, entry: null, canAct, now }));
    return { filing, entries, stage: stageSafely(filing, entries), row: pick(rows) };
  });

  for (const e of orphans) {
    shipments.push({ filing: null, entries: [e], stage: stageSafely(null, [e]), row: entryRow(e, null) });
  }

  // A hold shows only when nothing else is already asking about that shipment.
  const busy = new Set(shipments.filter((s) => s.row && s.filing).map((s) => s.filing!.id));
  for (const h of data.holds) {
    if (h.filingId && busy.has(h.filingId)) continue;
    const c: Classification = { kind: 'tracking_hold', lane: 'soon', due: null };
    const filing = h.filingId ? data.filings.find((f) => f.id === h.filingId) ?? null : null;
    shipments.push({
      filing: null, entries: [], stage: null,
      row: {
        id: `tracking:${h.id}`, lane: 'soon', due: null, occurredAt: h.updatedAt,
        consolidationId: null, createdById: h.createdById, importer: filing?.importerName ?? null,
        item: {
          id: `tracking:${h.id}`, kind: c.kind, lane: c.lane, title: titleFor(c, null, false), ref: h.requestNumber,
          party: filing?.importerName ?? null, meta: null, due: null, occurredAt: h.updatedAt.toISOString(), group: null,
          primary: primaryFor(c, { filingId: h.filingId, entryId: null, trackingId: h.id }, canAct),
        },
      },
    });
  }
  return shipments;
}

function compareRows(a: QueueRow, b: QueueRow): number {
  return compareActions(a, b);
}

const REJECTED_KINDS = new Set(['isf_rejected', 'isf_change_rejected', 'entry_rejected', 'entry_change_rejected', 'entry_release_rejected']);
const CBP_KINDS = new Set(['cbp_no_response', 'cbp_outcome_unknown', 'cbp_conditional']);

export function matchesFilter(r: QueueRow, filter: ActionFilter, now: Date): boolean {
  const left = r.due ? r.due.at.getTime() - now.getTime() : null;
  switch (filter) {
    case 'all': return true;
    case 'overdue': return left !== null && left < 0 && r.lane === 'now';
    case 'due_today': return left !== null && left >= 0 && left <= 24 * HOUR;
    case 'rejected': return REJECTED_KINDS.has(r.item.kind);
    case 'no_response': return CBP_KINDS.has(r.item.kind);
  }
}

/** Collapses consolidations in sorted rows. A group sits where its most urgent member sat. */
export function collapseGroups(rows: QueueRow[]): ActionItem[] {
  const sizes = new Map<string, number>();
  const keyOf = (r: QueueRow) => (r.consolidationId ? `${r.consolidationId}:${r.item.kind}:${r.lane}` : null);
  for (const r of rows) {
    const k = keyOf(r);
    if (k) sizes.set(k, (sizes.get(k) ?? 0) + 1);
  }
  const seen = new Set<string>();
  const out: ActionItem[] = [];
  for (const r of rows) {
    const k = keyOf(r);
    const size = k ? sizes.get(k)! : 1;
    if (!k || size < 2) { out.push(r.item); continue; }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      ...r.item,
      id: `group:${k}`,
      title: `${size} house bills: ${r.item.title}`,
      group: { id: r.consolidationId!, count: size, label: `${size} house bills` },
      primary: { label: `Show ${size}`, href: r.item.primary.href, enabled: true, disabledReason: null },
    });
  }
  return out;
}

export function encodeCursor(r: QueueRow): string {
  return Buffer.from(JSON.stringify([r.lane, r.due?.at.getTime() ?? null, r.occurredAt.getTime(), r.id])).toString('base64url');
}

export function decodeCursor(cursor: string): Pick<QueueRow, 'lane' | 'due' | 'occurredAt' | 'id'> | null {
  try {
    const [lane, due, occurred, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!LANES.includes(lane) || typeof id !== 'string' || typeof occurred !== 'number') return null;
    return { lane, id, occurredAt: new Date(occurred), due: typeof due === 'number' ? { at: new Date(due), basis: 'LADING' } : null };
  } catch {
    return null;
  }
}

function pageOf(rows: QueueRow[], limit: number) {
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(page[page.length - 1]) : null;
  return { items: collapseGroups(page), nextCursor };
}

export function sortedRows(data: Loaded, opts: { abi: boolean; canAct: boolean; now: Date }): QueueRow[] {
  return assemble(data, opts).flatMap((s) => (s.row ? [s.row] : [])).sort(compareRows);
}

export function queryActions(rows: QueueRow[], q: {
  lane?: Lane; filter?: ActionFilter; mine?: boolean; userId: string; importer?: string; group?: string;
  cursor?: Pick<QueueRow, 'lane' | 'due' | 'occurredAt' | 'id'> | null; limit: number; now: Date;
}) {
  const hit = rows.filter((r) =>
    (!q.lane || r.lane === q.lane)
    && matchesFilter(r, q.filter ?? 'all', q.now)
    && (!q.mine || r.createdById === q.userId)
    && (!q.importer || r.importer === q.importer)
    && (!q.group || r.consolidationId === q.group));
  const from = q.cursor ? hit.filter((r) => compareActions(r, q.cursor!) > 0) : hit;
  // A group's members are the answer when expanding it, so they stay separate rows.
  const page = from.slice(0, q.limit);
  return {
    items: q.group ? page.map((r) => r.item) : collapseGroups(page),
    nextCursor: from.length > q.limit ? encodeCursor(page[page.length - 1]) : null,
    total: hit.length,
  };
}

const FLOW: Record<Stage, { label: string; list: string }> = {
  isf_to_send: { label: 'ISF to send', list: '/shipments' },
  isf_sent: { label: 'ISF sent', list: '/shipments' },
  entry_needed: { label: 'Ready for entry', list: '/shipments' },
  entry_to_send: { label: 'Entry to send', list: '/abi-documents' },
  entry_sent: { label: 'Entry sent', list: '/abi-documents' },
  accepted: { label: 'Accepted, 30 days', list: '/shipments' },
};
const FLOW_ABI: Stage[] = ['isf_to_send', 'isf_sent', 'entry_needed', 'entry_to_send', 'entry_sent', 'accepted'];
const FLOW_ISF: Stage[] = ['isf_to_send', 'isf_sent', 'accepted'];

function awaitingState(tx: TransmissionFacts | undefined, now: Date): AwaitingItem['state'] {
  if (!tx) return 'SENT';
  if (tx.status === 'UNKNOWN' || tx.status === 'CONDITIONAL') return tx.status;
  if (tx.status === 'QUEUED' || tx.status === 'SENDING') return 'QUEUED';
  return isOverdue(tx, now) ? 'NO_RESPONSE' : 'SENT';
}

export function buildSummary(data: Loaded, opts: { abi: boolean; canAct: boolean; now: Date }):
  Omit<DashboardResponse, 'isEmpty' | 'recent' | 'month' | 'blockers' | 'setup' | 'metrics'> {
  const { abi, now } = opts;
  const shipments = assemble(data, opts);
  const rows = shipments.flatMap((s) => (s.row ? [s.row] : [])).sort(compareRows);

  const counts = new Map<Stage, number>();
  for (const s of shipments) if (s.stage) counts.set(s.stage, (counts.get(s.stage) ?? 0) + 1);
  const flow = (abi ? FLOW_ABI : FLOW_ISF).map((key) => ({
    key, label: FLOW[key].label, count: counts.get(key) ?? 0, href: `${FLOW[key].list}?stage=${key}`,
  }));

  const inLane = (lane: Lane) => rows.filter((r) => r.lane === lane);
  const lanes = LANES.map((lane) => {
    const all = inLane(lane);
    return { lane, total: all.length, ...pageOf(all, PAGE_SIZE) };
  });

  const count = (filter: ActionFilter) => rows.filter((r) => matchesFilter(r, filter, now)).length;
  const filters: DashboardResponse['filters'] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'overdue', label: 'Overdue', count: count('overdue') },
    { key: 'due_today', label: 'Due today', count: count('due_today') },
    { key: 'rejected', label: 'Rejected', count: count('rejected') },
    { key: 'no_response', label: 'No response', count: count('no_response') },
  ];

  // Every open ISF has a clock, including rejected ones and those on a later lane.
  const cutoffs = shipments
    .filter((s) => s.filing && (s.filing.status === 'draft' || s.filing.status === 'rejected') && !s.filing.pendingAction)
    .flatMap((s) => { const c = isfCutoff(s.filing!); return c ? [c.at.getTime()] : []; })
    .filter((t) => t >= now.getTime());
  const nextCutoffAt = cutoffs.length ? new Date(Math.min(...cutoffs)).toISOString() : null;
  const buckets = new Array<number>(HORIZON_BUCKETS).fill(0);
  for (const t of cutoffs) {
    const i = Math.floor((t - now.getTime()) / (HORIZON_BUCKET_HOURS * HOUR));
    if (i < HORIZON_BUCKETS) buckets[i] += 1;
  }

  const txOf = (x: { lastTransmissionId: string | null }) => (x.lastTransmissionId ? data.transmissions.get(x.lastTransmissionId) : undefined);
  const awaitingAll: AwaitingItem[] = shipments.flatMap((s): AwaitingItem[] => {
    if (s.stage === 'isf_sent' && s.filing) {
      const tx = txOf(s.filing);
      return [{ id: `isf:${s.filing.id}`, ref: refOfFiling(s.filing), kind: 'isf', state: awaitingState(tx, now), sentAt: (tx?.sentAt ?? s.filing.submittedAt)?.toISOString() ?? null, href: `/shipments/${s.filing.id}` }];
    }
    if (s.stage === 'entry_sent') {
      const e = s.entries.find((x) => x.pendingAction || x.status === 'SENDING' || x.status === 'SENT');
      if (!e) return [];
      const tx = txOf(e);
      return [{ id: `entry:${e.id}`, ref: refOfEntry(e), kind: 'entry', state: awaitingState(tx, now), sentAt: (tx?.sentAt ?? e.sentAt)?.toISOString() ?? null, href: `/abi-documents/${e.id}` }];
    }
    return [];
  });
  const byImporter = new Map<string, number>();
  for (const r of rows) if (r.importer) byImporter.set(r.importer, (byImporter.get(r.importer) ?? 0) + 1);
  const workload = [...byImporter.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, WORKLOAD_SHOWN)
    .map(([name, n]) => ({ name, count: n }));

  const STUCK = new Set(['NO_RESPONSE', 'UNKNOWN', 'CONDITIONAL']);
  const byUrgency = [...awaitingAll].sort((a, b) =>
    Number(STUCK.has(b.state)) - Number(STUCK.has(a.state)) || (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));

  return {
    generatedAt: now.toISOString(),
    attention: {
      now: inLane('now').length, soon: inLane('soon').length, later: inLane('later').length,
      overdue: count('overdue'), nextCutoffAt,
    },
    flow, filters, lanes, workload,
    horizon: buckets.some(Boolean) ? { startsAt: now.toISOString(), bucketHours: HORIZON_BUCKET_HOURS, buckets } : null,
    awaiting: { count: awaitingAll.length, noResponse: awaitingAll.filter((a) => STUCK.has(a.state)).length, items: byUrgency.slice(0, AWAITING_SHOWN) },
  };
}
