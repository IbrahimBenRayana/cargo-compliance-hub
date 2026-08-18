import { Router, type Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireVerifiedEmail } from '../middleware/requireVerifiedEmail.js';
import { requireMfaEnrolled } from '../middleware/requireMfaEnrolled.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { billShipment } from '../services/shipmentBilling.js';
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
import { estimateDutyForBody } from '../services/dutyEstimate.js';
import { DbHtsRateSource } from '../abi-engine/refdata/dbRateSource.js';
import {
  drawEntryNumber,
  validateEntryNumber,
  EntryNumberDrawError,
} from '../services/entryNumberBlocks.js';
import { renderEntry7501Pdf } from '../services/entryPdf.js';
import { contentDispositionAttachment } from '../utils/httpHeaders.js';
import {
  parseLineImportCsv,
  LINE_IMPORT_TEMPLATE,
  MAX_IMPORT_ROWS,
} from '../services/lineImport.js';

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

// ── GET /line-import-template — CSV template for bulk line import ──
// Registered BEFORE /:id so the static path isn't captured as an id.

router.get('/line-import-template', (_req: AuthRequest, res: Response): void => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', contentDispositionAttachment('mycargolens-line-import-template.csv'));
  // BOM so Excel opens it as UTF-8.
  res.send('﻿' + LINE_IMPORT_TEMPLATE);
});

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

// ── POST /draw-entry-number — Assign the next number from the org's block ──
//
// Atomic: the service's UPDATE…RETURNING serialises concurrent draws, so
// two operators filing at once can never receive the same entry number.
// Drawn numbers are consumed even if the draft is later abandoned —
// burning a number is correct filer behaviour; re-issuing one never is.

router.post('/draw-entry-number', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drawn = await drawEntryNumber(req.user!.orgId);
    await writeAuditLog({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      action: 'entry_number.draw',
      entityType: 'entry_number_block',
      entityId: drawn.blockId,
      newValue: { entryNumber: drawn.entryNumber, remaining: drawn.remaining },
      ...getRequestMeta(req),
    });
    res.json({ data: drawn });
  } catch (err) {
    if (err instanceof EntryNumberDrawError) {
      res.status(409).json({ error: err.message, code: err.code });
      return;
    }
    logger.error({ err }, '[AbiDocuments] entry number draw failed');
    res.status(500).json({ error: 'Failed to draw an entry number' });
  }
});

// ── POST /validate-entry-number — Check-digit validation for typed numbers ──

router.post('/validate-entry-number', (req: AuthRequest, res: Response): void => {
  const raw = typeof req.body?.entryNumber === 'string' ? req.body.entryNumber : '';
  if (!raw || raw.length > 20) {
    res.status(400).json({ error: 'entryNumber (string, ≤20 chars) is required' });
    return;
  }
  res.json({ data: validateEntryNumber(raw) });
});

// ── POST /:id/estimate-duty — Transmit-time duty & fee preview ──
//
// Prices the CURRENT draft payload on the native pipeline (migrate →
// duty engine over ingested USITC rates). No external call, no state
// change, no billing. Incomplete drafts return 200 with
// `{ estimable: false, issues }` — the wizard renders what's missing;
// only a missing document is an error.

router.post('/:id/estimate-duty', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
    select: { id: true, payload: true },
  });
  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }

  const result = await estimateDutyForBody(
    doc.payload,
    new DbHtsRateSource(prisma.htsRateLine)
  );
  res.json({ data: result });
});

// ── Bulk invoice-line import ───────────────────────────────────────
//
// GET  /line-import-template     — the CSV template (opens in Excel)
// POST /:id/import-lines         — { invoiceIndex, csv, dryRun? }
//
// dryRun validates and returns the row report without touching the
// draft; the real run appends only the valid rows (invalid ones come
// back per-row so the user fixes the sheet, never loses it). Imported
// items pass the same schema as hand-typed ones.

// NOTE: the template route is registered near the top of this file
// (before GET /:id) so the static path isn't captured as an :id.

