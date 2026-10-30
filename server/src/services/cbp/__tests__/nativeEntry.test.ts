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
    validateEntrySummary: vi.fn((_input: unknown): unknown[] => []), buildEntrySummary: vi.fn((_input: any) => ['AE10']),
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
vi.mock('../currency.js', async (orig) => ({
  ...(await orig<typeof import('../currency.js')>()),
  convertInvoiceValuesToUsd: vi.fn(async (body: unknown) => ({ body, conversions: [] })),
}));

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

  it('certifies a type 03 (AD/CVD) entry for cargo release too (CATAIR note ee)', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, entryType: '03' });
    await transmitEntryNative(ARGS);
    expect(engine.buildEntrySummary.mock.calls[0][0].cargoReleaseCertification).toBe(true);
  });

  it('refuses an informal entry over $2,500 before any claim', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, entryType: '11' });
    engine.enrichWithDuty.mockResolvedValueOnce({ entrySummary: { lines: [{ tariffs: [{ htsNumber: '8507600030', valueDollars: 2600 }] }] } });
    const out = await transmitEntryNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 422, body: { code: 'INFORMAL_VALUE_LIMIT' } });
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('accepts an informal entry at $2,500', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, entryType: '11' });
    engine.enrichWithDuty.mockResolvedValueOnce({ entrySummary: { lines: [{ tariffs: [{ htsNumber: '8507600030', valueDollars: 2500 }] }] } });
    expect((await transmitEntryNative(ARGS)).httpStatus).toBe(202);
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

  // ENT-04 (testing week): the entry rules in abiDocumentBodySchema were only
  // enforced on the frozen legacy path; the native send skipped them.
  it('refuses a vessel entry without the foreign port of lading before any claim', async () => {
    const vessel = { ...PAYLOAD, modeOfTransport: '11', manifest: [{ ports: { portOfUnlading: '2704' }, invoices: [{ countryOfExport: 'CN', items: [{ parties: [SELLER] }] }] }] };
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, payload: vessel });
    const out = await transmitEntryNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 422, body: { code: 'ENTRY_DATA_INCOMPLETE' } });
    expect(JSON.stringify(out.body)).toMatch(/foreign port of lading/);
    expect(prisma.abiDocument.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a single transaction bond without its amount', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, payload: { ...PAYLOAD, bond: { type: '9', suretyCode: '123', taxId: '57-123456789' } } });
    const out = await transmitEntryNative(ARGS);
    expect(out).toMatchObject({ httpStatus: 422, body: { code: 'ENTRY_DATA_INCOMPLETE', error: 'A single transaction bond needs its amount' } });
  });

  // ENT-01 (testing week): the wizard showed "lines[0].parties[S]mandatory for
  // entry type 01 (ESF-134)", which no user can act on.
  it('words line-party issues so a user can act on them', async () => {
    engine.validateEntrySummary.mockReturnValue([{ severity: 'F', field: 'lines[0].parties[S]', message: 'mandatory for entry type 01 (ESF-134)' }]);
    const out = await transmitEntryNative(ARGS);
    expect((out.body as { issues: Array<{ message: string }> }).issues[0].message).toBe('Line 1 needs a Buyer party with its tax ID (CBP "sold to" party, required for this entry type).');
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

  it('puts releaseRequested back when nothing reached CBP', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DOC, status: 'ACCEPTED', cbpState: 'ON_FILE', entrySummaryStatus: 'ACCEPTED', releaseRequested: true });
    transmit.transmitNative.mockResolvedValue({ id: 't1', userDataTag: 'MCLX', status: 'FAILED', lastError: 'refused' });
    await transmitEntryNative({ ...ARGS, action: 'REPLACE' });
    expect(prisma.abiDocument.update.mock.calls[0][0].data.releaseRequested).toBe(true);
  });

  it('refuses to claim an entry edited after it was built, so CBP gets what the row holds', async () => {
    await transmitEntryNative(ARGS);
    expect(prisma.abiDocument.updateMany.mock.calls[0][0].where).toMatchObject({ payload: { equals: PAYLOAD } });
  });
});
