import { describe, it, expect } from 'vitest';
import { buildSummary, collapseGroups, queryActions, sortedRows, type EntryRow, type FilingRow, type Loaded } from '../build.js';
import { safeRejectionSummary, primaryFor } from '../present.js';

const NOW = new Date('2026-10-30T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const days = (d: number) => hours(d * 24);

let seq = 0;
function filing(over: Partial<FilingRow> = {}): FilingRow {
  seq += 1;
  return {
    id: `f${seq}`, filingType: 'ISF-10', status: 'draft', cbpState: 'NOT_ON_FILE', pendingAction: null, lastTransmissionId: null,
    estimatedDeparture: null, estimatedLading: null, estimatedArrival: null, acceptedAt: null, rejectedAt: null, amendedAt: null,
    updatedAt: hours(-1), submittedAt: null, houseBol: `HBL${seq}`, masterBol: null, importerName: 'Acme', vesselName: null,
    consolidationId: null, rejectionReason: null, createdById: 'u1', ...over,
  };
}
function entry(over: Partial<EntryRow> = {}): EntryRow {
  seq += 1;
  return {
    id: `e${seq}`, filingId: null, status: 'DRAFT', cbpState: 'NOT_ON_FILE', pendingAction: null, lastTransmissionId: null,
    entrySummaryStatus: null, cargoReleaseStatus: null, releaseRequested: false, lastError: null, respondedAt: null,
    updatedAt: hours(-1), sentAt: null, entryNumber: `XYZ-${seq}`, mbolNumber: null, iorName: 'Acme', userId: 'u1', ...over,
  };
}
const data = (over: Partial<Loaded>): Loaded => ({ filings: [], entries: [], transmissions: new Map(), holds: [], ...over });
const opts = { abi: true, canAct: true, now: NOW };
const dueIn = (h: number) => ({ estimatedLading: hours(h + 24) });

describe('buildSummary', () => {
  it('counts every stage from the same pass as the rows', () => {
    const s = buildSummary(data({ filings: [filing(), filing({ status: 'submitted' }), filing({ status: 'rejected' })] }), opts);
    expect(s.flow.find((f) => f.key === 'isf_to_send')?.count).toBe(2);
    expect(s.flow.find((f) => f.key === 'isf_sent')?.count).toBe(1);
  });

  it('shows six stages with entries and three without', () => {
    expect(buildSummary(data({}), opts).flow).toHaveLength(6);
    expect(buildSummary(data({}), { ...opts, abi: false }).flow.map((f) => f.key)).toEqual(['isf_to_send', 'isf_sent', 'accepted']);
  });

  it('says what each lane holds and how many are overdue', () => {
    const s = buildSummary(data({ filings: [filing(dueIn(-3)), filing(dueIn(4)), filing(dueIn(40)), filing(dueIn(100))] }), opts);
    expect(s.attention).toMatchObject({ now: 2, soon: 1, later: 1, overdue: 1 });
    expect(s.attention.nextCutoffAt).toBe(hours(4).toISOString());
  });

  it('puts the most urgent first', () => {
    const late = filing(dueIn(20));
    const urgent = filing(dueIn(2));
    const s = buildSummary(data({ filings: [late, urgent] }), opts);
    expect(s.actions.items.map((i) => i.id)).toEqual([`isf:${urgent.id}`, `isf:${late.id}`]);
  });

  it('sends the first page of rows and counts them all', () => {
    const s = buildSummary(data({ filings: Array.from({ length: 40 }, () => filing(dueIn(2))) }), opts);
    expect(s.attention.now).toBe(40);
    expect(s.actions).toMatchObject({ total: 40, page: 1, pageCount: 4 });
    expect(s.actions.items).toHaveLength(10);
  });

  it('keeps entries away from an ISF-only plan', () => {
    const s = buildSummary(data({ entries: [entry({ status: 'REJECTED' })] }), { ...opts, abi: false });
    expect(s.attention.now).toBe(0);
  });

  it('gives a shipment one row, the most urgent of its filing and entries', () => {
    const f = filing({ status: 'rejected' });
    const s = buildSummary(data({ filings: [f], entries: [entry({ filingId: f.id })] }), opts);
    expect(s.filters[0].count).toBe(1);
    expect(s.actions.items[0].kind).toBe('isf_rejected');
  });

  it('does not ask for an entry that already exists', () => {
    const f = filing({ status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(2) });
    const s = buildSummary(data({ filings: [f], entries: [entry({ filingId: f.id, status: 'SENT' })] }), opts);
    expect(s.filters[0].count).toBe(0);
  });

  it('hides a hold when the shipment already has a row, and shows it otherwise', () => {
    const busy = filing({ status: 'rejected' });
    const quiet = filing({ status: 'accepted', acceptedAt: days(-30), estimatedArrival: days(-30) });
    const hold = (id: string, filingId: string) => ({ id, filingId, requestNumber: 'TCLU1', updatedAt: hours(-1), createdById: 'u1', hasHolds: true, earliestPickupLfd: null });
    const s = buildSummary(data({ filings: [busy, quiet], holds: [hold('h1', busy.id), hold('h2', quiet.id)] }), opts);
    expect(s.actions.items.filter((i) => i.lane === 'soon').map((i) => i.id)).toEqual(['tracking:h2']);
  });

  it('counts shipments near arrival with no entry, and ignores those with one', () => {
    const near = filing({ status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(3) });
    const arrived = filing({ status: 'accepted', acceptedAt: days(-9), estimatedArrival: days(-2) });
    const far = filing({ status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(9) });
    const covered = filing({ status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(2) });
    const s = buildSummary(data({ filings: [near, arrived, far, covered], entries: [entry({ filingId: covered.id })] }), opts);
    expect(s.arrivingWithoutEntry).toBe(2);
  });

  it('has no arriving-without-entry figure on a plan without entries', () => {
    expect(buildSummary(data({}), { ...opts, abi: false }).arrivingWithoutEntry).toBeNull();
  });

  it('counts CBP and terminal holds together, and last free days coming up', () => {
    const base = { filingId: null, requestNumber: 'T', updatedAt: hours(-1), createdById: 'u1' };
    const s = buildSummary(data({
      filings: [filing({ status: 'on_hold' })],
      holds: [
        { ...base, id: 'h1', hasHolds: true, earliestPickupLfd: null },
        { ...base, id: 'h2', hasHolds: false, earliestPickupLfd: days(2) },
        { ...base, id: 'h3', hasHolds: false, earliestPickupLfd: days(5) },
        { ...base, id: 'h4', hasHolds: false, earliestPickupLfd: days(-1) },
      ],
    }), opts);
    expect(s.holds).toEqual({ total: 2, lastFreeDaySoon: 1 });
  });

  it('never raises a queue row for a last free day alone', () => {
    const s = buildSummary(data({ holds: [{ id: 'h', filingId: null, requestNumber: 'T', updatedAt: hours(-1), createdById: 'u1', hasHolds: false, earliestPickupLfd: days(1) }] }), opts);
    expect(s.filters[0].count).toBe(0);
  });

  it('counts awaiting items, stuck ones first, with no promise about timing', () => {
    const fresh = filing({ status: 'submitted', pendingAction: 'ADD', lastTransmissionId: 't1' });
    const stuck = filing({ status: 'submitted', pendingAction: 'ADD', lastTransmissionId: 't2' });
    const transmissions = new Map([
      ['t1', { status: 'SENT', sentAt: new Date(NOW.getTime() - 60_000) }],
      ['t2', { status: 'UNKNOWN', sentAt: null }],
    ]);
    const s = buildSummary(data({ filings: [fresh, stuck], transmissions }), opts);
    expect(s.awaiting).toMatchObject({ count: 2, noResponse: 1 });
    expect(s.awaiting.items[0].state).toBe('UNKNOWN');
  });

  it('builds a 72-hour horizon, and nothing when no cutoff is near', () => {
    expect(buildSummary(data({ filings: [filing(dueIn(100))] }), opts).horizon).toBeNull();
    const h = buildSummary(data({ filings: [filing(dueIn(1)), filing(dueIn(7)), filing(dueIn(71))] }), opts).horizon!;
    expect(h.buckets).toHaveLength(12);
    expect(h.buckets[0] + h.buckets[1] + h.buckets[11]).toBe(3);
  });

  it('lets a viewer open a row but not act on it', () => {
    const f = filing(dueIn(2));
    const s = buildSummary(data({ filings: [f] }), { ...opts, canAct: false });
    expect(s.actions.items[0].primary).toMatchObject({ label: 'Open', href: `/shipments/${f.id}` });
  });
});

describe('groups', () => {
  const cid = 'c0000000-0000-4000-8000-000000000000';
  it('collapses house bills of one consolidation and keeps shipment counts', () => {
    const s = buildSummary(data({ filings: [filing({ ...dueIn(3), consolidationId: cid }), filing({ ...dueIn(5), consolidationId: cid }), filing(dueIn(4))] }), opts);
    expect(s.attention.now).toBe(3);
    expect(s.actions.items).toHaveLength(2);
    expect(s.actions.items[0].group).toMatchObject({ id: cid, count: 2 });
    expect(s.actions.items[0].due?.at).toBe(hours(3).toISOString());
  });
  it('leaves a single house bill as a plain row', () => {
    const rows = sortedRows(data({ filings: [filing({ ...dueIn(3), consolidationId: cid })] }), opts);
    expect(collapseGroups(rows)[0].group).toBeNull();
  });
  it('expands to its members', () => {
    const rows = sortedRows(data({ filings: [filing({ ...dueIn(3), consolidationId: cid }), filing({ ...dueIn(5), consolidationId: cid }), filing(dueIn(4))] }), opts);
    const r = queryActions(rows, { group: cid, userId: 'u1', page: 1, limit: 25, now: NOW });
    expect(r.items).toHaveLength(2);
    expect(r.items.every((i) => i.group === null)).toBe(true);
  });
});

describe('queryActions', () => {
  it('filters by person and importer', () => {
    const rows = sortedRows(data({ filings: [filing(dueIn(2)), filing({ ...dueIn(2), createdById: 'u2', importerName: 'Other' })] }), opts);
    expect(queryActions(rows, { mine: true, userId: 'u2', page: 1, limit: 25, now: NOW }).total).toBe(1);
    expect(queryActions(rows, { importer: 'Acme', userId: 'u1', page: 1, limit: 25, now: NOW }).total).toBe(1);
  });
  it('filters by chip', () => {
    const rows = sortedRows(data({ filings: [filing(dueIn(-2)), filing(dueIn(2)), filing({ status: 'rejected' })] }), opts);
    const count = (filter: 'overdue' | 'due_today' | 'rejected') => queryActions(rows, { filter, userId: 'u1', page: 1, limit: 25, now: NOW }).total;
    expect([count('overdue'), count('due_today'), count('rejected')]).toEqual([1, 1, 1]);
  });
  it('pages without repeating or skipping a row', () => {
    const rows = sortedRows(data({ filings: Array.from({ length: 7 }, (_, i) => filing(dueIn(i + 1))) }), opts);
    const seen: string[] = [];
    for (let page = 1; page <= 3; page += 1) seen.push(...queryActions(rows, { userId: 'u1', page, limit: 3, now: NOW }).items.map((i) => i.id));
    expect(new Set(seen).size).toBe(7);
  });
  it('says how many pages there are', () => {
    const rows = sortedRows(data({ filings: Array.from({ length: 7 }, (_, i) => filing(dueIn(i + 1))) }), opts);
    expect(queryActions(rows, { userId: 'u1', page: 1, limit: 3, now: NOW })).toMatchObject({ total: 7, page: 1, pageCount: 3 });
  });
  it('lands on the last page when asked for one past the end', () => {
    const rows = sortedRows(data({ filings: [filing(dueIn(1)), filing(dueIn(2))] }), opts);
    const r = queryActions(rows, { userId: 'u1', page: 9, limit: 1, now: NOW });
    expect(r.page).toBe(2);
    expect(r.items).toHaveLength(1);
  });
  it('has one empty page when nothing matches', () => {
    expect(queryActions([], { userId: 'u1', page: 1, limit: 10, now: NOW })).toMatchObject({ total: 0, page: 1, pageCount: 1, items: [] });
  });
  it('pages on the rows people see, so a group counts once', () => {
    const cid = 'c0000000-0000-4000-8000-000000000000';
    const rows = sortedRows(data({ filings: [filing({ ...dueIn(1), consolidationId: cid }), filing({ ...dueIn(2), consolidationId: cid }), filing(dueIn(3))] }), opts);
    const r = queryActions(rows, { userId: 'u1', page: 1, limit: 10, now: NOW });
    expect(r.total).toBe(2);
    expect(r.items[0].group?.count).toBe(2);
  });
});

describe('words on the page', () => {
  it('drops stored text that names an internal system', () => {
    expect(safeRejectionSummary('CustomsCity API error 500')).toBeNull();
    expect(safeRejectionSummary('Gateway timeout')).toBeNull();
  });
  it('keeps a plain rejection and shortens a long one', () => {
    expect(safeRejectionSummary('Invalid manufacturer ID')).toBe('Invalid manufacturer ID');
    expect(safeRejectionSummary('x'.repeat(200))!.length).toBe(90);
  });
  it('sends a draft to the editor and a new entry to the wizard', () => {
    expect(primaryFor({ kind: 'isf_due', lane: 'now', due: null }, { filingId: 'f', entryId: null }, true).href).toBe('/shipments/f/edit');
    expect(primaryFor({ kind: 'entry_needed', lane: 'soon', due: null }, { filingId: 'f', entryId: null }, true).href).toBe('/abi-documents/new?fromShipment=f');
    expect(primaryFor({ kind: 'entry_rejected', lane: 'now', due: null }, { filingId: 'f', entryId: 'e' }, true).href).toBe('/abi-documents/e');
  });
  it('downgrades aged-out work to Open', () => {
    expect(primaryFor({ kind: 'isf_overdue', lane: 'later', due: null }, { filingId: 'f', entryId: null }, true).label).toBe('Open');
  });
});
