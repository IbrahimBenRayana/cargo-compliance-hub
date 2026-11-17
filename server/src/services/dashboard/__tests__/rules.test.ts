/**
 * The dashboard's ranking and stage rules (spec: dashboard-redesign §5.3, §9.3).
 * A wrong rule here hides a real deadline, so every row and its boundary is pinned.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyFiling, classifyEntry, stageOf, isfCutoff, compareActions,
  FILING_STATUSES, ENTRY_STATUSES,
  type FilingFacts, type EntryFacts,
} from '../rules.js';

const NOW = new Date('2026-10-30T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const days = (d: number) => hours(d * 24);

function filing(over: Partial<FilingFacts> = {}): FilingFacts {
  return {
    id: 'f1', filingType: 'ISF-10', status: 'draft', cbpState: 'NOT_ON_FILE', pendingAction: null,
    lastTransmissionId: null, estimatedDeparture: null, estimatedLading: null, estimatedArrival: null,
    acceptedAt: null, rejectedAt: null, amendedAt: null, updatedAt: hours(-1), ...over,
  };
}
function entry(over: Partial<EntryFacts> = {}): EntryFacts {
  return {
    id: 'e1', filingId: null, status: 'DRAFT', cbpState: 'NOT_ON_FILE', pendingAction: null,
    lastTransmissionId: null, entrySummaryStatus: null, cargoReleaseStatus: null, releaseRequested: false,
    lastError: null, respondedAt: null, updatedAt: hours(-1), ...over,
  };
}
/** Cutoff `h` hours from now, from a lading date (lading minus 24h). */
const cutoffIn = (h: number) => ({ estimatedLading: hours(h + 24) });

describe('isfCutoff', () => {
  it('is exact from a lading date', () => {
    expect(isfCutoff(filing({ estimatedLading: hours(48) }))).toEqual({ at: hours(24), basis: 'LADING' });
  });
  it('is an estimate from departure alone', () => {
    expect(isfCutoff(filing({ estimatedDeparture: hours(72) }))).toEqual({ at: hours(24), basis: 'ETD_ESTIMATE' });
  });
  it('works from a lading date with no departure', () => {
    expect(isfCutoff(filing({ estimatedLading: hours(30) }))?.basis).toBe('LADING');
  });
  it('is null with neither date', () => {
    expect(isfCutoff(filing())).toBeNull();
  });
});

describe('classifyFiling: drafts', () => {
  it.each([
    [-169, 'isf_overdue', 'later'],
    [-167, 'isf_overdue', 'now'],
    [-1, 'isf_overdue', 'now'],
    [1, 'isf_due', 'now'],
    [24, 'isf_due', 'now'],
    [25, 'isf_due', 'soon'],
    [72, 'isf_due', 'soon'],
    [73, 'isf_draft', 'later'],
  ])('cutoff in %ih is %s in %s', (h, kind, lane) => {
    expect(classifyFiling(filing(cutoffIn(h)), { hasEntry: false, abi: true }, NOW)).toMatchObject({ kind, lane });
  });

  it('flags a draft with no dates, because no clock can run', () => {
    expect(classifyFiling(filing(), { hasEntry: false, abi: true }, NOW)).toMatchObject({ kind: 'isf_no_date', lane: 'soon' });
  });

  it('carries the basis so an estimate can say so', () => {
    const c = classifyFiling(filing({ estimatedDeparture: hours(60) }), { hasEntry: false, abi: true }, NOW);
    expect(c?.due?.basis).toBe('ETD_ESTIMATE');
  });
});

describe('classifyFiling: rejected', () => {
  it('stays in Now with its clock', () => {
    const c = classifyFiling(filing({ status: 'rejected', ...cutoffIn(200) }), { hasEntry: false, abi: true }, NOW);
    expect(c).toMatchObject({ kind: 'isf_rejected', lane: 'now' });
    expect(c?.due?.at).toEqual(hours(200));
  });
  it('stays in Now within 7 days past its cutoff', () => {
    expect(classifyFiling(filing({ status: 'rejected', ...cutoffIn(-167) }), { hasEntry: false, abi: true }, NOW)?.lane).toBe('now');
  });
  it('moves to Later beyond 7 days past its cutoff', () => {
    expect(classifyFiling(filing({ status: 'rejected', ...cutoffIn(-169) }), { hasEntry: false, abi: true }, NOW)?.lane).toBe('later');
  });
  it('stays in Now with no cutoff', () => {
    expect(classifyFiling(filing({ status: 'rejected' }), { hasEntry: false, abi: true }, NOW)?.lane).toBe('now');
  });
});

