import { Router, type Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/requireVerifiedEmail.js';
import { requireMfaEnrolled } from '../middleware/requireMfaEnrolled.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { billShipment } from '../services/shipmentBilling.js';
import { ccClient } from '../services/customscity.js';
import { ccApiLimiter } from '../middleware/rateLimiter.js';
import {
  abiDocumentBodySchema,
  createABIDocumentSchema,
  updateABIDocumentSchema,
  listABIDocumentsQuerySchema,
} from '../schemas/abiDocument.js';
import {
  mapABIDocumentToCC,
  buildSendPayload,
  canonicaliseEntryNumber,
  prefillFromFiling,
  prefillFromManifestQuery,
  extractCCErrorMessage,
  extractDenormFromPayload,
} from '../services/abiDocumentMapper.js';
import { sanitizeErrorMessage } from '../services/errorTranslator.js';
import { createAbiDocumentForOrg, sendAbiDocumentToCBP } from '../services/abiWrite.js';
import { notify } from '../services/notifications.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import logger from '../config/logger.js';
import { runSinglePoll, pollABIDocumentStatus } from '../services/abiPolling.js';

const router = Router();
router.use(authMiddleware);
// ABI Entry (7501/3461) is gated to the ISF+Entry and Complete tiers. ISF-only
// orgs get 403 feature_not_in_plan on every route here (the UI also hides it).
router.use(requireCapability(CAPABILITIES.ABI_ENTRY));

// ── Helpers ─────────────────────────────────────────────

/**
 * Extract denormalised columns from a (possibly partial) payload so they
 * can be persisted alongside the JSON blob for list filtering / search.
 */
/**
 * Extract a human-readable error message from a CC non-2xx response.
 * CC's 422 body shape: `{ errors: { "Entry: 1": { entry: [...], manifests: {...} } }, message }`.
 * CC's 500 body shape: `{ details: { code, name }, message }`.
 * Falls back to the bare HTTP status if no structured message is present.
 */
// extractCCErrorMessage + extractDenormFromPayload moved to
// ../services/abiDocumentMapper.ts (shared with the ABI write services).

/**
 * Shallow-merge top-level keys. Nested arrays/objects are replaced wholesale
 * by the incoming payload (callers who want finer merging should do it
 * client-side and POST the final shape).
 */
function mergePayload(existing: any, incoming: any): any {
  return { ...(existing ?? {}), ...(incoming ?? {}) };
}


// ── POST / — Create DRAFT locally ──────────────────────

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createABIDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const outcome = await createAbiDocumentForOrg({
    data: parsed.data,
    orgId: req.user!.orgId,
    userId: req.user!.id,
  });
  res.status(outcome.httpStatus).json(outcome.body);
});

// ── GET / — List with filters + pagination ─────────────

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = listABIDocumentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }

  const { status, mbolNumber, entryNumber, skip, take } = parsed.data;
  const where: any = { orgId: req.user!.orgId };
  if (status) where.status = status;
  if (mbolNumber) where.mbolNumber = { contains: mbolNumber, mode: 'insensitive' };
  if (entryNumber) where.entryNumber = { contains: entryNumber, mode: 'insensitive' };

  const [total, docs] = await Promise.all([
    prisma.abiDocument.count({ where }),
    prisma.abiDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  res.json({
    data: docs,
    pagination: { total, skip, take, totalPages: Math.ceil(total / take) },
  });
});

// ── GET /:id — Detail (org-scoped) ─────────────────────

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      filing: { select: { id: true, masterBol: true, filingType: true, status: true } },
      manifestQuery: { select: { id: true, bolNumber: true, status: true } },
    },
  });

  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }

  res.json({ data: doc });
});

// ── PATCH /:id — Update DRAFT ──────────────────────────

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }
  if (existing.status !== 'DRAFT') {
    res.status(400).json({ error: `Cannot edit document in status ${existing.status}` });
    return;
  }

  const parsed = updateABIDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const merged = mergePayload(existing.payload, parsed.data.payload);
  const denorm = extractDenormFromPayload(merged);

  const updated = await prisma.abiDocument.update({
    where: { id: existing.id },
    data: {
      payload: merged,
      ...denorm,
    },
  });

  res.json({ data: updated });
});

// ── DELETE /:id — Hard delete DRAFT ────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!existing) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }
  if (existing.status !== 'DRAFT') {
    res.status(400).json({ error: `Cannot delete document in status ${existing.status}` });
    return;
  }

  await prisma.abiDocument.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ── POST /:id/send — Transmit to CC ────────────────────

router.post('/:id/send', ccApiLimiter, requireVerifiedEmail, requireMfaEnrolled, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const outcome = await sendAbiDocumentToCBP({
    docId: id,
    orgId: req.user!.orgId,
    userId: req.user!.id,
    requestMeta: getRequestMeta(req),
  });
  res.status(outcome.httpStatus).json(outcome.body);
});

// ── POST /:id/poll — Manual re-poll ────────────────────

router.post('/:id/poll', ccApiLimiter, requireVerifiedEmail, requireMfaEnrolled, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }

  if (doc.status !== 'SENT' && doc.status !== 'SENDING') {
    res.status(400).json({ error: `Cannot poll document in status ${doc.status}` });
    return;
  }

  try {
    await runSinglePoll({
      docId: doc.id,
      orgId: req.user!.orgId,
      userId: req.user!.id,
      entryType: doc.entryType as '01' | '11' | '86',
      entryNumber: doc.entryNumber,
      mbolNumber: doc.mbolNumber,
    });

    const refreshed = await prisma.abiDocument.findFirst({
      where: { id: doc.id },
    });
    res.json({ data: refreshed });
  } catch (err: any) {
    logger.error({ err, docId: doc.id }, 'Manual ABI poll failed');
    res.status(502).json({ error: sanitizeErrorMessage(err.message || 'Failed to poll CBP filing system') });
  }
});

export default router;
