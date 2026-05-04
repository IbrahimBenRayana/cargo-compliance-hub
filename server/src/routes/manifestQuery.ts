import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { ccClient, CCManifestQueryPayload } from '../services/customscity.js';
import { ccApiLimiter } from '../middleware/rateLimiter.js';
import { notify } from '../services/notifications.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * Decide whether a CC manifest-query response is terminal (no more polling
 * needed). CC returns `response` as either:
 *   - an array of CCManifestResponseItem (multi-result success), or
 *   - a single object containing carrierCode / houses[] / errorMessage
 *     fields (single-BOL queries, including "122-BILL NBR NOT ON FILE"),
 *     or
 *   - undefined / empty while still computing.
 *
 * The previous `.length > 0` check only handled the array case, so single-
 * object responses (success OR error) polled to timeout. This treats any
 * populated response — including ones whose only payload is an
 * `errorMessage` — as complete.
 */
function isManifestQueryComplete(body: any): boolean {
  const response = body?.data?.response;
  if (!response) return false;
  if (Array.isArray(response)) return response.length > 0;
  if (typeof response === 'object') {
    const hasMeaningfulField =
      Boolean(response.carrierCode) ||
      Boolean(response.errorMessage) ||
      Boolean(response.transmissionDate) ||
      Boolean(response.entryNumber) ||
      (Array.isArray(response.houses) && response.houses.length > 0) ||
      (Array.isArray(response.statusMsg) && response.statusMsg.length > 0);
    return hasMeaningfulField;
  }
  return false;
}
router.use(authMiddleware);

// ── Zod Schemas ──────────────────────────────────────────

const createSchema = z.object({
  bolNumber: z.string().min(1).max(100).transform(s => s.trim().toUpperCase()),
  bolType: z.enum(['BOLNUMBER', 'AWBNUMBER']).default('BOLNUMBER'),
  houseBOLNumber: z.string().nullable().optional().default(null),
  limitOutputOption: z.enum(['1', '2', '3']).default('2'),
  requestRelatedBOL: z.boolean().default(false),
  requestBOLAndEntryInformation: z.boolean().default(false),
  filingId: z.string().uuid().optional(),
});

// ── POST / — Create manifest query ──────────────────────

router.post('/', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { bolNumber, bolType, houseBOLNumber, limitOutputOption, requestRelatedBOL, requestBOLAndEntryInformation, filingId } = parsed.data;

  // Build CC payload
  const ccPayload: CCManifestQueryPayload = {
    type: bolType,
    masterBOLNumber: bolType === 'BOLNUMBER' ? bolNumber : null,
    houseBOLNumber: houseBOLNumber || null,
    limitOutputOption,
    requestRelatedBOL,
    requestBOLAndEntryInformation,
  };

  // If bolType is AWBNUMBER, swap the fields
  if (bolType === 'AWBNUMBER') {
    ccPayload.masterBOLNumber = bolNumber;
  }

  try {
    // Call CC to create the query
    const ccResult = await ccClient.createManifestQuery(ccPayload);

    // Log the CC API call
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        filingId: filingId || null,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/manifest-query',
        requestPayload: ccPayload as any,
        responseStatus: ccResult.status,
        responseBody: ccResult.data as any,
        latencyMs: ccResult.latencyMs,
      },
    });

    const ccRequestId = ccResult.data?._id;
    if (!ccRequestId) {
      res.status(502).json({ error: 'CustomsCity did not return a request ID' });
      return;
    }

    // Create our ManifestQuery record
    const query = await prisma.manifestQuery.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        bolNumber,
        bolType,
        ccRequestId,
        status: 'pending',
        filingId: filingId || null,
      },
    });

    // Kick off background polling (fire-and-forget)
    pollManifestQueryResult(query.id, ccRequestId, req.user!.orgId).catch(err => {
      logger.error({ err, queryId: query.id }, 'Background manifest query poll failed');
    });

    res.status(201).json({
      data: {
        id: query.id,
        ccRequestId,
        status: query.status,
        bolNumber: query.bolNumber,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to create manifest query');
    res.status(502).json({ error: err.message || 'Failed to create manifest query at CustomsCity' });
  }
});

// ── Background polling function ─────────────────────────