describe('classifyFiling: a change CBP rejected', () => {
  const base = { status: 'accepted', cbpState: 'ON_FILE', lastTransmissionId: 't1', acceptedAt: days(-3) };
  it('raises a row, because the status alone still reads accepted', () => {
    const c = classifyFiling(filing({ ...base, rejectedAt: days(-1) }), { hasEntry: true, abi: true }, NOW);
    expect(c).toMatchObject({ kind: 'isf_change_rejected', lane: 'now' });
  });
  it('clears once a later change is accepted', () => {
    const c = classifyFiling(filing({ ...base, rejectedAt: days(-2), amendedAt: days(-1) }), { hasEntry: true, abi: true }, NOW);
    expect(c).toBeNull();
  });
  it('ignores filings from before native transmission, whose dates are not reliable', () => {
    const c = classifyFiling(filing({ ...base, lastTransmissionId: null, rejectedAt: days(-1) }), { hasEntry: true, abi: true }, NOW);
    expect(c).toBeNull();
  });
  it('waits while another action is in flight', () => {
    const c = classifyFiling(filing({ ...base, pendingAction: 'REPLACE', rejectedAt: days(-1) }), { hasEntry: true, abi: true }, NOW);
    expect(c?.kind).not.toBe('isf_change_rejected');
  });
});

describe('classifyFiling: in flight', () => {
  const sent = { status: 'submitted', pendingAction: 'ADD', lastTransmissionId: 't1' };
  it.each([
    ['SENT', hours(-1), 'cbp_no_response'],
    ['UNKNOWN', null, 'cbp_outcome_unknown'],
    ['CONDITIONAL', hours(-1), 'cbp_conditional'],
  ])('transmission %s raises a row', (status, sentAt, kind) => {
    const c = classifyFiling(filing(sent), { hasEntry: false, abi: true, transmission: { status, sentAt } }, NOW);
    expect(c).toMatchObject({ kind, lane: 'now' });
  });
  it('raises nothing inside the waiting window', () => {
    const tx = { status: 'SENT', sentAt: new Date(NOW.getTime() - 5 * 60_000) };
    expect(classifyFiling(filing(sent), { hasEntry: false, abi: true, transmission: tx }, NOW)).toBeNull();
  });
  it('a settled filing does not raise a row from an old transmission', () => {
    const c = classifyFiling(filing({ status: 'submitted' }), { hasEntry: false, abi: true, transmission: { status: 'SENT', sentAt: hours(-5) } }, NOW);
    expect(c).toBeNull();
  });
  it('a pending delete on an accepted ISF never offers an entry', () => {
    const f = filing({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: 'DELETE', acceptedAt: days(-1), estimatedArrival: days(2) });
    expect(classifyFiling(f, { hasEntry: false, abi: true }, NOW)).toBeNull();
  });
});

describe('classifyFiling: on hold', () => {
  it('is in Now', () => {
    expect(classifyFiling(filing({ status: 'on_hold' }), { hasEntry: false, abi: true }, NOW)).toMatchObject({ kind: 'isf_on_hold', lane: 'now' });
  });
});