router.post('/:id/import-lines', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { csv, invoiceIndex = 0, dryRun = false } = req.body ?? {};

  if (typeof csv !== 'string' || csv.length === 0) {
    res.status(400).json({ error: 'csv (string) is required' });
    return;
  }
  if (csv.length > 1_000_000) {
    res.status(400).json({ error: 'CSV too large (1 MB max)' });
    return;
  }
  if (!Number.isInteger(invoiceIndex) || invoiceIndex < 0) {
    res.status(400).json({ error: 'invoiceIndex must be a non-negative integer' });
    return;
  }

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
  });
  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }
  if (doc.status !== 'DRAFT') {
    res.status(400).json({ error: `Cannot import lines into a ${doc.status} document` });
    return;
  }

  const result = parseLineImportCsv(csv);

  if (dryRun) {
    res.json({
      data: {
        dryRun: true,
        validRows: result.items.length,
        totalRows: result.totalRows,
        errors: result.errors,
        maxRows: MAX_IMPORT_ROWS,
        // Full validated items: the wizard applies them through its own
        // local state + autosave (its array-replacement merge would
        // clobber a server-side append), so it needs everything.
        items: result.items,
      },
    });
    return;
  }

  if (result.items.length === 0) {
    res.status(422).json({
      error: 'No valid rows to import',
      data: { validRows: 0, totalRows: result.totalRows, errors: result.errors },
    });
    return;
  }

  // Append valid items to the target invoice inside the stored payload.
  const payload: any = doc.payload ?? {};
  const manifest = Array.isArray(payload.manifest) && payload.manifest[0] ? payload.manifest[0] : null;
  const invoice = manifest?.invoices?.[invoiceIndex];
  if (!invoice) {
    res.status(400).json({
      error: `Invoice ${invoiceIndex + 1} does not exist on this draft yet — add the invoice header in the wizard first.`,
    });
    return;
  }
  invoice.items = [...(Array.isArray(invoice.items) ? invoice.items : []), ...result.items];

  const updated = await prisma.abiDocument.update({
    where: { id: doc.id },
    data: { payload, ...extractDenormFromPayload(payload) },
  });

  await writeAuditLog({
    orgId: req.user!.orgId,
    userId: req.user!.id,
    action: 'abi_document.import_lines',
    entityType: 'abi_document',
    entityId: doc.id,
    newValue: { imported: result.items.length, rejected: result.errors.length, invoiceIndex },
    ...getRequestMeta(req),
  });

  res.json({
    data: {
      dryRun: false,
      imported: result.items.length,
      totalRows: result.totalRows,
      errors: result.errors,
      doc: updated,
    },
  });
});

// ── GET /:id/pdf — CBP Form 7501-format PDF ────────────────────────
//
// The record document (banks, auditors, drawback, 19 CFR 163 retention).
// Non-accepted statuses render with a diagonal watermark; CANCELLED is
// refused — a PDF of a cancelled entry is a document waiting to mislead.

router.get('/:id/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const doc = await prisma.abiDocument.findFirst({
    where: { id, orgId: req.user!.orgId },
    include: { organization: { select: { name: true } } },
  });
  if (!doc) {
    res.status(404).json({ error: 'ABI document not found' });
    return;
  }
  if (doc.status === 'CANCELLED') {
    res.status(409).json({ error: 'This entry was cancelled — no 7501 can be produced for it.' });
    return;
  }

  try {
    const estimate = await estimateDutyForBody(doc.payload, new DbHtsRateSource(prisma.htsRateLine));
    // Column 33 rate text: exact 10-digit rate line, falling back to the
    // 8-digit parent — same resolution DbHtsRateSource uses.
    const rateText = async (hts: string): Promise<string | null> => {
      const flat = hts.replace(/\D/g, '');
      let row = await prisma.htsRateLine.findUnique({ where: { htsNumber: flat }, select: { generalRate: true } });
      if (!row && flat.length === 10) {
        row = await prisma.htsRateLine.findUnique({ where: { htsNumber: flat.slice(0, 8) }, select: { generalRate: true } });
      }
      return row?.generalRate || null;
    };

    const buffer = await renderEntry7501Pdf({
      doc: { id: doc.id, status: doc.status, entryNumber: doc.entryNumber, sentAt: doc.sentAt },
      body: doc.payload,
      estimate,
      rateText,
      orgName: doc.organization.name,
    });

    const filename = `7501-${(doc.entryNumber ?? doc.id.slice(0, 8)).replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDispositionAttachment(filename));
    res.send(buffer);
  } catch (err) {
    logger.error({ err, docId: id }, '[AbiDocuments] 7501 PDF render failed');
    res.status(500).json({ error: 'Failed to generate the 7501 PDF' });
  }
});

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
