/**
 * Correlation (native go-live D3): a response tagged with our B-record user
 * data settles its transmission; untagged CBP messages (SA, SO, UC, ...)
 * match the latest transmission by ISF transaction or entry number without
 * changing its status.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { cbpTransmission: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
const { summary, applyIsf } = vi.hoisted(() => ({ summary: vi.fn(), applyIsf: vi.fn() }));
vi.mock('../responses.js', () => ({ summarizeResponse: summary }));
vi.mock('../isfVerdicts.js', () => ({ applyIsfVerdict: applyIsf }));
vi.mock('../entryVerdicts.js', () => ({ applyEntryVerdict: vi.fn() }));

import { taggedTransmissionHandler, businessKeyHandler } from '../transmissionHandlers.js';

const row = (tag: string | null, application = 'SN') => ({ id: 'r1', environment: 'PROD', application, userDataTag: tag, lines: ['A', 'Z'] });
const TX = { id: 't1', entityType: 'filing', entityId: 'f1', status: 'SENT', isfTransactionNumber: null, entryNumber: null };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.cbpTransmission.update.mockResolvedValue({});
});

describe('taggedTransmissionHandler', () => {
  it('settles the tagged transmission with the verdict and CBP keys', async () => {
    prisma.cbpTransmission.findUnique.mockResolvedValue(TX);
    summary.mockReturnValue({ verdict: 'ACCEPTED', conditions: [], keys: { isfTransactionNumber: 'S7P-1' } });
    const m = await taggedTransmissionHandler(row('MCLABC'));
    expect(prisma.cbpTransmission.findUnique).toHaveBeenCalledWith({ where: { userDataTag: 'MCLABC' } });
    expect(prisma.cbpTransmission.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ status: 'ACCEPTED', isfTransactionNumber: 'S7P-1', respondedAt: expect.any(Date) }),
    });
    expect(m).toMatchObject({ entityType: 'filing', entityId: 'f1', transmissionId: 't1' });
    expect(applyIsf).toHaveBeenCalledWith(expect.objectContaining({ filingId: 'f1', transmissionId: 't1' }));
  });

  it('ignores rows without our tag', async () => {
    expect(await taggedTransmissionHandler(row('SCENARIO 090'))).toBeNull();
    expect(await taggedTransmissionHandler(row(null))).toBeNull();
  });

  it('does not change status for an informational message', async () => {
    prisma.cbpTransmission.findUnique.mockResolvedValue(TX);
    summary.mockReturnValue({ verdict: 'INFO', conditions: [], keys: {} });
    await taggedTransmissionHandler(row('MCLABC'));
    expect(prisma.cbpTransmission.update).not.toHaveBeenCalled();
  });
});

describe('businessKeyHandler', () => {
  it('matches an ISF status advisory to the latest transmission with that ISF number', async () => {
    summary.mockReturnValue({ verdict: 'INFO', conditions: [], keys: { isfTransactionNumber: 'S7P-1' } });
    prisma.cbpTransmission.findFirst.mockResolvedValue(TX);
    const m = await businessKeyHandler(row(null, 'SA'));
    expect(prisma.cbpTransmission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { isfTransactionNumber: 'S7P-1', environment: 'PROD', status: { not: 'FAILED' } },
    }));
    expect(prisma.cbpTransmission.update).not.toHaveBeenCalled();
    expect(m).toMatchObject({ entityType: 'filing', entityId: 'f1', transmissionId: 't1' });
  });

  it('never matches a transmission that provably never reached CBP', async () => {
    summary.mockReturnValue({ application: 'SX', verdict: 'ACCEPTED', conditions: [], keys: { entryNumber: 'ABC12345676' } });
    prisma.cbpTransmission.findFirst.mockResolvedValue(null);
    await businessKeyHandler(row(null, 'SX'));
    expect(prisma.cbpTransmission.findFirst.mock.calls[0][0].where).toEqual({ entryNumber: 'ABC12345676', environment: 'PROD', status: { not: 'FAILED' } });
  });

  it('leaves a message with no known keys unmatched', async () => {
    summary.mockReturnValue({ verdict: 'INFO', conditions: [], keys: {} });
    expect(await businessKeyHandler(row(null, '%R'))).toBeNull();
  });
});
