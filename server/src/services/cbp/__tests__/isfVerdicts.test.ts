/**
 * Applying CBP's verdict to an ISF (native go-live 3.4): status, history,
 * notification, webhook and billing happen exactly once per transaction,
 * however many times CBP's response is seen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, notify, billing, score } = vi.hoisted(() => ({
  prisma: {
    filing: { findUnique: vi.fn(), updateMany: vi.fn() },
    filingStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  notify: { notifyFilingAccepted: vi.fn(), notifyFilingRejected: vi.fn(), notifyFilingChangeRejected: vi.fn() },
  billing: { billShipmentForFiling: vi.fn() },
  score: { recordScoreSnapshot: vi.fn(), triggerForStatus: vi.fn((s: string) => s) },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../../notifications.js', () => notify);
vi.mock('../../shipmentBilling.js', () => billing);
vi.mock('../../compliance/scoreSnapshot.js', () => score);

import { Prisma } from '@prisma/client';
import { applyIsfVerdict } from '../isfVerdicts.js';

const FILING = {
  id: 'f1', orgId: 'o1', createdById: 'u1', houseBol: 'HB1', masterBol: 'MB1',
  status: 'submitted', cbpState: 'NOT_ON_FILE', pendingAction: 'ADD',
  lastTransmissionId: 't1', cbpTransactionId: null, isfFilerCode: null,
};
const accepted = { verdict: 'ACCEPTED' as const, conditions: [], keys: { isfTransactionNumber: 'S7P-12345678901' }, narrative: 'ISF ACCEPTED' };
const rejected = {
  verdict: 'REJECTED' as const, keys: {}, narrative: 'ISF REJECTED',
  conditions: [{ source: 'isf', code: '117', narrative: 'DUPLICATE ISF TRANSACTION', blocking: true, audience: 'filer', reference: 'x' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  prisma.filing.findUnique.mockResolvedValue(FILING);
  prisma.filing.updateMany.mockResolvedValue({ count: 1 });
});

describe('applyIsfVerdict', () => {
  it('puts an accepted add on file with CBP\'s transaction number, notifies and bills once', async () => {
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
    const data = prisma.filing.updateMany.mock.calls[0][0].data;
    expect(prisma.filing.updateMany.mock.calls[0][0].where).toEqual({ id: 'f1', pendingAction: 'ADD', lastTransmissionId: 't1' });
    expect(data).toMatchObject({ status: 'accepted', cbpState: 'ON_FILE', pendingAction: null, cbpTransactionId: 'S7P-12345678901', isfFilerCode: 'S7P' });
    expect(notify.notifyFilingAccepted).toHaveBeenCalledOnce();
    expect(billing.billShipmentForFiling).toHaveBeenCalledWith('f1', 'o1');
  });

  it('records CBP\'s conditions on a rejection and does not bill', async () => {
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: rejected as never });
    const data = prisma.filing.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('rejected');
    expect(JSON.parse(data.rejectionReason)).toMatchObject({ summary: 'ISF REJECTED', errors: [{ code: '117' }] });
    expect(notify.notifyFilingRejected).toHaveBeenCalledOnce();
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it.each(['REPLACE', 'DELETE'])('a rejected %s says the change failed and leaves the ISF accepted, not rejected', async (action) => {
    prisma.filing.findUnique.mockResolvedValue({ ...FILING, status: 'amended', cbpState: 'ON_FILE', pendingAction: action });
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: rejected as never });
    expect(prisma.filing.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'accepted', cbpState: 'ON_FILE' });
    expect(notify.notifyFilingChangeRejected).toHaveBeenCalledWith('o1', 'f1', 'HB1', action, 'DUPLICATE ISF TRANSACTION');
    expect(notify.notifyFilingRejected).not.toHaveBeenCalled();
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  describe('a replace with edits', () => {
    const EDITS = { vesselName: 'NEW VESSEL', estimatedLading: '2026-11-09T06:00:00.000Z' };
    const IN_FLIGHT = {
      ...FILING, status: 'amended', cbpState: 'ON_FILE', pendingAction: 'REPLACE', cbpTransactionId: 'S7P-12345678901', isfFilerCode: 'S7P',
      vesselName: 'OLD VESSEL', estimatedDeparture: null, estimatedLading: null, pendingChanges: EDITS,
    };

    it('leaves the row as CBP holds it when CBP rejects, and keeps the edits to fix and resend', async () => {
      prisma.filing.findUnique.mockResolvedValue(IN_FLIGHT);
      await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: rejected as never });
      const data = prisma.filing.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('vesselName');
      expect(data).not.toHaveProperty('filingDeadline');
      expect(data.rejectedChanges).toEqual(EDITS);
      expect(data.pendingChanges).toBe(Prisma.DbNull);
    });

    it('a rejected replace without edits keeps the edits from an earlier rejection', async () => {
      prisma.filing.findUnique.mockResolvedValue({ ...IN_FLIGHT, pendingChanges: null, rejectedChanges: EDITS });
      await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: rejected as never });
      expect(prisma.filing.updateMany.mock.calls[0][0].data).not.toHaveProperty('rejectedChanges');
    });

    it('an accepted replace without edits changes no data and keeps earlier rejected edits', async () => {
      prisma.filing.findUnique.mockResolvedValue({ ...IN_FLIGHT, pendingChanges: null, rejectedChanges: EDITS });
      await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
      const data = prisma.filing.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('vesselName');
      expect(data).not.toHaveProperty('rejectedChanges');
    });

    it('writes the edits onto the row only once CBP accepts', async () => {
      prisma.filing.findUnique.mockResolvedValue(IN_FLIGHT);
      await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
      const data = prisma.filing.updateMany.mock.calls[0][0].data;
      expect(data.vesselName).toBe('NEW VESSEL');
      expect(data.estimatedLading).toEqual(new Date(EDITS.estimatedLading));
      expect(data.filingDeadline).toEqual(new Date('2026-11-08T06:00:00.000Z'));
      expect(data.pendingChanges).toBe(Prisma.DbNull);
      expect(data.rejectedChanges).toBe(Prisma.DbNull);
    });

    it('an accepted replace clears the rejection left by an earlier attempt', async () => {
      prisma.filing.findUnique.mockResolvedValue({ ...IN_FLIGHT, rejectedAt: new Date(), rejectionReason: '{"summary":"ISF REJECTED"}' });
      await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
      expect(prisma.filing.updateMany.mock.calls[0][0].data).toMatchObject({ rejectedAt: null, rejectionReason: null });
    });
  });

  it('does nothing twice: a duplicate response finds the claim already taken', async () => {
    prisma.filing.updateMany.mockResolvedValue({ count: 0 });
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
    expect(prisma.filingStatusHistory.create).not.toHaveBeenCalled();
    expect(notify.notifyFilingAccepted).not.toHaveBeenCalled();
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it('ignores a response for an older transmission', async () => {
    prisma.filing.findUnique.mockResolvedValue({ ...FILING, lastTransmissionId: 't2' });
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
    expect(prisma.filing.updateMany).not.toHaveBeenCalled();
  });

  it('does not bill an accepted replace (the shipment was billed on its add)', async () => {
    prisma.filing.findUnique.mockResolvedValue({ ...FILING, status: 'amended', cbpState: 'ON_FILE', pendingAction: 'REPLACE', cbpTransactionId: 'S7P-12345678901', isfFilerCode: 'S7P' });
    await applyIsfVerdict({ filingId: 'f1', transmissionId: 't1', filerCode: 'S7P', summary: accepted as never });
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });
});
