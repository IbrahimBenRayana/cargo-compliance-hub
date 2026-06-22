/**
 * Public API — /api/public/v1
 *
 * The customer-facing, API-key-authenticated surface for brokers / 3PLs / ERP
 * integrations. This is the foundation slice (Plan B, Phase 1): authentication
 * + READ endpoints (status polling) that reuse the same data the app UI sees,
 * scoped to the API key's org and gated by the org's tier capabilities.
 *
 * Write endpoints (create/submit ISF + Entry), XML content-negotiation, and
 * webhooks are the next increment — they require extracting the create/submit
 * logic from the route handlers into reusable services first.
 */
import express, { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { apiKeyAuth, requireScope, ApiRequest } from '../middleware/apiKeyAuth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { xmlContentNegotiation } from '../middleware/xmlContent.js';
import { CAPABILITIES } from '../config/plans.js';
import { createFilingSchema } from '../schemas/filing.js';
import { createFilingForOrg, submitFilingToCBP } from '../services/filingWrite.js';
import { createABIDocumentSchema } from '../schemas/abiDocument.js';
import { createAbiDocumentForOrg, sendAbiDocumentToCBP } from '../services/abiWrite.js';

const router = Router();
// XML content-negotiation (Plan B Phase 1): parse XML request bodies and emit
// XML responses when the client sends `Accept: application/xml`. JSON stays the
// default. Mounted first so even auth/limiter errors honor the negotiated type.
router.use(express.text({ type: ['application/xml', 'text/xml', 'application/*+xml'], limit: '1mb' }));
router.use(xmlContentNegotiation);
router.use(generalLimiter);
router.use(apiKeyAuth);

function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(Math.floor(n), 200);
}

// GET /ping — auth check + what this key/org can do.
router.get('/ping', (req: ApiRequest, res: Response): void => {
  const ctx = req.apiContext!;
  res.json({
    ok: true,
    orgId: ctx.orgId,
    plan: ctx.planId,
    capabilities: ctx.capabilities,
    scopes: ctx.scopes,
  });
});

// GET /shipments — list ISF filings (the shipment record).
router.get('/shipments', requireScope('filings:read'), async (req: ApiRequest, res: Response): Promise<void> => {
  const where: { orgId: string; status?: string } = { orgId: req.apiContext!.orgId };
  if (typeof req.query.status === 'string') where.status = req.query.status;
  const data = await prisma.filing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: clampLimit(req.query.limit),
    select: {
      id: true, filingType: true, status: true, masterBol: true, houseBol: true,
      ccFilingId: true, submittedAt: true, createdAt: true, updatedAt: true,
    },
  });
  res.json({ data });
});

// POST /shipments — create an ISF draft (ISF-10 / ISF-5).
router.post('/shipments', requireScope('filings:write'), async (req: ApiRequest, res: Response): Promise<void> => {
  try {
    const data = createFilingSchema.parse(req.body);
    const filing = await createFilingForOrg({
      data,
      orgId: req.apiContext!.orgId,
      userId: req.apiContext!.actorUserId,
    });
    res.status(201).json({ data: filing });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    throw err;
  }
});

// POST /shipments/:id/submit — submit a filing to CBP. Billed per shipment;
// requires an active tier (the service enforces the ISF_FILING capability).
router.post('/shipments/:id/submit', requireScope('filings:write'), async (req: ApiRequest, res: Response): Promise<void> => {
  const outcome = await submitFilingToCBP({
    filingId: String(req.params.id),
    orgId: req.apiContext!.orgId,
    userId: req.apiContext!.actorUserId,
  });
  res.status(outcome.httpStatus).json(outcome.body);
});

// GET /shipments/:id — one filing.
router.get('/shipments/:id', requireScope('filings:read'), async (req: ApiRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: String(req.params.id), orgId: req.apiContext!.orgId },
  });
  if (!filing) {
    res.status(404).json({ error: 'Filing not found.' });
    return;
  }
  res.json({ data: filing });
});

// POST /entries — create a DRAFT ABI Entry document (requires the ABI_ENTRY capability).
router.post('/entries', requireScope('entries:write'), async (req: ApiRequest, res: Response): Promise<void> => {
  if (!req.apiContext!.capabilities.includes(CAPABILITIES.ABI_ENTRY)) {
    res.status(403).json({ error: "ABI Entry isn't included in your plan.", code: 'feature_not_in_plan' });
    return;
  }
  const parsed = createABIDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const outcome = await createAbiDocumentForOrg({
    data: parsed.data,
    orgId: req.apiContext!.orgId,
    userId: req.apiContext!.actorUserId,
  });
  res.status(outcome.httpStatus).json(outcome.body);
});

// POST /entries/:id/send — transmit an ABI Entry to CBP. Bills the shipment on
// success (anchored to the linked ISF filing when present, so an ISF+Entry on
// the same shipment bills once).
router.post('/entries/:id/send', requireScope('entries:write'), async (req: ApiRequest, res: Response): Promise<void> => {
  if (!req.apiContext!.capabilities.includes(CAPABILITIES.ABI_ENTRY)) {
    res.status(403).json({ error: "ABI Entry isn't included in your plan.", code: 'feature_not_in_plan' });
    return;
  }
  const outcome = await sendAbiDocumentToCBP({
    docId: String(req.params.id),
    orgId: req.apiContext!.orgId,
    userId: req.apiContext!.actorUserId,
  });
  res.status(outcome.httpStatus).json(outcome.body);
});

// GET /entries — list ABI Entry documents (requires the ABI_ENTRY capability).
router.get('/entries', requireScope('entries:read'), async (req: ApiRequest, res: Response): Promise<void> => {
  if (!req.apiContext!.capabilities.includes(CAPABILITIES.ABI_ENTRY)) {
    res.status(403).json({ error: "ABI Entry isn't included in your plan.", code: 'feature_not_in_plan' });
    return;
  }
  const data = await prisma.abiDocument.findMany({
    where: { orgId: req.apiContext!.orgId },
    orderBy: { createdAt: 'desc' },
    take: clampLimit(req.query.limit),
    select: {
      id: true, status: true, entryType: true, entryNumber: true, mbolNumber: true,
      sentAt: true, createdAt: true, updatedAt: true,
    },
  });
  res.json({ data });
});

// GET /entries/:id — one ABI Entry document.
router.get('/entries/:id', requireScope('entries:read'), async (req: ApiRequest, res: Response): Promise<void> => {
  if (!req.apiContext!.capabilities.includes(CAPABILITIES.ABI_ENTRY)) {
    res.status(403).json({ error: "ABI Entry isn't included in your plan.", code: 'feature_not_in_plan' });
    return;
  }
  const doc = await prisma.abiDocument.findFirst({
    where: { id: String(req.params.id), orgId: req.apiContext!.orgId },
  });
  if (!doc) {
    res.status(404).json({ error: 'Entry not found.' });
    return;
  }
  res.json({ data: doc });
});

export default router;
