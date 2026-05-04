import { Router, type Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
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
} from '../services/abiDocumentMapper.js';
import { sanitizeErrorMessage } from '../services/errorTranslator.js';
import { notify } from '../services/notifications.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

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
function extractCCErrorMessage(
  body: any,
  httpStatus: number,
  step: 'create' | 'send'
): string {
  const stepLabel = step === 'create' ? 'Create document' : 'Transmit';

  // 422 with a structured `errors` map → flatten into a list.
  if (body && typeof body.errors === 'object' && body.errors !== null) {
    const flattened: string[] = [];
    for (const [entryKey, entryErrs] of Object.entries(body.errors as Record<string, any>)) {
      if (Array.isArray(entryErrs?.entry)) {
        flattened.push(...(entryErrs.entry as string[]).map((m) => `${entryKey}: ${m}`));
      }
      if (entryErrs?.manifests && typeof entryErrs.manifests === 'object') {
        for (const [manifestKey, manifestMsgs] of Object.entries(entryErrs.manifests as Record<string, any>)) {
          if (Array.isArray(manifestMsgs)) {
            flattened.push(...(manifestMsgs as string[]).map((m) => `${manifestKey}: ${m}`));
          }
        }
      }
    }
    if (flattened.length > 0) {
      return `${stepLabel} rejected (${httpStatus}): ${flattened.join('; ')}`;
    }
  }

  // Generic message field (500s, 400s without structured errors).
  if (typeof body?.message === 'string' && body.message.trim()) {
    return `${stepLabel} failed (${httpStatus}): ${body.message}`;
  }

  return `${stepLabel} failed (${httpStatus})`;
}

function extractDenormFromPayload(payload: any): {
  entryType: string;
  modeOfTransport: string;
  entryNumber: string | null;
  mbolNumber: string | null;
  hbolNumber: string | null;
  iorNumber: string | null;
  iorName: string | null;
  consigneeName: string | null;
  portOfEntry: string | null;
  destinationStateUS: string | null;
  entryDate: string | null;
  importDate: string | null;
  arrivalDate: string | null;
} {
  const p = payload ?? {};
  const firstManifest = Array.isArray(p.manifest) ? p.manifest[0] : undefined;

  // Filer-assigned entry number. Stored hyphen-stripped so the DELETE
  // endpoint's auto-normalisation matches our denorm column.
  const rawEntryNumber: string | undefined = p.entryNumber;
  const entryNumber = rawEntryNumber ? rawEntryNumber.replace(/-/g, '') : null;

  return {
    entryType: p.entryType ?? '01',
    modeOfTransport: p.modeOfTransport ?? '40',
    entryNumber,
    mbolNumber: firstManifest?.bill?.mBOL ?? null,
    hbolNumber: firstManifest?.bill?.hBOL || null,
    iorNumber: p.ior?.number ?? null,
    iorName: p.ior?.name ?? null,
    consigneeName: p.entryConsignee?.name ?? null,
    portOfEntry: p.location?.portOfEntry ?? null,
    destinationStateUS: p.location?.destinationStateUS ?? null,
    entryDate: p.dates?.entryDate ?? null,
    importDate: p.dates?.importDate ?? null,
    arrivalDate: p.dates?.arrivalDate ?? null,
  };
}

/**
 * Shallow-merge top-level keys. Nested arrays/objects are replaced wholesale
 * by the incoming payload (callers who want finer merging should do it
 * client-side and POST the final shape).
 */
function mergePayload(existing: any, incoming: any): any {
  return { ...(existing ?? {}), ...(incoming ?? {}) };
}

/**
 * Compute a YYYY-MM-DD window around "today" for the CC list call.
 * We widen by 30 days on either side so freshly-sent docs always fall
 * inside the search window regardless of CBP-assigned entryDate drift.
 */
