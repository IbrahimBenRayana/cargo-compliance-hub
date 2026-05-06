/**
 * Duty Calculation routes.
 *
 *   POST /api/v1/duty-calculation        → CC `/api/duty-calculation-tool`
 *   POST /api/v1/duty-calculation/ai     → CC `/api/duty-calculation-tool-ai`
 *
 * Both wrap the existing CC client methods, validate input via Zod,
 * normalise HTS values (strip dots), log every CC call to SubmissionLog
 * for the audit trail, and surface CC errors via `extractCCErrorMessage`
 * so the user sees the actual problem (not just "failed").
 *
 * No DB persistence at this layer — calculations are stateless. Phase 2
 * may add a `dutyEstimate Json?` column on AbiDocument if customers ask
 * for permanent stamping.
 */
import { Router, type Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { ccClient } from '../services/customscity.js';
import { ccApiLimiter } from '../middleware/rateLimiter.js';
import {
  dutyCalcStandardSchema,
  dutyCalcAISchema,
  normaliseHts,
} from '../schemas/dutyCalculation.js';
import { sanitizeErrorMessage } from '../services/errorTranslator.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

/** Pull a human message out of CC's error responses (matches abiDocuments helper). */
function extractCCErrorMessage(body: any, httpStatus: number, label: string): string {
  if (typeof body?.message === 'string' && body.message.trim()) {
    return `${label} failed (${httpStatus}): ${body.message}`;
  }
  if (typeof body?.error === 'string' && body.error.trim()) {
    return `${label} failed (${httpStatus}): ${body.error}`;
  }
  return `${label} failed (${httpStatus})`;
}

// ── POST / — standard calculator (HTS required) ─────────────────

router.post('/', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = dutyCalcStandardSchema.safeParse(req.body);
  if (!parsed.success) {
    // `flatten()` collapses nested array paths to their top-level key, so
    // `items[0].hts` errors all show up under `items` — useful for a one-line
    // summary but unable to drive per-field UI. Ship `issues` (the raw Zod
    // array of { path, message }) so the client can map errors back to
    // specific item rows + fields.
    res.status(400).json({
      error:   'Validation failed',
      details: parsed.error.flatten(),
      issues:  parsed.error.issues,
    });
    return;
  }

  // Normalise HTS values before sending to CC.
  const ccPayload = {
    ...parsed.data,
    items: parsed.data.items.map(item => ({
      ...item,
      hts: normaliseHts(item.hts),
    })),
  };

  const startedAt = Date.now();
  try {
    const result = await ccClient.calculateDuty(ccPayload as any);

    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/duty-calculation-tool',
        requestPayload: ccPayload as any,
        responseStatus: result.status,
        responseBody: result.data as any,
        latencyMs: result.latencyMs,
      },
    });

    if (result.status < 200 || result.status >= 300) {
      const msg = extractCCErrorMessage(result.data, result.status, 'Duty calculation');
      res.status(502).json({ error: sanitizeErrorMessage(msg) });
      return;
    }

    res.json({ data: result.data });
  } catch (err: any) {
    logger.error({ err }, 'Duty calculation failed');
    const latencyMs = Date.now() - startedAt;
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/duty-calculation-tool',
        requestPayload: ccPayload as any,
        responseStatus: 0,
        responseBody: { error: err?.message ?? 'Unknown' } as any,
        latencyMs,
        errorMessage: err?.message ?? 'Unknown',
      },
    }).catch(() => {/* swallow secondary failure */});
    res.status(502).json({ error: sanitizeErrorMessage(err?.message ?? 'Duty calculation failed') });
  }
});

// ── POST /ai — AI-assisted calculator (description only) ────────

router.post('/ai', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = dutyCalcAISchema.safeParse(req.body);
  if (!parsed.success) {
    // `flatten()` collapses nested array paths to their top-level key, so
    // `items[0].hts` errors all show up under `items` — useful for a one-line
    // summary but unable to drive per-field UI. Ship `issues` (the raw Zod
    // array of { path, message }) so the client can map errors back to
    // specific item rows + fields.
    res.status(400).json({
      error:   'Validation failed',
      details: parsed.error.flatten(),
      issues:  parsed.error.issues,
    });
    return;
  }

  // For AI mode, normalise HTS only when present (it's optional — AI fills it in).
  const ccPayload = {
    ...parsed.data,
    items: parsed.data.items.map(item => ({
      ...item,
      hts: item.hts ? normaliseHts(item.hts) : item.hts,
    })),
  };

  const startedAt = Date.now();
  try {
    const result = await ccClient.calculateDutyAI(ccPayload as any);

    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/duty-calculation-tool-ai',
        requestPayload: ccPayload as any,
        responseStatus: result.status,
        responseBody: result.data as any,
        latencyMs: result.latencyMs,
      },
    });

    if (result.status < 200 || result.status >= 300) {
      const msg = extractCCErrorMessage(result.data, result.status, 'AI duty calculation');
      res.status(502).json({ error: sanitizeErrorMessage(msg) });
      return;
    }

    res.json({ data: result.data });
  } catch (err: any) {
    logger.error({ err }, 'AI duty calculation failed');
    const latencyMs = Date.now() - startedAt;
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/duty-calculation-tool-ai',
        requestPayload: ccPayload as any,
        responseStatus: 0,
        responseBody: { error: err?.message ?? 'Unknown' } as any,
        latencyMs,
        errorMessage: err?.message ?? 'Unknown',
      },
    }).catch(() => {/* swallow secondary failure */});
    res.status(502).json({ error: sanitizeErrorMessage(err?.message ?? 'AI duty calculation failed') });
  }
});

export default router;
