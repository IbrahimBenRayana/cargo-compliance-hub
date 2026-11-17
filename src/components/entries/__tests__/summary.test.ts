import { describe, it, expect } from 'vitest';
import type { AbiDocument } from '@/api/client';
import { stamp } from '@/components/shipment-detail/summary';
import { summarizeEntry } from '../summary';

const doc = (over: Partial<AbiDocument> = {}) => ({ id: 'e1', status: 'DRAFT', ...over }) as AbiDocument;
const T = '2026-11-10T15:00:00.000Z';

describe('summarizeEntry', () => {
  it('says a draft has not gone anywhere', () => {
    expect(summarizeEntry(doc())).toEqual({ tone: 'calm', title: 'Draft, not sent to CBP yet.', detail: null });
  });
  it('says Sent while CBP has not answered', () => {
    expect(summarizeEntry(doc({ status: 'SENT', sentAt: T }))).toEqual({ tone: 'info', title: 'Sent to CBP. Waiting for the answer.', detail: `Sent ${stamp(T)}.` });
    expect(summarizeEntry(doc({ status: 'SENDING' })).title).toBe('Sending to CBP.');
  });
  it('says accepted, and what CBP said about each part', () => {
    const s = summarizeEntry(doc({ status: 'ACCEPTED', respondedAt: T, entrySummaryStatus: 'ACCEPTED', releaseRequested: true, cargoReleaseStatus: 'ACCEPTED' }));
    expect(s).toEqual({ tone: 'done', title: 'CBP accepted this entry.', detail: `Accepted ${stamp(T)}. Entry summary accepted, cargo release accepted.` });
  });
  it('does not mention a release that was never requested', () => {
    expect(summarizeEntry(doc({ status: 'ACCEPTED', respondedAt: T, entrySummaryStatus: 'ACCEPTED' })).detail).toBe(`Accepted ${stamp(T)}. Entry summary accepted.`);
  });
  it('says when a later change is still with CBP', () => {
    expect(summarizeEntry(doc({ status: 'ACCEPTED', pendingAction: 'REPLACE' })).detail).toBe("A replacement sent since is waiting for CBP's answer.");
    expect(summarizeEntry(doc({ status: 'ACCEPTED', pendingAction: 'DELETE' })).detail).toBe("A deletion sent since is waiting for CBP's answer.");
  });
  it('points a rejection at the fix', () => {
    expect(summarizeEntry(doc({ status: 'REJECTED' }))).toEqual({ tone: 'urgent', title: 'CBP rejected this entry.', detail: "CBP's reasons are below. Correct the entry and send it again." });
  });
  it('covers cancelled, and never says cleared or released', () => {
    expect(summarizeEntry(doc({ status: 'CANCELLED' }))).toEqual({ tone: 'calm', title: 'This entry was cancelled.', detail: null });
    for (const status of ['DRAFT', 'SENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED']) {
      expect(JSON.stringify(summarizeEntry(doc({ status: status as AbiDocument['status'], releaseRequested: true, cargoReleaseStatus: 'ACCEPTED' })))).not.toMatch(/cleared|released/i);
    }
  });
});