function buildPollDateWindow(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

/**
 * Given a CC list response, find the body entry matching our local doc
 * (by entryNumber first, then MBOL fallback).
 */
function findMatchingCCBody(
  ccBody: any[] | undefined,
  entryNumber: string | null,
  mbolNumber: string | null
): any | undefined {
  if (!Array.isArray(ccBody)) return undefined;
  if (entryNumber) {
    const byEntry = ccBody.find((b: any) => b?.entryNumber === entryNumber);
    if (byEntry) return byEntry;
  }
  if (mbolNumber) {
    return ccBody.find((b: any) => {
      const manifests: any[] = Array.isArray(b?.manifest) ? b.manifest : [];
      return manifests.some((m) => m?.bill?.mBOL === mbolNumber);
    });
  }
  return undefined;
}

/**
 * Map CC-reported sub-statuses → local AbiDocument.status.
 * Returns undefined if we should leave the status as-is (still SENT).
 */
function deriveLocalStatus(
  entrySummaryStatus: string | null,
  cargoReleaseStatus: string | null
): 'ACCEPTED' | 'REJECTED' | undefined {
  const isRejected = (s: string | null) =>
    !!s && /REJECT/i.test(s);
  const isAccepted = (s: string | null) =>
    !!s && /ACCEPT/i.test(s);

  if (isRejected(entrySummaryStatus) || isRejected(cargoReleaseStatus)) {
    return 'REJECTED';
  }
  // Only flip to ACCEPTED once both sides have a positive acceptance.
  if (isAccepted(entrySummaryStatus) && isAccepted(cargoReleaseStatus)) {
    return 'ACCEPTED';
  }
  return undefined;
}

/**
 * One pass against CC's list endpoint to refresh entry/cargo-release
 * statuses for a given AbiDocument. Writes a SubmissionLog entry for the
 * call. Returns the updated record (or the original one if nothing changed).
 */
async function runSinglePoll(args: {
  docId: string;
  orgId: string;
  userId: string | null;
  entryType: '01' | '11';
  entryNumber: string | null;
  mbolNumber: string | null;
}): Promise<{ terminal: boolean }> {
  const { docId, orgId, userId, entryType, entryNumber, mbolNumber } = args;

  const { dateFrom, dateTo } = buildPollDateWindow();
  const result = await ccClient.listABIDocuments({
    dateFrom,
    dateTo,
    entryType,
    ...(entryNumber ? { entryNumber: [entryNumber] } : {}),
    ...(mbolNumber && !entryNumber ? { masterBOLNumber: [mbolNumber] } : {}),
  });

  await prisma.submissionLog.create({
    data: {
      orgId,
      userId,
      correlationId: docId,
      method: 'GET',
      url: '/api/abi/documents',
      responseStatus: result.status,
      responseBody: result.data as any,
      latencyMs: result.latencyMs,
    },
  });

  const match = findMatchingCCBody(result.data?.body as any[], entryNumber, mbolNumber);
  if (!match) {
    await prisma.abiDocument.update({
      where: { id: docId },
      data: { pollAttempts: { increment: 1 } },
    });
    return { terminal: false };
  }

  const entrySummaryStatus: string | null =
    match.entrySummaryStatus ?? match.entrySummary?.status ?? null;
  const cargoReleaseStatus: string | null =
    match.cargoReleaseStatus ?? match.cargoRelease?.status ?? null;
  const ccEntryNumber: string | null = match.entryNumber ?? null;
  const ccDocumentId: string | null = match._id ?? match.documentId ?? null;

  const nextStatus = deriveLocalStatus(entrySummaryStatus, cargoReleaseStatus);

  await prisma.abiDocument.update({
    where: { id: docId },
    data: {
      pollAttempts: { increment: 1 },
      entrySummaryStatus: entrySummaryStatus ?? undefined,
      cargoReleaseStatus: cargoReleaseStatus ?? undefined,
      ...(ccEntryNumber && !entryNumber ? { entryNumber: ccEntryNumber } : {}),
      ...(ccDocumentId ? { ccDocumentId } : {}),
      ...(nextStatus ? { status: nextStatus, respondedAt: new Date() } : {}),
    },
  });

  // Phase 3: notify on terminal ABI status. Reuses the dedupeKey to ensure
  // that a re-poll of the same accepted/rejected entry does not double-fire.
  if (nextStatus) {
    const ref = ccEntryNumber || entryNumber || mbolNumber || docId.slice(0, 8);
    await notify({
      kind:     nextStatus === 'ACCEPTED' ? 'entry_accepted' : 'entry_rejected',
      audience: { orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] },
      title:    nextStatus === 'ACCEPTED' ? 'Entry Accepted by CBP' : 'Entry Rejected by CBP',
      message:  nextStatus === 'ACCEPTED'
        ? `Entry ${ref} has been accepted by CBP.`
        : `Entry ${ref} was rejected by CBP. Review and resubmit.`,
      linkUrl:       `/abi-documents/${docId}`,
      metadata:      { entryNumber: ref, entryType, mbolNumber },
      abiDocumentId: docId,
      dedupeKey:     `abi_${docId}_${nextStatus.toLowerCase()}`,
    });
  }

  return { terminal: !!nextStatus };
}

