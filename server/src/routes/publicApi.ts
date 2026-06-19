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
import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { apiKeyAuth, requireScope, ApiRequest } from '../middleware/apiKeyAuth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { CAPABILITIES } from '../config/plans.js';

const router = Router();
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
