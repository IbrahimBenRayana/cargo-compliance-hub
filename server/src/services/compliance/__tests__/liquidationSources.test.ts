/**
 * TOOL-02 (testing week): the liquidation tracker and PSC/liquidation alerts
 * listed accepted ISF filings. Liquidation and PSC apply to entry summaries,
 * dated from the entry date.
 */
import { describe, it, expect } from 'vitest';
import { liquidationSources } from '../liquidation.js';

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1', entryNumber: 'QA190000489', mbolNumber: 'MAEU1', entryType: '01',
  payload: { dates: { entryDate: '20261023' } }, respondedAt: new Date('2026-10-24T10:00:00Z'), sentAt: new Date('2026-10-23T09:00:00Z'),
  ...over,
});

describe('liquidationSources', () => {
  it('dates an accepted entry from its entry date and links to the entry', () => {
    expect(liquidationSources([doc()])).toEqual([{
      id: 'd1', ref: 'QA1-9000048-9', entryType: '01', entryDate: new Date('2026-10-23T00:00:00Z'), linkUrl: '/abi-documents/d1',
    }]);
  });
  it('falls back to when CBP answered, then when it was sent', () => {
    expect(liquidationSources([doc({ payload: {} })])[0].entryDate).toEqual(new Date('2026-10-24T10:00:00Z'));
    expect(liquidationSources([doc({ payload: {}, respondedAt: null })])[0].entryDate).toEqual(new Date('2026-10-23T09:00:00Z'));
  });
  it('skips an entry with no date at all, and shows the bill when there is no entry number', () => {
    expect(liquidationSources([doc({ payload: {}, respondedAt: null, sentAt: null })])).toEqual([]);
    expect(liquidationSources([doc({ entryNumber: null })])[0].ref).toBe('MAEU1');
  });
});