/**
 * Fire-and-forget poller (mirrors manifestQuery.ts): 10 attempts × 3s.
 */
async function pollABIDocumentStatus(
  docId: string,
  orgId: string,
  entryType: '01' | '11',
  entryNumber: string | null,
  mbolNumber: string | null
): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const POLL_INTERVAL_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const { terminal } = await runSinglePoll({
        docId,
        orgId,
        userId: null,
        entryType,
        entryNumber,
        mbolNumber,
      });
      if (terminal) {
        logger.info({ docId, attempt }, 'ABI document reached terminal status');
        return;
      }
    } catch (err: any) {
      logger.warn({ err, docId, attempt }, 'ABI document poll attempt failed');
      if (attempt === MAX_ATTEMPTS) {
        logger.error({ docId }, 'ABI document polling exhausted without terminal status');
        return;
      }
    }
  }
}

// ── POST / — Create DRAFT locally ──────────────────────

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createABIDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { payload: providedPayload, manifestQueryId, filingId } = parsed.data;

  let initialPayload: any = providedPayload ?? {};

  // Optional pre-fill from an existing ISF Filing (same org only). Runs
  // BEFORE manifest-query prefill so a manifest query's shipment-level
  // fields (which are CBP-derived and authoritative) override the
  // user-supplied ISF data on the few overlapping keys (e.g. mBOL).
  if (filingId) {
    const linkedFiling = await prisma.filing.findFirst({
      where: { id: filingId, orgId: req.user!.orgId },
    });
    if (!linkedFiling) {
      res.status(404).json({ error: 'Linked ISF filing not found' });
      return;
    }
    const filingPrefill = prefillFromFiling(linkedFiling);
    initialPayload = { ...filingPrefill, ...initialPayload };
    // Don't lose the prefilled manifest if the user didn't send one.
    if (filingPrefill.manifest && !providedPayload?.manifest) {
      initialPayload.manifest = filingPrefill.manifest;
    }
  }

  // Optional pre-fill from a completed manifest query (same org only).
  if (manifestQueryId) {
    const mq = await prisma.manifestQuery.findFirst({
      where: { id: manifestQueryId, orgId: req.user!.orgId },
    });
    if (!mq) {
      res.status(404).json({ error: 'Manifest query not found' });
      return;
    }
    if (mq.response) {
      const prefill = prefillFromManifestQuery({ response: mq.response });
      // Merge: explicit user-supplied payload wins over prefill.
      initialPayload = { ...prefill, ...initialPayload };
      // For nested manifest array, prefer prefill shipment data unless user sent their own.
      if (prefill.manifest && !providedPayload?.manifest) {
        initialPayload.manifest = prefill.manifest;
      }
    }
  }

  const denorm = extractDenormFromPayload(initialPayload);

  try {
    const doc = await prisma.abiDocument.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        status: 'DRAFT',
        payload: initialPayload,
        filingId: filingId ?? null,
        manifestQueryId: manifestQueryId ?? null,
        ...denorm,
      },
    });
    res.status(201).json({ data: doc });
  } catch (err: any) {
    logger.error({ err }, 'Failed to create ABI document');
    res.status(500).json({ error: sanitizeErrorMessage(err.message || 'Failed to create ABI document') });
  }
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

