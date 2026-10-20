/** Native entry transmission (native go-live 4.1). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, filer, engine, transmit, cfg } = vi.hoisted(() => ({
  prisma: {
    abiDocument: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    htsRateLine: {},
  },
  filer: { loadOrgCbpConfig: vi.fn(), checkEntryFiler: vi.fn() },
  engine: {
    migrateV1ToV2: vi.fn((x) => x), enrichWithDuty: vi.fn(async (x) => x),
    toAeEntrySummaryInput: vi.fn(() => ({ districtPortOfEntry: '2704' })),
    validateEntrySummary: vi.fn(() => []), buildEntrySummary: vi.fn(() => ['AE10']),
  },
  transmit: { transmitNative: vi.fn() },
  cfg: { transport: 'mqipt', environment: 'CERT' },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../filerIdentity.js', () => filer);
vi.mock('../../../abi-engine/payload/migrateV1.js', () => ({ migrateV1ToV2: engine.migrateV1ToV2 }));
vi.mock('../../../abi-engine/duty/engine.js', () => ({ enrichWithDuty: engine.enrichWithDuty }));
vi.mock('../../../abi-engine/refdata/dbRateSource.js', () => ({ DbHtsRateSource: class {} }));
vi.mock('../../../abi-engine/payload/toAeInput.js', () => ({ toAeEntrySummaryInput: engine.toAeEntrySummaryInput }));
vi.mock('../../../abi-engine/validate/entrySummary.js', () => ({ validateEntrySummary: engine.validateEntrySummary }));
vi.mock('../../../abi-engine/ae/builder.js', () => ({ buildEntrySummary: engine.buildEntrySummary }));
vi.mock('../nativeTransmit.js', () => transmit);
vi.mock('../transport.js', () => ({ cbpTransport: {}, cbpTrafficConfig: cfg }));
vi.mock('../sender.js', () => ({ requireCbpSender: () => ({ siteCode: '1303', idCode: 'S7P', password: 'X' }) }));
vi.mock('../../auditLog.js', () => ({ writeAuditLog: vi.fn() }));

import { transmitEntryNative } from '../nativeEntry.js';

const SELLER = { type: 'seller', name: 'Albion Ltd', address: '12 Quay Rd', city: 'Felixstowe', country: 'GB' };
const PAYLOAD = { entryNumber: 'ABC-1234567-6', ior: { number: '57-123456789' }, manifest: [{ invoices: [{ items: [{ parties: [SELLER] }] }] }] };
const DOC = { id: 'd1', orgId: 'o1', status: 'DRAFT', entryType: '01', cbpState: 'NOT_ON_FILE', pendingAction: null, entrySummaryStatus: null, cargoReleaseStatus: null, releaseRequested: false, payload: PAYLOAD };
const ARGS = { docId: 'd1', orgId: 'o1', userId: 'u1', action: 'ADD' as const };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.findFirst.mockResolvedValue(DOC);
  prisma.abiDocument.updateMany.mockResolvedValue({ count: 1 });
  prisma.abiDocument.update.mockResolvedValue({});
  prisma.user.findUnique.mockResolvedValue({ firstName: 'Ibrahim', lastName: 'Rayana' });
  prisma.organization.findUnique.mockResolvedValue({ phone: '(202) 341-7574' });
  filer.checkEntryFiler.mockReturnValue({ ok: true, filerCode: 'ABC' });
  engine.validateEntrySummary.mockReturnValue([]);
  transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'SENT' });
});

describe('transmitEntryNative', () => {
  it('certifies a type 01 entry for cargo release with a real contact and the seller/buyer entities', async () => {
    const out = await transmitEntryNative(ARGS);
    const input = engine.buildEntrySummary.mock.calls[0][0];
    expect(input.cargoReleaseCertification).toBe(true);
    expect(input.certifyContact).toEqual({ name: 'IBRAHIM RAYANA', phone: '2023417574' });
    expect(input.cargoEntities.map((e: { code: string }) => e.code)).toEqual(['SE', 'BY']);
    expect(transmit.transmitNative).toHaveBeenCalledWith(expect.objectContaining({ application: 'AE', action: 'A', filerCode: 'ABC', entryNumber: 'ABC12345676' }));
    expect(out.httpStatus).toBe(202);
  });

  it('refuses Type 86', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, entryType: '86' });
    expect((await transmitEntryNative(ARGS)).body).toMatchObject({ code: 'entry_type_suspended' });
  });

  it('refuses an entry number under another filer code', async () => {
    filer.checkEntryFiler.mockReturnValue({ ok: false, code: 'ENTRY_FILER_MISMATCH', message: 'x' });
    expect((await transmitEntryNative(ARGS)).httpStatus).toBe(422);
    expect(transmit.transmitNative).not.toHaveBeenCalled();
  });

  it('refuses release certification without a contact phone', async () => {
    prisma.organization.findUnique.mockResolvedValue({ phone: null });
    expect((await transmitEntryNative(ARGS)).body).toMatchObject({ code: 'CERTIFY_CONTACT_MISSING' });
  });

  it('returns CBP-rule issues from the engine validator before any claim', async () => {
    engine.validateEntrySummary.mockReturnValue([{ severity: 'F', field: 'payment', message: 'statement date on a holiday' }]);
    const out = await transmitEntryNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 422, body: { code: 'ENTRY_DATA_INCOMPLETE' } });
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back when the send provably never left', async () => {
    transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'FAILED', lastError: 'refused' });
    const out = await transmitEntryNative(ARGS);
    expect(prisma.abiDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', pendingAction: null }) }));
    expect(out.httpStatus).toBe(502);
  });
});
