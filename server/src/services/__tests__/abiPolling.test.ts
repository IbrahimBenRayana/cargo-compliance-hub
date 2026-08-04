/**
 * Locks the cron sweep over SENT ABI documents (pollSentAbiDocuments) — the
 * job that carries late CBP responses to terminal status and therefore to
 * billing. Also locks the anchor-extended CC search window: a document sent
 * more than 30 days ago must still fall inside the list-call date range.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, abiGateway, billing, notifications, webhooks } = vi.hoisted(() => ({
  prisma: {
    abiDocument: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    submissionLog: { create: vi.fn() },
  },
  abiGateway: { listABIDocuments: vi.fn() },
  billing: { billShipment: vi.fn(() => Promise.resolve()) },
  notifications: { notify: vi.fn(() => Promise.resolve()) },
  webhooks: { emitWebhook: vi.fn() },
}));

vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../abi/gateway.js', () => ({ abiGateway }));
vi.mock('../shipmentBilling.js', () => billing);
vi.mock('../notifications.js', () => notifications);
vi.mock('../webhooks.js', () => webhooks);

import { pollSentAbiDocuments, runSinglePoll } from '../abiPolling.js';

const SENT_DOC = {
  id: 'd1',
  orgId: 'o1',
  entryType: '01',
  entryNumber: '00012345671',
  mbolNumber: 'MBOL1',
  entryDate: null,
  sentAt: new Date(),
};

const ccListResponse = (body: any[]) => ({ status: 200, data: { body }, latencyMs: 1 });

const ACCEPTED_BODY = {
  entryNumber: '00012345671',
  entrySummaryStatus: 'ACCEPTED',
  cargoReleaseStatus: 'ACCEPTED',
  _id: 'cc1',
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.findMany.mockResolvedValue([SENT_DOC]);
  prisma.abiDocument.findUnique.mockResolvedValue({ filingId: null });
  prisma.abiDocument.update.mockResolvedValue({});
  prisma.submissionLog.create.mockResolvedValue({});
  abiGateway.listABIDocuments.mockResolvedValue(ccListResponse([ACCEPTED_BODY]));
});

describe('pollSentAbiDocuments', () => {
  it('carries a late-accepted SENT document to ACCEPTED and bills it', async () => {
    await pollSentAbiDocuments();

    expect(prisma.abiDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENT' }),
      })
    );
    expect(prisma.abiDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    );
    expect(billing.billShipment).toHaveBeenCalledWith({ abiDocumentId: 'd1' }, 'o1');
    expect(webhooks.emitWebhook).toHaveBeenCalledWith('o1', 'entry.accepted', expect.anything());
  });

  it('anchors billing on the linked ISF filing when present', async () => {
    prisma.abiDocument.findUnique.mockResolvedValue({ filingId: 'f9' });

    await pollSentAbiDocuments();

    expect(billing.billShipment).toHaveBeenCalledWith({ filingId: 'f9' }, 'o1');
  });

  it('leaves the document at SENT and does not bill when CBP has not responded', async () => {
    abiGateway.listABIDocuments.mockResolvedValue(
      ccListResponse([{ ...ACCEPTED_BODY, entrySummaryStatus: 'PENDING', cargoReleaseStatus: null }])
    );

    await pollSentAbiDocuments();

    expect(prisma.abiDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: expect.anything() }),
      })
    );
    expect(billing.billShipment).not.toHaveBeenCalled();
  });

  it('marks REJECTED without billing when either side rejects', async () => {
    abiGateway.listABIDocuments.mockResolvedValue(
      ccListResponse([{ ...ACCEPTED_BODY, cargoReleaseStatus: 'REJECTED' }])
    );

    await pollSentAbiDocuments();

    expect(prisma.abiDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) })
    );
    expect(billing.billShipment).not.toHaveBeenCalled();
  });

  it('survives a failing poll for one document and continues the sweep', async () => {
    const doc2 = { ...SENT_DOC, id: 'd2', entryNumber: '00012345682' };
    prisma.abiDocument.findMany.mockResolvedValue([SENT_DOC, doc2]);
    abiGateway.listABIDocuments
      .mockRejectedValueOnce(new Error('CC down'))
      .mockResolvedValueOnce(ccListResponse([{ ...ACCEPTED_BODY, entryNumber: '00012345682' }]));

    await pollSentAbiDocuments();

    // Second doc still resolved despite the first one's gateway failure.
    expect(prisma.abiDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd2' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    );
  });

  it('does nothing when no SENT documents exist', async () => {
    prisma.abiDocument.findMany.mockResolvedValue([]);

    await pollSentAbiDocuments();

    expect(abiGateway.listABIDocuments).not.toHaveBeenCalled();
  });
});

describe('runSinglePoll anchor window', () => {
  it('extends dateFrom to cover a document sent more than 30 days ago', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const oldAnchor = new Date(Date.now() - 90 * DAY);

    await runSinglePoll({
      docId: 'd1',
      orgId: 'o1',
      userId: null,
      entryType: '01',
      entryNumber: '00012345671',
      mbolNumber: null,
      anchorDate: oldAnchor,
    });

    const params = abiGateway.listABIDocuments.mock.calls[0][0];
    // Lower bound must reach 30 days before the anchor, not 30 days before today.
    const expectedFrom = new Date(oldAnchor.getTime() - 30 * DAY).toISOString().slice(0, 10);
    expect(params.dateFrom).toBe(expectedFrom);
  });

  it('keeps the default ±30-day window for a fresh document', async () => {
    const DAY = 24 * 60 * 60 * 1000;

    await runSinglePoll({
      docId: 'd1',
      orgId: 'o1',
      userId: null,
      entryType: '01',
      entryNumber: '00012345671',
      mbolNumber: null,
      anchorDate: new Date(),
    });

    const params = abiGateway.listABIDocuments.mock.calls[0][0];
    expect(params.dateFrom).toBe(new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10));
    expect(params.dateTo).toBe(new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10));
  });
});
