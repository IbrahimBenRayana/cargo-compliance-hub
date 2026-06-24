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
  },
  abiGateway: { createABIDocument: vi.fn(), sendABIDocument: vi.fn(), deleteABIDocument: vi.fn() },
  mapper: {
    mapABIDocumentToCC: vi.fn(() => ({})),
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
vi.mock('../abi/gateway.js', () => ({ abiGateway }));
vi.mock('../abiDocumentMapper.js', () => mapper);
vi.mock('../../schemas/abiDocument.js', () => schema);
vi.mock('../shipmentBilling.js', () => billing);
vi.mock('../entitlements.js', () => entitlements);
vi.mock('../errorTranslator.js', () => ({ sanitizeErrorMessage: (s: string) => s }));
vi.mock('../auditLog.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../notifications.js', () => ({ notify: vi.fn(() => Promise.resolve()) }));
vi.mock('../abiPolling.js', () => ({ pollABIDocumentStatus: vi.fn(() => Promise.resolve()) }));

import { sendAbiDocumentToCBP } from '../abiWrite.js';

const ARGS = { docId: 'd1', orgId: 'o1', userId: 'u1' };
const DRAFT = { id: 'd1', orgId: 'o1', status: 'DRAFT', payload: {}, filingId: null, entryType: '01', entryNumber: 'ENT1', mbolNumber: 'MBOL1' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.abiDocument.findFirst.mockResolvedValue(DRAFT);
  prisma.abiDocument.updateMany.mockResolvedValue({ count: 1 });
  prisma.abiDocument.findUniqueOrThrow.mockResolvedValue(DRAFT);
  prisma.abiDocument.findUnique.mockResolvedValue(DRAFT);
  prisma.abiDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...DRAFT, ...data }));
  prisma.submissionLog.create.mockResolvedValue({});
  schema.abiDocumentBodySchema.safeParse.mockReturnValue({ success: true });
  mapper.extractDenormFromPayload.mockReturnValue({ mbolNumber: 'MBOL1', entryNumber: 'ENT1', entryType: '01', modeOfTransport: '40' });
  abiGateway.createABIDocument.mockResolvedValue({ status: 201, data: { _id: 'cc1' }, latencyMs: 1 });
  abiGateway.sendABIDocument.mockResolvedValue({ status: 200, data: {}, latencyMs: 1 });
  entitlements.getOrgEntitlements.mockResolvedValue({ canFile: true, hasActiveTier: true, capabilities: ['ABI_ENTRY'], planId: 'entry', delinquent: false });
});

describe('sendAbiDocumentToCBP', () => {
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
});