describe('classifyFiling: entry needed', () => {
  const accepted = (over: Partial<FilingFacts>) => filing({ status: 'accepted', cbpState: 'ON_FILE', acceptedAt: days(-2), ...over });
  it.each([
    [-16, null],
    [-15, 'now'],
    [-1, 'now'],
    [1, 'soon'],
    [5, 'soon'],
    [6, 'later'],
  ])('arrival %i days away lands in %s', (d, lane) => {
    const c = classifyFiling(accepted({ estimatedArrival: days(d) }), { hasEntry: false, abi: true }, NOW);
    expect(c?.lane ?? null).toBe(lane);
  });
  it('unknown arrival waits in Later for 60 days after acceptance', () => {
    expect(classifyFiling(accepted({ acceptedAt: days(-59) }), { hasEntry: false, abi: true }, NOW)).toMatchObject({ kind: 'entry_needed', lane: 'later' });
    expect(classifyFiling(accepted({ acceptedAt: days(-61) }), { hasEntry: false, abi: true }, NOW)).toBeNull();
  });
  it('skips ISF-5, ISF-only plans, and filings that already have an entry', () => {
    const f = accepted({ estimatedArrival: days(1) });
    expect(classifyFiling({ ...f, filingType: 'ISF-5' }, { hasEntry: false, abi: true }, NOW)).toBeNull();
    expect(classifyFiling(f, { hasEntry: false, abi: false }, NOW)).toBeNull();
    expect(classifyFiling(f, { hasEntry: true, abi: true }, NOW)).toBeNull();
  });
  it('treats an amended ISF with nothing in flight as accepted', () => {
    const c = classifyFiling(accepted({ status: 'amended', estimatedArrival: days(1) }), { hasEntry: false, abi: true }, NOW);
    expect(c?.kind).toBe('entry_needed');
  });
});

describe('classifyEntry', () => {
  it('a draft is Later', () => {
    expect(classifyEntry(entry(), {}, NOW)).toMatchObject({ kind: 'entry_draft', lane: 'later' });
  });
  it('a rejected entry is Now', () => {
    expect(classifyEntry(entry({ status: 'REJECTED' }), {}, NOW)).toMatchObject({ kind: 'entry_rejected', lane: 'now' });
  });
  it('a rejected release with the summary on file is its own kind, since it needs a replace', () => {
    const e = entry({ status: 'REJECTED', cbpState: 'ON_FILE', cargoReleaseStatus: 'REJECTED', releaseRequested: true });
    expect(classifyEntry(e, {}, NOW)).toMatchObject({ kind: 'entry_release_rejected', lane: 'now' });
  });
  it('a rejected replace raises a row although the entry reads ACCEPTED', () => {
    const e = entry({ status: 'ACCEPTED', cbpState: 'ON_FILE', lastTransmissionId: 't1', lastError: 'Line 3 invalid' });
    expect(classifyEntry(e, {}, NOW)).toMatchObject({ kind: 'entry_change_rejected', lane: 'now' });
  });
  it('an accepted entry raises nothing', () => {
    expect(classifyEntry(entry({ status: 'ACCEPTED', cbpState: 'ON_FILE', lastTransmissionId: 't1' }), {}, NOW)).toBeNull();
  });
  it('a cancelled entry raises nothing', () => {
    expect(classifyEntry(entry({ status: 'CANCELLED' }), {}, NOW)).toBeNull();
  });
  it('reads its transmission while in flight', () => {
    const e = entry({ status: 'SENT', pendingAction: 'ADD', lastTransmissionId: 't1' });
    expect(classifyEntry(e, { transmission: { status: 'UNKNOWN', sentAt: null } }, NOW)?.kind).toBe('cbp_outcome_unknown');
  });
});