router.post('/:id/send', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }

  // Idempotency — if already transmitted / in-flight, just return current state.
  if (doc.status === 'SENDING' || doc.status === 'SENT' || doc.status === 'ACCEPTED' || doc.status === 'REJECTED') {
    res.status(200).json({ data: doc, note: `Already in status ${doc.status}` });
    return;
  }

  if (doc.status !== 'DRAFT') {
    res.status(400).json({ error: `Cannot send document in status ${doc.status}` });
    return;
  }

  // Full payload validation (deep) before we touch CC.
  const bodyResult = abiDocumentBodySchema.safeParse(doc.payload);
  if (!bodyResult.success) {
    res.status(400).json({
      error: 'ABI document is incomplete or invalid',
      details: bodyResult.error.flatten(),
    });
    return;
  }

  // Re-derive denorm columns now that the body is valid — gives us
  // mbolNumber / entryNumber guarantees for the send payload.
  const denorm = extractDenormFromPayload(doc.payload);
  if (!denorm.mbolNumber) {
    res.status(400).json({ error: 'ABI document payload is missing manifest MBOL number' });
    return;
  }
  if (!denorm.entryNumber) {
    res.status(400).json({ error: 'ABI document payload is missing filer-assigned entry number' });
    return;
  }

  // Stamp SENDING + sentAt up-front so concurrent calls short-circuit.
  const sendingDoc = await prisma.abiDocument.update({
    where: { id: doc.id },
    data: {
      status: 'SENDING',
      sentAt: new Date(),
      lastError: null,
      ...denorm,
    },
  });

  try {
    // Step 1 — POST /api/abi/documents
    const createPayload = mapABIDocumentToCC(sendingDoc);
    let createResult = await ccClient.createABIDocument(createPayload);

    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        correlationId: sendingDoc.id,
        method: 'POST',
        url: '/api/abi/documents',
        requestPayload: createPayload as any,
        responseStatus: createResult.status,
        responseBody: createResult.data as any,
        latencyMs: createResult.latencyMs,
      },
    });

    // Auto-recover from "already exists" — CC keys uniqueness on
    // (Masters, Houses) and rejects re-creates with a 500. If a previous
    // transmit attempt left a stale doc on CC's side (e.g. our send call
    // failed but their create succeeded), we delete the stale entry by
    // entry number, then retry create. Idempotent transmit semantics.
    const isDuplicate =
      createResult.status === 500 &&
      /already exist/i.test(String(createResult.data?.message ?? ''));

    if (isDuplicate && sendingDoc.entryNumber) {
      logger.info(
        { docId: sendingDoc.id, entryNumber: sendingDoc.entryNumber },
        'CC reports duplicate on create — attempting cleanup-then-retry',
      );

      const canonicalEntry = canonicaliseEntryNumber(sendingDoc.entryNumber);
      const deleteResult = await ccClient
        .deleteABIDocument({ entryNumber: canonicalEntry })
        .catch((err: any) => ({
          status: 0,
          data: { error: err?.message ?? 'delete failed' },
          latencyMs: 0,
        }));

      await prisma.submissionLog.create({
        data: {
          orgId: req.user!.orgId,
          userId: req.user!.id,
          correlationId: sendingDoc.id,
          method: 'DELETE',
          url: '/api/abi/documents',
          requestPayload: { 'entry-number': canonicalEntry } as any,
          responseStatus: deleteResult.status,
          responseBody: deleteResult.data as any,
          latencyMs: deleteResult.latencyMs ?? 0,
        },
      });

      if (deleteResult.status >= 200 && deleteResult.status < 300) {
        createResult = await ccClient.createABIDocument(createPayload);

        await prisma.submissionLog.create({
          data: {
            orgId: req.user!.orgId,
            userId: req.user!.id,
            correlationId: sendingDoc.id,
            method: 'POST',
            url: '/api/abi/documents (retry after duplicate cleanup)',
            requestPayload: createPayload as any,
            responseStatus: createResult.status,
            responseBody: createResult.data as any,
            latencyMs: createResult.latencyMs,
          },
        });
      }
    }

    // CC returns 2xx only when the document was actually accepted — any
    // 4xx/5xx must surface to the user so we don't silently mark a doc as
    // SENT when CC has rejected it (real bug seen on 2026-04-24: 422 from
    // create + 500 from send was reported as success).
    if (createResult.status < 200 || createResult.status >= 300) {
      throw new Error(extractCCErrorMessage(createResult.data, createResult.status, 'create'));
    }

    // Persist the CC document handle if one came back. entryNumber is
    // filer-assigned (already on the doc), not CBP-assigned, so we only
    // update ccDocumentId here.
    const ccDocumentId: string | null =
      createResult.data?._id ?? createResult.data?.documentId ?? null;

    const postCreateDoc = await prisma.abiDocument.update({
      where: { id: sendingDoc.id },
      data: {
        ...(ccDocumentId ? { ccDocumentId } : {}),
      },
    });

    // Step 2 — POST /api/abi/send
    const sendPayload = buildSendPayload(postCreateDoc, 'add');
    const sendResult = await ccClient.sendABIDocument(sendPayload);

    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        correlationId: postCreateDoc.id,
        method: 'POST',
        url: '/api/abi/send',
        requestPayload: sendPayload as any,
        responseStatus: sendResult.status,
        responseBody: sendResult.data as any,
        latencyMs: sendResult.latencyMs,
      },
    });

    if (sendResult.status < 200 || sendResult.status >= 300) {
      throw new Error(extractCCErrorMessage(sendResult.data, sendResult.status, 'send'));
    }

    const sentDoc = await prisma.abiDocument.update({
      where: { id: postCreateDoc.id },
      data: { status: 'SENT' },
    });

    // Phase 3: actor-only notification confirming the entry left for CBP.
    notify({
      kind:     'entry_submitted',
      audience: { orgId: req.user!.orgId, userIds: [req.user!.id] },
      title:    'Entry Transmitted',
      message:  `Entry ${sentDoc.entryNumber || sentDoc.mbolNumber || sentDoc.id.slice(0, 8)} sent to CBP. Awaiting acceptance.`,
      linkUrl:  `/abi-documents/${sentDoc.id}`,
      metadata: {
        entryNumber: sentDoc.entryNumber,
        entryType:   sentDoc.entryType,
        mbolNumber:  sentDoc.mbolNumber,
      },
      abiDocumentId: sentDoc.id,
    }).catch(() => {});

    // Fire-and-forget polling.
    pollABIDocumentStatus(
      sentDoc.id,
      sentDoc.orgId,
      sentDoc.entryType as '01' | '11',
      sentDoc.entryNumber,
      sentDoc.mbolNumber
    ).catch((err) => {
      logger.error({ err, docId: sentDoc.id }, 'Background ABI poll failed');
    });

    res.status(200).json({ data: sentDoc });
  } catch (err: any) {
    logger.error({ err, docId: sendingDoc.id }, 'Failed to transmit ABI document');

    const rawMessage: string =
      err?.message || 'Failed to transmit ABI document';
    const translated = sanitizeErrorMessage(rawMessage);

    // Rollback to DRAFT so the user can retry after fixing whatever CC complained about.
    await prisma.abiDocument.update({
      where: { id: sendingDoc.id },
      data: {
        status: 'DRAFT',
        lastError: translated,
      },
    });

    res.status(502).json({ error: translated });
  }
});

// ── POST /:id/poll — Manual re-poll ────────────────────

router.post('/:id/poll', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
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
      entryType: doc.entryType as '01' | '11',
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
