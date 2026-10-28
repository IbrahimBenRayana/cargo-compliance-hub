/**
 * BUG-015: after CBP rejects an ISF replace, CBP keeps the previously accepted
 * version, but the shipment shows the rejected edits under "Accepted".
 */
import { describe, it, expect } from 'vitest';
import { rejectedChanges } from '../isfRejectedChanges';
import type { FilingCbpActivity } from '@/api/client';

const tx = (action: string, status: string, createdAt: string, conditions: { code: string; narrative: string }[] = []) => ({
  id: createdAt, environment: 'CERT', action, filerCode: 'S7P', status, sentAt: createdAt, respondedAt: createdAt,
  createdAt, lastError: null, isfTransactionNumber: 'S7P-1',
  inbound: [{ id: 'i', application: 'SN', receivedAt: createdAt, parsed: { verdict: status, narrative: '', conditions, keys: {}, application: 'SN' } as any }],
});
const activity = (cbpState: string, transmissions: ReturnType<typeof tx>[]): FilingCbpActivity => ({
  filing: { id: 'f', status: 'accepted', cbpState, pendingAction: null, isfFilerCode: 'S7P', cbpTransactionId: 'S7P-1' },
  transmissions,
});

describe('rejectedChanges', () => {
  it('reports a rejected replace while CBP still holds the earlier version, with CBP\'s reasons', () => {
    const r = rejectedChanges(activity('ON_FILE', [
      tx('R', 'REJECTED', '2026-10-22T14:39:00Z', [{ code: '144', narrative: 'CONTINUOUS BOND NOT ON FILE' }]),
      tx('A', 'ACCEPTED', '2026-10-22T14:38:00Z'),
    ]));
    expect(r).toEqual({ rejectedAt: '2026-10-22T14:39:00Z', reasons: ['144 CONTINUOUS BOND NOT ON FILE'] });
  });

  it('looks at the newest transmission whatever the list order', () => {
    expect(rejectedChanges(activity('ON_FILE', [
      tx('A', 'ACCEPTED', '2026-10-22T14:38:00Z'),
      tx('R', 'REJECTED', '2026-10-22T14:39:00Z'),
    ]))).not.toBeNull();
  });

  it('is quiet once a later replace is accepted or still waiting', () => {
    expect(rejectedChanges(activity('ON_FILE', [tx('R', 'ACCEPTED', '2026-10-22T14:40:00Z'), tx('R', 'REJECTED', '2026-10-22T14:39:00Z')]))).toBeNull();
    expect(rejectedChanges(activity('ON_FILE', [tx('R', 'SENT', '2026-10-22T14:40:00Z'), tx('R', 'REJECTED', '2026-10-22T14:39:00Z')]))).toBeNull();
  });

  it('is quiet when nothing is on file (a rejected first add is a plain rejection)', () => {
    expect(rejectedChanges(activity('NOT_ON_FILE', [tx('A', 'REJECTED', '2026-10-22T14:39:00Z')]))).toBeNull();
  });
});