describe('stageOf', () => {
  const abi = { abi: true, now: NOW };
  it('puts a draft and a rejected ISF in ISF to send', () => {
    expect(stageOf(filing(), [], abi)).toBe('isf_to_send');
    expect(stageOf(filing({ status: 'rejected' }), [], abi)).toBe('isf_to_send');
  });
  it.each(['submitted', 'pending_cbp', 'on_hold'])('puts %s in ISF sent', (status) => {
    expect(stageOf(filing({ status }), [], abi)).toBe('isf_sent');
  });
  it('checks an action in flight before the status', () => {
    expect(stageOf(filing({ status: 'accepted', pendingAction: 'DELETE' }), [], abi)).toBe('isf_sent');
    expect(stageOf(filing({ status: 'amended', pendingAction: 'REPLACE' }), [], abi)).toBe('isf_sent');
  });
  it('puts an accepted ISF inside the arrival window in Ready for entry', () => {
    expect(stageOf(filing({ status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(3) }), [], abi)).toBe('entry_needed');
  });
  it('drops it once the window closes, because an entry filed elsewhere never appears here', () => {
    expect(stageOf(filing({ status: 'accepted', acceptedAt: days(-40), estimatedArrival: days(-16) }), [], abi)).toBeNull();
  });
  it('excludes ISF-5 from Ready for entry', () => {
    expect(stageOf(filing({ filingType: 'ISF-5', status: 'accepted', acceptedAt: days(-1), estimatedArrival: days(3) }), [], abi)).toBeNull();
  });
  it('places entries by status', () => {
    const f = filing({ status: 'accepted', acceptedAt: days(-10) });
    expect(stageOf(f, [entry({ status: 'DRAFT' })], abi)).toBe('entry_to_send');
    expect(stageOf(f, [entry({ status: 'REJECTED' })], abi)).toBe('entry_to_send');
    expect(stageOf(f, [entry({ status: 'SENT' })], abi)).toBe('entry_sent');
    expect(stageOf(f, [entry({ status: 'SENDING' })], abi)).toBe('entry_sent');
  });
  it('counts an accepted entry for 30 days, then not at all', () => {
    const f = filing({ status: 'accepted', acceptedAt: days(-60) });
    expect(stageOf(f, [entry({ status: 'ACCEPTED', respondedAt: days(-29) })], abi)).toBe('accepted');
    expect(stageOf(f, [entry({ status: 'ACCEPTED', respondedAt: days(-31) })], abi)).toBeNull();
  });
  it('takes the most urgent entry when a filing has two', () => {
    const f = filing({ status: 'accepted', acceptedAt: days(-5) });
    expect(stageOf(f, [entry({ id: 'a', status: 'ACCEPTED', respondedAt: days(-1) }), entry({ id: 'b', status: 'DRAFT' })], abi)).toBe('entry_to_send');
  });
  it('handles a standalone entry', () => {
    expect(stageOf(null, [entry({ status: 'SENT' })], abi)).toBe('entry_sent');
  });
  it('on an ISF-only plan, an accepted ISF is the end of the line', () => {
    const opts = { abi: false, now: NOW };
    expect(stageOf(filing({ status: 'accepted', acceptedAt: days(-29) }), [], opts)).toBe('accepted');
    expect(stageOf(filing({ status: 'accepted', acceptedAt: days(-31) }), [], opts)).toBeNull();
  });
  it('ignores entries on an ISF-only plan', () => {
    expect(stageOf(filing({ status: 'accepted', acceptedAt: days(-1) }), [entry({ status: 'DRAFT' })], { abi: false, now: NOW })).toBe('accepted');
  });
  it('does not count a cancelled filing or entry', () => {
    expect(stageOf(filing({ status: 'cancelled' }), [], abi)).toBeNull();
    expect(stageOf(null, [entry({ status: 'CANCELLED' })], abi)).toBeNull();
  });
});

describe('every status has a mapping', () => {
  it.each(FILING_STATUSES)('filing status %s neither throws nor falls through silently', (status) => {
    expect(() => classifyFiling(filing({ status }), { hasEntry: false, abi: true }, NOW)).not.toThrow();
    expect(() => stageOf(filing({ status }), [], { abi: true, now: NOW })).not.toThrow();
  });
  it.each(ENTRY_STATUSES)('entry status %s neither throws nor falls through silently', (status) => {
    expect(() => classifyEntry(entry({ status }), {}, NOW)).not.toThrow();
    expect(() => stageOf(null, [entry({ status })], { abi: true, now: NOW })).not.toThrow();
  });
  it('an unknown filing status is reported rather than dropped', () => {
    expect(() => stageOf(filing({ status: 'mystery' }), [], { abi: true, now: NOW })).toThrow(/mystery/);
  });
});

describe('compareActions', () => {
  const a = (lane: 'now' | 'soon' | 'later', dueH: number | null, occurredH: number, id: string) => ({
    lane, due: dueH === null ? null : { at: hours(dueH), basis: 'LADING' as const }, occurredAt: hours(occurredH), id,
  });
  it('sorts by lane, then earliest due, then newest, then id', () => {
    const items = [a('soon', 1, 0, 'a'), a('now', null, 0, 'b'), a('now', 5, 0, 'c'), a('now', 2, -9, 'd'), a('now', 2, -1, 'e'), a('now', 2, -1, 'f')];
    expect(items.sort(compareActions).map((i) => i.id)).toEqual(['e', 'f', 'd', 'c', 'b', 'a']);
  });
});
