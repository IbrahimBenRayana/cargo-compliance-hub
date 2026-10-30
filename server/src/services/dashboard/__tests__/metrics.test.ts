import { describe, it, expect } from 'vitest';
import { computeMetrics, type MetricRows } from '../metrics.js';

const NOW = new Date('2026-10-30T12:00:00Z');
const days = (d: number) => new Date(NOW.getTime() + d * 86_400_000);
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

function isf(over: Partial<MetricRows['filings'][number]> = {}): MetricRows['filings'][number] {
  return { id: 'f', status: 'accepted', submittedAt: null, acceptedAt: null, rejectedAt: null, estimatedDeparture: null, estimatedLading: null, estimatedArrival: null, rejectionReason: null, ...over };
}
const rows = (over: Partial<MetricRows> = {}): MetricRows => ({ filings: [], entries: [], everRejected: new Set(), ...over });
const opts = { abi: true, overdue: 0, now: NOW };

describe('computeMetrics: sent before cutoff', () => {
  it('compares each send with its cutoff', () => {
    const m = computeMetrics(rows({ filings: [
      isf({ submittedAt: days(-2), estimatedLading: days(-1) }), // cutoff days(-2) minus nothing: lading - 24h = days(-2), so on time
      isf({ submittedAt: days(-1), estimatedLading: days(-1) }), // cutoff was a day earlier: late
    ] }), opts);
    expect(m.sentOnTime).toMatchObject({ rate: 50, sample: 2 });
  });
  it('ignores sends with no cutoff, because there is nothing to measure', () => {
    expect(computeMetrics(rows({ filings: [isf({ submittedAt: days(-1) })] }), opts).sentOnTime).toMatchObject({ rate: null, sample: 0 });
  });
  it('has no rate rather than a perfect one when nothing was sent', () => {
    expect(computeMetrics(rows(), opts).sentOnTime.rate).toBeNull();
  });
  it('separates this window from the one before', () => {
    const m = computeMetrics(rows({ filings: [
      isf({ submittedAt: days(-5), estimatedLading: days(1) }),
      isf({ submittedAt: days(-40), estimatedLading: days(-41) }),
    ] }), opts);
    expect(m.sentOnTime).toMatchObject({ rate: 100, prior: 0 });
  });
});

describe('computeMetrics: first-pass acceptance', () => {
  it('counts ISFs accepted without a rejection along the way', () => {
    const m = computeMetrics(rows({
      filings: [isf({ id: 'a', acceptedAt: days(-1) }), isf({ id: 'b', acceptedAt: days(-2) }), isf({ id: 'c', acceptedAt: days(-3) }), isf({ id: 'd', acceptedAt: days(-4) })],
      everRejected: new Set(['b']),
    }), opts);
    expect(m.firstPass).toMatchObject({ rate: 75, sample: 4 });
  });
});

describe('computeMetrics: volume', () => {
  it('builds 30 days, oldest first, with today last', () => {
    const m = computeMetrics(rows({ filings: [isf({ submittedAt: hours(-2) }), isf({ submittedAt: days(-29.5) }), isf({ submittedAt: days(-31) })] }), opts);
    expect(m.isfSent.series).toHaveLength(30);
    expect(m.isfSent.series[29]).toBe(1);
    expect(m.isfSent.series[0]).toBe(1);
    expect(m.isfSent).toMatchObject({ total: 2, prior: 1 });
  });
  it('splits accepted from rejected', () => {
    const m = computeMetrics(rows({ filings: [isf({ acceptedAt: hours(-1) }), isf({ status: 'rejected', rejectedAt: hours(-1) })] }), opts);
    expect(m.outcomes.accepted[29]).toBe(1);
    expect(m.outcomes.rejected[29]).toBe(1);
    expect(m.outcomes).toMatchObject({ acceptedTotal: 1, rejectedTotal: 1 });
  });
  it('leaves entries out of a plan without them', () => {
    const m = computeMetrics(rows({ entries: [{ at: hours(-1) }] }), { ...opts, abi: false });
    expect(m.entriesAccepted).toBeNull();
  });
  it('counts accepted entries on plans with them', () => {
    expect(computeMetrics(rows({ entries: [{ at: hours(-1) }, { at: days(-35) }] }), opts).entriesAccepted).toMatchObject({ total: 1, prior: 1 });
  });
});

describe('computeMetrics: arrivals', () => {
  it('counts the next seven days and skips cancelled shipments', () => {
    const m = computeMetrics(rows({ filings: [
      isf({ estimatedArrival: hours(5) }), isf({ estimatedArrival: days(6.5) }), isf({ estimatedArrival: days(8) }),
      isf({ estimatedArrival: hours(5), status: 'cancelled' }), isf({ estimatedArrival: hours(-5) }),
    ] }), opts);
    expect(m.arrivals).toHaveLength(7);
    expect(m.arrivals[0]).toBe(1);
    expect(m.arrivals[6]).toBe(1);
    expect(m.arrivals.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe('computeMetrics: rejection reasons', () => {
  it('ranks the most common recent reasons', () => {
    const r = (reason: string) => isf({ status: 'rejected', rejectedAt: days(-1), rejectionReason: reason });
    const m = computeMetrics(rows({ filings: [r('Invalid manufacturer ID'), r('Invalid manufacturer ID'), r('Bond not on file')] }), opts);
    expect(m.rejectionReasons).toEqual([{ reason: 'Invalid manufacturer ID', count: 2 }, { reason: 'Bond not on file', count: 1 }]);
  });
  it('never repeats stored text that names an internal system', () => {
    const m = computeMetrics(rows({ filings: [isf({ status: 'rejected', rejectedAt: days(-1), rejectionReason: 'CustomsCity API error' })] }), opts);
    expect(m.rejectionReasons).toEqual([{ reason: 'Other reason', count: 1 }]);
  });
  it('shows at most three', () => {
    const m = computeMetrics(rows({ filings: ['A', 'B', 'C', 'D'].map((x) => isf({ status: 'rejected', rejectedAt: days(-1), rejectionReason: `Reason ${x}` })) }), opts);
    expect(m.rejectionReasons).toHaveLength(3);
  });
});

describe('computeMetrics: exposure', () => {
  it('counts up to $5,000 for each overdue ISF', () => {
    expect(computeMetrics(rows(), { ...opts, overdue: 2 }).exposureUsd).toBe(10_000);
    expect(computeMetrics(rows(), opts).exposureUsd).toBe(0);
  });
});
