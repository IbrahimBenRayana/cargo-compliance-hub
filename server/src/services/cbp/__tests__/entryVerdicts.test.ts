/** Entry verdicts (native go-live 4.2): AX + SX settle the entry; side effects once. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, n, w, b, log } = vi.hoisted(() => ({
  prisma: { abiDocument: { findUnique: vi.fn(), updateMany: vi.fn() } },
  n: { notify: vi.fn() }, w: { emitWebhook: vi.fn() }, b: { billShipment: vi.fn() },
  log: { warn: vi.fn() },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../../../config/logger.js', () => ({ default: log }));
vi.mock('../../notifications.js', () => n);
vi.mock('../../webhooks.js', () => w);
vi.mock('../../shipmentBilling.js', () => b);

import { Prisma } from '@prisma/client';
import { applyEntryVerdict } from '../entryVerdicts.js';

const SENT = { id: 'd1', orgId: 'o1', status: 'SENT', cbpState: 'NOT_ON_FILE', pendingAction: 'ADD', entrySummaryStatus: null, cargoReleaseStatus: null, releaseRequested: true, lastTransmissionId: 't1', entryNumber: 'ABC12345676', mbolNumber: 'M', entryType: '01', filingId: null };
const ax = (verdict: 'ACCEPTED' | 'REJECTED') => ({ application: 'AX', verdict, conditions: [], keys: {} });
const sx = (verdict: 'ACCEPTED' | 'REJECTED') => ({ application: 'SX', verdict, conditions: [], keys: {} });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.updateMany.mockResolvedValue({ count: 1 });
});

describe('applyEntryVerdict', () => {
  it('an accepted summary alone does not accept a release-certified entry', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue(SENT);
    await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: ax('ACCEPTED') as never });
    expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).toMatchObject({ entrySummaryStatus: 'ACCEPTED', status: 'SENT', cbpState: 'ON_FILE' });
    expect(b.billShipment).not.toHaveBeenCalled();
  });

  it('the release then accepts the entry, notifies and bills once', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ ...SENT, pendingAction: null, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED' });
    await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: sx('ACCEPTED') as never });
    expect(prisma.abiDocument.updateMany.mock.calls[0][0].data.status).toBe('ACCEPTED');
    expect(n.notify).toHaveBeenCalledOnce();
    expect(b.billShipment).toHaveBeenCalledWith({ abiDocumentId: 'd1' }, 'o1');
  });

  it('a rejected summary rejects the entry and records CBP\'s reasons', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue(SENT);
    await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: { ...ax('REJECTED'), conditions: [{ code: '204', narrative: 'Prelim Stmt Date is Sat, Sun, or Hol' }] } as never });
    const data = prisma.abiDocument.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('REJECTED');
    expect(JSON.parse(data.lastError).errors[0].code).toBe('204');
    expect(b.billShipment).not.toHaveBeenCalled();
  });

  describe('a rejected change to an entry CBP already holds', () => {
    const ON_FILE = { ...SENT, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: 'ACCEPTED' };
    const refused = { ...ax('REJECTED'), conditions: [{ code: '204', narrative: 'Prelim Stmt Date is Sat, Sun, or Hol' }] };

    it('tells people a rejected replace was rejected, never accepted', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...ON_FILE, pendingAction: 'REPLACE' });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      const event = n.notify.mock.calls[0][0];
      expect(event.kind).toBe('entry_rejected');
      expect(event.title).toBe('Entry Replace Rejected by CBP');
      expect(event.message).toContain('Prelim Stmt Date is Sat, Sun, or Hol');
      expect(event.message).toContain('stays on file');
      expect(event.audience).toEqual({ orgId: 'o1', roles: ['OPERATOR', 'ADMIN', 'OWNER'] });
      expect(w.emitWebhook).toHaveBeenCalledWith('o1', 'entry.rejected', expect.objectContaining({ abiDocumentId: 'd1', action: 'REPLACE', onFile: true }));
      expect(w.emitWebhook).not.toHaveBeenCalledWith('o1', 'entry.accepted', expect.anything());
    });

    it('tells people a rejected delete was rejected, never accepted', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...ON_FILE, pendingAction: 'DELETE' });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(n.notify.mock.calls[0][0]).toMatchObject({ kind: 'entry_rejected', title: 'Entry Delete Rejected by CBP' });
      expect(w.emitWebhook).toHaveBeenCalledWith('o1', 'entry.rejected', expect.objectContaining({ action: 'DELETE', onFile: true }));
    });

    it('still speaks up while the cargo release is outstanding', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...ON_FILE, pendingAction: 'REPLACE', cargoReleaseStatus: null });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data.status).toBe('SENT');
      expect(n.notify.mock.calls[0][0].kind).toBe('entry_rejected');
    });

    it('an accepted replace still reads as accepted', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...ON_FILE, pendingAction: 'REPLACE' });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: ax('ACCEPTED') as never });
      expect(n.notify.mock.calls[0][0].kind).toBe('entry_accepted');
    });
  });

  describe('what the row holds after CBP answers a replace', () => {
    const ACCEPTED_PAYLOAD = { entryNumber: 'ABC-1234567-6', ior: { name: 'ACCEPTED IOR' }, entryType: '01', modeOfTransport: '40' };
    const EDITED_PAYLOAD = { entryNumber: 'ABC-1234567-6', ior: { name: 'EDITED IOR' }, entryType: '01', modeOfTransport: '40' };
    const IN_FLIGHT = {
      ...SENT, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: null, releaseRequested: true,
      pendingAction: 'REPLACE', payload: EDITED_PAYLOAD, acceptedVersion: { payload: ACCEPTED_PAYLOAD, releaseRequested: false }, rejectedPayload: null,
    };
    const refused = { ...ax('REJECTED'), conditions: [{ code: '204', narrative: 'Prelim Stmt Date is Sat, Sun, or Hol' }] };

    it('a rejected replace puts back what CBP holds and keeps the edits to fix and resend', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue(IN_FLIGHT);
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).toMatchObject({
        payload: ACCEPTED_PAYLOAD, iorName: 'ACCEPTED IOR', rejectedPayload: EDITED_PAYLOAD,
      });
    });

    it('resending what CBP already holds does not overwrite the kept edits', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...IN_FLIGHT, payload: { ...ACCEPTED_PAYLOAD }, rejectedPayload: EDITED_PAYLOAD });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).not.toHaveProperty('rejectedPayload');
    });

    it('a rejected replace also undoes a release request CBP never accepted', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue(IN_FLIGHT);
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).toMatchObject({ releaseRequested: false, status: 'ACCEPTED' });
    });

    it('an accepted replace becomes the version to fall back to', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...IN_FLIGHT, rejectedPayload: { iorName: 'OLDER ATTEMPT' } });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: ax('ACCEPTED') as never });
      const data = prisma.abiDocument.updateMany.mock.calls[0][0].data;
      expect(data.acceptedVersion).toEqual({ payload: EDITED_PAYLOAD, releaseRequested: true });
      expect(data.rejectedPayload).toBe(Prisma.DbNull);
      expect(data).not.toHaveProperty('payload');
    });

    it('an accepted add is the first version to fall back to', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...SENT, payload: ACCEPTED_PAYLOAD });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: ax('ACCEPTED') as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data.acceptedVersion).toEqual({ payload: ACCEPTED_PAYLOAD, releaseRequested: true });
    });

    it('a rejected add stores no accepted version', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...SENT, payload: EDITED_PAYLOAD });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      const data = prisma.abiDocument.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('acceptedVersion');
      expect(data).not.toHaveProperty('rejectedPayload');
    });

    it('a rejected delete leaves the data alone', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...IN_FLIGHT, pendingAction: 'DELETE' });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      const data = prisma.abiDocument.updateMany.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('payload');
      expect(data).not.toHaveProperty('rejectedPayload');
    });

    it('a cargo release verdict never moves the accepted version', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...IN_FLIGHT, pendingAction: null });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: sx('ACCEPTED') as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).not.toHaveProperty('acceptedVersion');
    });

    it('with no accepted version on record (sent before this was kept) it warns and leaves the row', async () => {
      prisma.abiDocument.findUnique.mockResolvedValue({ ...IN_FLIGHT, acceptedVersion: null });
      await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: refused as never });
      expect(prisma.abiDocument.updateMany.mock.calls[0][0].data).not.toHaveProperty('payload');
      expect(log.warn).toHaveBeenCalledOnce();
    });
  });

  it('ignores a response for an older transmission', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ ...SENT, lastTransmissionId: 't2' });
    await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: ax('ACCEPTED') as never });
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing twice when the claim was already taken', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ ...SENT, pendingAction: null, cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED' });
    prisma.abiDocument.updateMany.mockResolvedValue({ count: 0 });
    await applyEntryVerdict({ docId: 'd1', transmissionId: 't1', summary: sx('ACCEPTED') as never });
    expect(n.notify).not.toHaveBeenCalled();
    expect(b.billShipment).not.toHaveBeenCalled();
  });
});
