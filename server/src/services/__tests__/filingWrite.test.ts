/**
 * Locks the branch behavior of submitFilingToCBP — the production-critical
 * filing path that was extracted from routes/filings.ts. The CBP gateway and
 * all side-effect deps are mocked; we assert the (httpStatus, body) outcome and
 * that billing only fires on a successful submit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock every dependency of the service ──────────────────
// Shared mock objects go through vi.hoisted so they exist when the hoisted
// vi.mock factories run (vi.mock is lifted above normal const declarations).
const { prisma, abiGateway, validation, billing, entitlements } = vi.hoisted(() => ({
  prisma: {
    filing: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    submissionLog: { create: vi.fn() },
    filingStatusHistory: { create: vi.fn() },
  },
  abiGateway: { createDocument: vi.fn(), sendDocument: vi.fn() },
  validation: { validateFiling: vi.fn(), isValidTransition: vi.fn(), getAllowedTransitions: vi.fn(() => []) },
  billing: { billShipmentForFiling: vi.fn() },
  entitlements: { getOrgEntitlements: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../abi/gateway.js', () => ({ abiGateway }));
vi.mock('../validation.js', () => validation);
vi.mock('../shipmentBilling.js', () => billing);
vi.mock('../entitlements.js', () => entitlements);
vi.mock('../customscity.js', () => ({ mapFilingToCCPayload: vi.fn(() => ({})) }));
vi.mock('../compliance/scoreSnapshot.js', () => ({ recordScoreSnapshot: vi.fn(), triggerForStatus: vi.fn(() => 'accepted') }));
vi.mock('../errorTranslator.js', () => ({ translateValidationErrors: vi.fn(() => []) }));
vi.mock('../auditLog.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../notifications.js', () => ({ notifyFilingSubmitted: vi.fn(), notifyFilingRejected: vi.fn(), notifyApiError: vi.fn() }));

import { submitFilingToCBP } from '../filingWrite.js';

const ARGS = { filingId: 'f1', orgId: 'o1', userId: 'u1' };
const DRAFT = { id: 'f1', orgId: 'o1', status: 'draft', filingType: 'ISF-10', masterBol: 'MBOL1', houseBol: 'HBOL1' };

beforeEach(() => {
  vi.clearAllMocks();
  // Happy defaults — individual tests override.
  prisma.filing.findFirst.mockResolvedValue(DRAFT);
  prisma.filing.update.mockResolvedValue({ ...DRAFT, status: 'submitted' });
  prisma.filing.findUnique.mockResolvedValue({ ...DRAFT, status: 'rejected' });
  prisma.submissionLog.create.mockResolvedValue({});
  prisma.filingStatusHistory.create.mockResolvedValue({});
  validation.isValidTransition.mockReturnValue(true);
  validation.validateFiling.mockReturnValue({ valid: true, errors: [], score: 100 });
  entitlements.getOrgEntitlements.mockResolvedValue({ hasActiveTier: true, capabilities: ['ISF_FILING'], planId: 'isf' });
  // No `send: 'add'` → ISF-10 takes the separate-send path by default.
  abiGateway.createDocument.mockResolvedValue({ persisted: true, status: 201, data: { _id: 'cc1' }, latencyMs: 1 });
  abiGateway.sendDocument.mockResolvedValue({ data: {}, status: 200, latencyMs: 1 });
});

describe('submitFilingToCBP', () => {
  it('404 when the filing is not found', async () => {
    prisma.filing.findFirst.mockResolvedValue(null);
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(404);
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it('400 when the status transition is invalid', async () => {
    validation.isValidTransition.mockReturnValue(false);
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(400);
  });

  it('400 when local validation fails', async () => {
    validation.validateFiling.mockReturnValue({ valid: false, errors: ['bad'], score: 10 });
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(400);
  });

  it('402 when the org has no active tier', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({ hasActiveTier: false, capabilities: [], planId: null });
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(402);
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it('422 when CC returns validation errors (not persisted) — not billed', async () => {
    abiGateway.createDocument.mockResolvedValue({ persisted: false, status: 201, validationErrors: [{ field: 'x', message: 'y' }], data: {}, latencyMs: 1 });
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(422);
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it('400 when CC returns a hard error (status >= 400) — not billed', async () => {
    abiGateway.createDocument.mockResolvedValue({ persisted: true, status: 500, data: { err: 1 }, latencyMs: 1 });
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(400);
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });

  it('200 on a successful ISF-5 submit (sent during create) — bills the shipment', async () => {
    prisma.filing.findFirst.mockResolvedValue({ ...DRAFT, filingType: 'ISF-5' });
    abiGateway.createDocument.mockResolvedValue({ persisted: true, status: 201, data: {}, latencyMs: 1 });
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(200);
    expect(abiGateway.sendDocument).not.toHaveBeenCalled(); // ISF-5 = one-step
    expect(billing.billShipmentForFiling).toHaveBeenCalledWith('f1', 'o1');
  });

  it('200 on a successful ISF-10 submit (separate send) — bills the shipment', async () => {
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(200);
    expect(abiGateway.sendDocument).toHaveBeenCalled();
    expect(billing.billShipmentForFiling).toHaveBeenCalledWith('f1', 'o1');
  });

  it('502 when the gateway throws — logs and does not bill', async () => {
    abiGateway.createDocument.mockRejectedValue(new Error('network down'));
    const out = await submitFilingToCBP(ARGS);
    expect(out.httpStatus).toBe(502);
    expect(billing.billShipmentForFiling).not.toHaveBeenCalled();
  });
});