async function pollManifestQueryResult(queryId: string, ccRequestId: string, orgId: string): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const POLL_INTERVAL_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Wait before polling (except first attempt — give CC a moment)
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const result = await ccClient.getManifestQueryById(ccRequestId);

      // Log each poll attempt
      await prisma.submissionLog.create({
        data: {
          orgId,
          userId: null,
          correlationId: queryId,
          method: 'GET',
          url: `/api/ManifestQueryByID/${ccRequestId}`,
          responseStatus: result.status,
          responseBody: result.data as any,
          latencyMs: result.latencyMs,
        },
      });

      // Check if we got actual response data — handles both array and
      // object response shapes (CC varies; see isManifestQueryComplete).
      const hasData = isManifestQueryComplete(result.data);

      await prisma.manifestQuery.update({
        where: { id: queryId },
        data: { pollAttempts: attempt },
      });

      if (hasData) {
        const updated = await prisma.manifestQuery.update({
          where: { id: queryId },
          data: {
            status: 'completed',
            response: result.data as any,
            completedAt: new Date(),
          },
          select: { userId: true, bolNumber: true },
        });
        logger.info({ queryId, attempt }, 'Manifest query completed');
        // Phase 3: notify the actor only — manifest queries are personal lookups.
        await notify({
          kind:     'manifest_query_complete',
          audience: { orgId, userIds: [updated.userId] },
          title:    'Manifest Query Ready',
          message:  `Results for ${updated.bolNumber} are available.`,
          linkUrl:  `/manifest-query?id=${queryId}`,
          metadata: { bolNumber: updated.bolNumber, queryId },
        });
        return;
      }
    } catch (err: any) {
      logger.warn({ err, queryId, attempt }, 'Manifest query poll attempt failed');

      if (attempt === MAX_ATTEMPTS) {
        const updated = await prisma.manifestQuery.update({
          where: { id: queryId },
          data: {
            status: 'failed',
            errorMessage: err.message || 'All poll attempts failed',
          },
          select: { userId: true, bolNumber: true },
        });
        await notify({
          kind:     'manifest_query_failed',
          audience: { orgId, userIds: [updated.userId] },
          title:    'Manifest Query Failed',
          message:  `Couldn't fetch results for ${updated.bolNumber}: ${err.message || 'all retries exhausted'}.`,
          linkUrl:  `/manifest-query?id=${queryId}`,
          metadata: { bolNumber: updated.bolNumber, queryId, error: err.message ?? null },
        });
        return;
      }
    }
  }

  // Timeout — all attempts exhausted without data
  const timedOut = await prisma.manifestQuery.update({
    where: { id: queryId },
    data: {
      status: 'timeout',
      errorMessage: `No response after ${MAX_ATTEMPTS} poll attempts (${MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s)`,
    },
    select: { userId: true, bolNumber: true },
  });
  await notify({
    kind:     'manifest_query_failed',
    audience: { orgId, userIds: [timedOut.userId] },
    title:    'Manifest Query Timed Out',
    message:  `No CBP response for ${timedOut.bolNumber} after ${MAX_ATTEMPTS} attempts. Try again later.`,
    linkUrl:  `/manifest-query?id=${queryId}`,
    metadata: { bolNumber: timedOut.bolNumber, queryId, reason: 'timeout' },
  });
}

// ── GET / — List manifest queries ───────────────────────

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const bolSearch = req.query.bolNumber ? String(req.query.bolNumber).trim() : undefined;
  const statusFilter = req.query.status ? String(req.query.status) : undefined;

  const where: any = { orgId: req.user!.orgId };
  if (bolSearch) {
    where.bolNumber = { contains: bolSearch, mode: 'insensitive' };
  }
  if (statusFilter && ['pending', 'completed', 'failed', 'timeout'].includes(statusFilter)) {
    where.status = statusFilter;
  }

  const [total, queries] = await Promise.all([
    prisma.manifestQuery.count({ where }),
    prisma.manifestQuery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        filing: { select: { id: true, masterBol: true, filingType: true, status: true } },
      },
    }),
  ]);

  res.json({
    data: queries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /:id — Get single manifest query ────────────────

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const query = await prisma.manifestQuery.findFirst({
    where: { id, orgId: req.user!.orgId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      filing: { select: { id: true, masterBol: true, filingType: true, status: true } },
    },
  });

  if (!query) {
    res.status(404).json({ error: 'Manifest query not found' });
    return;
  }

  res.json({ data: query });
});

// ── POST /:id/poll — Manual re-poll ─────────────────────

router.post('/:id/poll', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const query = await prisma.manifestQuery.findFirst({
    where: { id, orgId: req.user!.orgId },
  });

  if (!query) {
    res.status(404).json({ error: 'Manifest query not found' });
    return;
  }

  if (!query.ccRequestId) {
    res.status(400).json({ error: 'No CC request ID to poll' });
    return;
  }

  try {
    const result = await ccClient.getManifestQueryById(query.ccRequestId);

    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        correlationId: query.id,
        method: 'GET',
        url: `/api/ManifestQueryByID/${query.ccRequestId}`,
        responseStatus: result.status,
        responseBody: result.data as any,
        latencyMs: result.latencyMs,
      },
    });

    const hasData = isManifestQueryComplete(result.data);

    const updated = await prisma.manifestQuery.update({
      where: { id: query.id },
      data: {
        pollAttempts: { increment: 1 },
        ...(hasData ? {
          status: 'completed',
          response: result.data as any,
          completedAt: new Date(),
        } : {}),
      },
    });

    res.json({ data: updated });
  } catch (err: any) {
    logger.error({ err, queryId: query.id }, 'Manual manifest query poll failed');
    res.status(502).json({ error: err.message || 'Failed to poll CustomsCity' });
  }
});

export default router;
