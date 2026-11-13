/**
 * Native ISF transmission (native go-live 3.3): lifecycle check, filer
 * identity, honest mapping, an atomic claim, then exactly-once transmit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, transmit, mapper, filer, cfg } = vi.hoisted(() => ({
  prisma: { filing: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, filingStatusHistory: { create: vi.fn() } },
  transmit: { transmitNative: vi.fn() },
  mapper: { mapFilingToIsfInput: vi.fn(() => ({})), buildIsf: vi.fn(() => ['SF10']) },
  filer: { loadOrgCbpConfig: vi.fn(), resolveIsfFiler: vi.fn() },
  cfg: { transport: 'mqipt', environment: 'CERT' },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../nativeTransmit.js', () => transmit);
vi.mock('../../../abi-engine/isf/fromFiling.js', () => ({ mapFilingToIsfInput: mapper.mapFilingToIsfInput }));
vi.mock('../../../abi-engine/isf/builder.js', () => ({ buildIsf: mapper.buildIsf }));
vi.mock('../filerIdentity.js', () => filer);
vi.mock('../transport.js', () => ({ cbpTransport: { send: vi.fn() }, cbpTrafficConfig: cfg }));
vi.mock('../sender.js', () => ({ requireCbpSender: () => ({ siteCode: '1303', idCode: 'S7P', password: 'X' }) }));
vi.mock('../../notifications.js', () => ({ notifyFilingSubmitted: vi.fn() }));

import { Prisma } from '@prisma/client';
import { RecordCodecError } from '../../../abi-engine/records/codec.js';
import { transmitIsfNative } from '../nativeIsf.js';

const DRAFT = { id: 'f1', orgId: 'o1', status: 'draft', cbpState: 'NOT_ON_FILE', pendingAction: null, isfFilerMode: null, isfFilerCode: null, cbpTransactionId: null, houseBol: 'HB1', masterBol: 'MB1' };
const ARGS = { filingId: 'f1', orgId: 'o1', userId: 'u1', action: 'ADD' as const };

beforeEach(() => {
  vi.clearAllMocks();
  cfg.transport = 'mqipt';
  prisma.filing.findFirst.mockResolvedValue(DRAFT);
  prisma.filing.updateMany.mockResolvedValue({ count: 1 });
  prisma.filing.update.mockResolvedValue({});
  filer.resolveIsfFiler.mockReturnValue({ ok: true, filerCode: 'S7P', mode: 'SIGMA' });
  transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'SENT', mqMessageId: 'm' });
});

describe('transmitIsfNative', () => {
  it('claims the draft, transmits under the resolved filer and records the transmission', async () => {
    const out = await transmitIsfNative(ARGS);
    expect(prisma.filing.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'f1', pendingAction: null, status: 'draft' },
      data: { status: 'submitted', pendingAction: 'ADD', rejectionReason: null, rejectedAt: null },
    });
    expect(transmit.transmitNative).toHaveBeenCalledWith(expect.objectContaining({ application: 'SF', action: 'A', filerCode: 'S7P', entityId: 'f1' }));
    expect(out.httpStatus).toBe(202);
  });

  it('refuses an action the lifecycle does not allow', async () => {
    const out = await transmitIsfNative({ ...ARGS, action: 'REPLACE' });
    expect(out.httpStatus).toBe(409);
    expect(transmit.transmitNative).not.toHaveBeenCalled();
  });

  it('refuses when the filer cannot be resolved', async () => {
    filer.resolveIsfFiler.mockReturnValue({ ok: false, code: 'SERVICE_CENTER_NOT_APPROVED', message: 'not approved' });
    const out = await transmitIsfNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 409, body: { code: 'SERVICE_CENTER_NOT_APPROVED' } });
  });

  it('reports mapping problems with their field paths, before claiming', async () => {
    const { RecordCodecError } = await import('../../../abi-engine/records/codec.js');
    mapper.mapFilingToIsfInput.mockImplementationOnce(() => { throw new RecordCodecError([{ record: 'PlatformIsfFiling', field: 'seller.country', message: 'seller: country is required' }]); });
    const out = await transmitIsfNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 422, body: { code: 'ISF_DATA_INCOMPLETE' } });
    expect(prisma.filing.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 when a concurrent submit already claimed it', async () => {
    prisma.filing.updateMany.mockResolvedValue({ count: 0 });
    expect((await transmitIsfNative(ARGS)).httpStatus).toBe(409);
    expect(transmit.transmitNative).not.toHaveBeenCalled();
  });

  it('rolls back when the send provably never left', async () => {
    transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'FAILED', lastError: 'refused' });
    const out = await transmitIsfNative(ARGS);
    expect(prisma.filing.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'draft', pendingAction: null }) }));
    expect(out.httpStatus).toBe(502);
  });

  it('keeps the filing awaiting CBP when the outcome is unknown', async () => {
    transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'UNKNOWN', lastError: 'timeout' });
    const out = await transmitIsfNative(ARGS);
    expect(prisma.filing.update).not.toHaveBeenCalled();
    expect(out).toMatchObject({ httpStatus: 202, body: { outcome: 'UNKNOWN' } });
  });

  it('replace and delete reuse the filer code CBP accepted the ISF under', async () => {
    prisma.filing.findFirst.mockResolvedValue({ ...DRAFT, status: 'accepted', cbpState: 'ON_FILE', isfFilerCode: 'ABC', cbpTransactionId: 'ABC-12345678901' });
    await transmitIsfNative({ ...ARGS, action: 'DELETE' });
    expect(filer.resolveIsfFiler).not.toHaveBeenCalled();
    expect(transmit.transmitNative).toHaveBeenCalledWith(expect.objectContaining({ action: 'D', filerCode: 'ABC', isfTransactionNumber: 'ABC-12345678901' }));
  });

  describe('a replace with edits', () => {
    const ON_FILE = { ...DRAFT, status: 'accepted', cbpState: 'ON_FILE', isfFilerCode: 'S7P', cbpTransactionId: 'S7P-1', vesselName: 'OLD VESSEL', estimatedDeparture: null, estimatedLading: null, pendingChanges: null, rejectedChanges: null };
    const EDITS = { vesselName: 'NEW VESSEL' };
    const REPLACE = { ...ARGS, action: 'REPLACE' as const, edits: EDITS };

    beforeEach(() => prisma.filing.findFirst.mockResolvedValue(ON_FILE));

    it('sends the edits to CBP but holds them off the row', async () => {
      await transmitIsfNative(REPLACE);
      expect(mapper.mapFilingToIsfInput).toHaveBeenCalledWith(expect.objectContaining({ vesselName: 'NEW VESSEL' }), expect.anything());
      const claim = prisma.filing.updateMany.mock.calls[0][0].data;
      expect(claim).toMatchObject({ pendingAction: 'REPLACE', pendingChanges: EDITS });
      expect(claim).not.toHaveProperty('vesselName');
    });

    it('stores nothing when the edits cannot be built into an ISF', async () => {
      mapper.buildIsf.mockImplementationOnce(() => { throw new RecordCodecError([{ record: 'SF10', field: 'x', problem: 'required', message: 'required' }] as never); });
      const out = await transmitIsfNative(REPLACE);
      expect(out.httpStatus).toBe(422);
      expect(prisma.filing.updateMany).not.toHaveBeenCalled();
    });

    it('drops the in-flight edits when nothing reached CBP', async () => {
      transmit.transmitNative.mockResolvedValue({ id: 't1', status: 'FAILED', lastError: 'queue down' });
      await transmitIsfNative(REPLACE);
      const data = prisma.filing.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ status: 'accepted', pendingAction: null, pendingChanges: Prisma.DbNull });
      expect(data).not.toHaveProperty('rejectedChanges');
    });

    it('a replace without edits leaves the edits kept from a rejection alone', async () => {
      prisma.filing.findFirst.mockResolvedValue({ ...ON_FILE, rejectedChanges: { vesselName: 'REJECTED VESSEL' } });
      await transmitIsfNative({ ...ARGS, action: 'REPLACE' });
      const claim = prisma.filing.updateMany.mock.calls[0][0].data;
      expect(claim).not.toHaveProperty('rejectedChanges');
      expect(claim).not.toHaveProperty('pendingChanges');
    });
  });
});
