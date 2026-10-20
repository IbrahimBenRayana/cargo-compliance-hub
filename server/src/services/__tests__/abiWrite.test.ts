/**
 * Locks the branch behavior of sendAbiDocumentToCBP — the ABI Entry CBP
 * transmission path extracted from routes/abiDocuments.ts. Gateway + side-effect
 * deps are mocked; we assert the (httpStatus, body) outcome and that billing
 * fires only on a successful send.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma, abiGateway, mapper, schema, billing, entitlements } = vi.hoisted(() => ({
  prisma: {
    abiDocument: {
      findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(),
      update: vi.fn(), updateMany: vi.fn(),
    },
    submissionLog: { create: vi.fn() },
    orgCbpConfig: { findUnique: vi.fn() },
  },
  abiGateway: { createABIDocument: vi.fn(), sendABIDocument: vi.fn(), deleteABIDocument: vi.fn() },
  mapper: {
    mapABIDocumentToCC: vi.fn(() => ({})),
    hasNativeOnlyData: vi.fn(() => false),
    buildSendPayload: vi.fn(() => ({})),
    canonicaliseEntryNumber: vi.fn((s: string) => s),
    extractCCErrorMessage: vi.fn(() => 'cc error'),
    extractDenormFromPayload: vi.fn(),
    prefillFromFiling: vi.fn(() => ({})),
    prefillFromManifestQuery: vi.fn(() => ({})),
  },
  schema: {
    abiDocumentBodySchema: { safeParse: vi.fn() },
    createABIDocumentSchema: { safeParse: vi.fn() },
  },
  billing: { billShipment: vi.fn() },
  entitlements: { getOrgEntitlements: vi.fn() },
}));

vi.mock('../../config/database.js', () => ({ prisma }));
const { nativeEntry } = vi.hoisted(() => ({ nativeEntry: { transmitEntryNative: vi.fn() } }));
vi.mock('../cbp/nativeEntry.js', () => nativeEntry);
vi.mock('../abi/gateway.js', () => ({ abiGateway }));
vi.mock('../abiDocumentMapper.js', () => mapper);
vi.mock('../../schemas/abiDocument.js', () => schema);
vi.mock('../shipmentBilling.js', () => billing);
vi.mock('../entitlements.js', () => entitlements);
vi.mock('../errorTranslator.js', () => ({ sanitizeErrorMessage: (s: string) => s }));
vi.mock('../auditLog.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../notifications.js', () => ({ notify: vi.fn(() => Promise.resolve()) }));
vi.mock('../abiPolling.js', () => ({ pollABIDocumentStatus: vi.fn(() => Promise.resolve()) }));

import { sendAbiDocumentToCBP, isEntryEditable } from '../abiWrite.js';

const ARGS = { docId: 'd1', orgId: 'o1', userId: 'u1' };
// ABC-1234567 with its CATAIR check digit; the org's approved CBP setup uses ABC.
const VALID_ENTRY = 'ABC-1234567-6';
const DRAFT = { id: 'd1', orgId: 'o1', status: 'DRAFT', payload: { entryNumber: VALID_ENTRY }, filingId: null, entryType: '01', entryNumber: 'ENT1', mbolNumber: 'MBOL1' };
// These tests cover the CustomsCity fallback gateway; the native branch has its own test.
const APPROVED_CBP = { filerCode: 'ABC', isfFilerModeDefault: 'CLIENT', serviceCenterApprovedAt: new Date('2026-10-01'), gateway: 'CC' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.findFirst.mockResolvedValue(DRAFT);
  prisma.abiDocument.updateMany.mockResolvedValue({ count: 1 });
  prisma.abiDocument.findUniqueOrThrow.mockResolvedValue(DRAFT);
  prisma.abiDocument.findUnique.mockResolvedValue(DRAFT);
  prisma.abiDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...DRAFT, ...data }));
  prisma.submissionLog.create.mockResolvedValue({});
  prisma.orgCbpConfig.findUnique.mockResolvedValue(APPROVED_CBP);
  schema.abiDocumentBodySchema.safeParse.mockReturnValue({ success: true });
  mapper.extractDenormFromPayload.mockReturnValue({ mbolNumber: 'MBOL1', entryNumber: 'ENT1', entryType: '01', modeOfTransport: '40' });
  abiGateway.createABIDocument.mockResolvedValue({ status: 201, data: { _id: 'cc1' }, latencyMs: 1 });
  abiGateway.sendABIDocument.mockResolvedValue({ status: 200, data: {}, latencyMs: 1 });
  entitlements.getOrgEntitlements.mockResolvedValue({ canFile: true, hasActiveTier: true, capabilities: ['ABI_ENTRY'], planId: 'entry', delinquent: false });
});

describe('sendAbiDocumentToCBP', () => {
  it('422 for Type 86: CBP suspended de minimis entries on 2025-08-29 (indefinite since 2026-06-24)', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DRAFT, entryType: '86' });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(422);
    expect(out.body).toMatchObject({ code: 'entry_type_suspended' });
    expect(abiGateway.createABIDocument).not.toHaveBeenCalled();
  });

  it('422 when the entry number uses another filer code (e.g. Sigma S7P)', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DRAFT, payload: { entryNumber: 'S7P-1234567-0' } });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(422);
    expect(out.body).toMatchObject({ code: 'ENTRY_FILER_MISMATCH' });
    expect(abiGateway.createABIDocument).not.toHaveBeenCalled();
  });

  it('422 when the org has no CBP setup yet', async () => {
    prisma.orgCbpConfig.findUnique.mockResolvedValue(null);
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.body).toMatchObject({ code: 'CBP_SETUP_INCOMPLETE' });
  });

  it('404 when not found', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue(null);
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(404);
    expect(billing.billShipment).not.toHaveBeenCalled();
  });

  it('200 idempotent when already SENT', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DRAFT, status: 'SENT' });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(200);
    expect(abiGateway.createABIDocument).not.toHaveBeenCalled();
  });

  it('400 when payload fails deep validation', async () => {
    schema.abiDocumentBodySchema.safeParse.mockReturnValue({ success: false, error: { flatten: () => ({}) } });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(400);
  });

  it('400 when MBOL is missing', async () => {
    mapper.extractDenormFromPayload.mockReturnValue({ mbolNumber: null, entryNumber: 'ENT1' });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(400);
  });

  it('200 with note when the DRAFT→SENDING claim is lost (concurrent send)', async () => {
    prisma.abiDocument.updateMany.mockResolvedValue({ count: 0 });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(200);
    expect(abiGateway.createABIDocument).not.toHaveBeenCalled();
  });

  it('200 on a successful transmit — NOT billed on send (billed on acceptance)', async () => {
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(200);
    expect(abiGateway.sendABIDocument).toHaveBeenCalled();
    expect(billing.billShipment).not.toHaveBeenCalled();
  });

  it('402 when the org has no card on file', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ canFile: false, hasActiveTier: true, capabilities: ['ABI_ENTRY'], planId: 'entry', delinquent: false });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(402);
    expect(abiGateway.sendABIDocument).not.toHaveBeenCalled();
  });

  it('502 + rollback when CC create errors — not billed', async () => {
    abiGateway.createABIDocument.mockResolvedValue({ status: 500, data: { message: 'boom' }, latencyMs: 1 });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.httpStatus).toBe(502);
    expect(billing.billShipment).not.toHaveBeenCalled();
    // rolled back to DRAFT
    expect(prisma.abiDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }),
    );
  });

  it('native gateway: sends through our engine instead of CustomsCity', async () => {
    prisma.orgCbpConfig.findUnique.mockResolvedValue({ ...APPROVED_CBP, gateway: 'NATIVE' });
    nativeEntry.transmitEntryNative.mockResolvedValue({ httpStatus: 202, body: { transmissionId: 't1', outcome: 'SENT' } });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(nativeEntry.transmitEntryNative).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADD' }));
    expect(abiGateway.createABIDocument).not.toHaveBeenCalled();
    expect(out.httpStatus).toBe(200);
  });

  it('native gateway: a rejected entry is corrected and sent again (FNA-12)', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DRAFT, status: 'REJECTED', lastTransmissionId: 't0', pendingAction: null, cbpState: 'NOT_ON_FILE' });
    prisma.orgCbpConfig.findUnique.mockResolvedValue({ ...APPROVED_CBP, gateway: 'NATIVE' });
    nativeEntry.transmitEntryNative.mockResolvedValue({ httpStatus: 202, body: { transmissionId: 't1', outcome: 'SENT' } });
    await sendAbiDocumentToCBP(ARGS);
    expect(nativeEntry.transmitEntryNative).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADD' }));
  });

  it('a CustomsCity-era rejected entry is still not re-sent', async () => {
    prisma.abiDocument.findFirst.mockResolvedValue({ ...DRAFT, status: 'REJECTED', lastTransmissionId: null, pendingAction: null, cbpState: 'NOT_ON_FILE' });
    const out = await sendAbiDocumentToCBP(ARGS);
    expect(out.body).toMatchObject({ note: 'Already in status REJECTED' });
    expect(nativeEntry.transmitEntryNative).not.toHaveBeenCalled();
  });
});

describe('isEntryEditable', () => {
  const base = { status: 'DRAFT', lastTransmissionId: null, pendingAction: null, cbpState: 'NOT_ON_FILE' };
  it.each([
    ['a draft', base, true],
    ['a native rejected entry', { ...base, status: 'REJECTED', lastTransmissionId: 't' }, true],
    ['a native entry CBP holds (to replace it)', { ...base, status: 'ACCEPTED', lastTransmissionId: 't', cbpState: 'ON_FILE' }, true],
    ['an entry waiting for CBP', { ...base, status: 'SENT', lastTransmissionId: 't', pendingAction: 'ADD' }, false],
    ['a CustomsCity-era accepted entry', { ...base, status: 'ACCEPTED' }, false],
    ['an entry deleted at CBP', { ...base, status: 'CANCELLED', lastTransmissionId: 't', cbpState: 'DELETED' }, false],
  ])('%s: %s', (_label, doc, expected) => {
    expect(isEntryEditable(doc)).toBe(expected);
  });
});
