import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { ccClient, mapFilingToCC, mapFilingToISF5CC, mapFilingToCCPayload } from '../services/customscity.js';
import { validateFiling, isValidTransition, getAllowedTransitions, ValidationResult } from '../services/validation.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { notifyFilingSubmitted, notifyFilingRejected, notifyFilingAmended, notifyFilingCancelled, notifyApiError } from '../services/notifications.js';
import { filingMutationLimiter, ccApiLimiter } from '../middleware/rateLimiter.js';
import { translateValidationErrors, translateCBPRejection, sanitizeErrorMessage } from '../services/errorTranslator.js';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// Helper to safely extract a single param string (Express v5 types `string | string[]`)
const paramId = (req: AuthRequest): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
};

// ─── Zod Schemas ──────────────────────────────────────────
const addressSchema = z.object({
  name: z.string().min(1),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
}).or(z.string()); // Also accept plain string for backward compatibility

const commoditySchema = z.object({
  htsCode: z.string().min(4),
  countryOfOrigin: z.string().min(2),
  description: z.string().optional(),
  quantity: z.number().optional(),
  weight: z.object({
    value: z.number(),
    unit: z.string().default('KG'),
  }).optional(),
  value: z.object({
    amount: z.number(),
    currency: z.string().default('USD'),
  }).optional(),
});

const containerSchema = z.object({
  number: z.string().min(1),
  type: z.string().optional(),
  sealNumber: z.string().optional(),
});

const createFilingSchema = z.object({
  filingType: z.enum(['ISF-10', 'ISF-5']).default('ISF-10'),
  
  // Importer
  importerName: z.string().optional(),
  importerNumber: z.string().optional(),
  
  // Consignee
  consigneeName: z.string().optional(),
  consigneeNumber: z.string().optional(),
  consigneeAddress: z.any().optional(),
  
  // Parties
  manufacturer: z.any().optional(),
  seller: z.any().optional(),
  buyer: z.any().optional(),
  shipToParty: z.any().optional(),
  containerStuffingLocation: z.any().optional(),
  consolidator: z.any().optional(),
  
  // Shipment details
  masterBol: z.string().optional(),
  houseBol: z.string().optional(),
  scacCode: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  foreignPortOfUnlading: z.string().optional(),
  placeOfDelivery: z.string().optional(),
  estimatedDeparture: z.string().optional(),
  estimatedArrival: z.string().optional(),
  
  // Bond
  bondType: z.string().optional(),
  bondSuretyCode: z.string().optional(),
  
  // ISF-5 specific data (JSONB)
  isf5Data: z.any().optional(),
  
  // Commodities & containers
  commodities: z.array(z.any()).default([]),
  containers: z.array(z.any()).default([]),
});

// ─── POST /api/v1/filings — Create new filing ─────────────
router.post('/', filingMutationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createFilingSchema.parse(req.body);

    // Calculate filing deadline (24h before departure)
    let filingDeadline: Date | null = null;
    if (data.estimatedDeparture) {
      filingDeadline = new Date(data.estimatedDeparture);
      filingDeadline.setHours(filingDeadline.getHours() - 24);
    }

    const filing = await prisma.filing.create({
      data: {
        orgId: req.user!.orgId,
        createdById: req.user!.id,
        filingType: data.filingType,
        status: 'draft',
        importerName: data.importerName,
        importerNumber: data.importerNumber,
        consigneeName: data.consigneeName,
        consigneeNumber: data.consigneeNumber,
        consigneeAddress: data.consigneeAddress ?? undefined,
        manufacturer: data.manufacturer ?? undefined,
        seller: data.seller ?? undefined,
        buyer: data.buyer ?? undefined,
        shipToParty: data.shipToParty ?? undefined,
        containerStuffingLocation: data.containerStuffingLocation ?? undefined,
        consolidator: data.consolidator ?? undefined,
        masterBol: data.masterBol,
        houseBol: data.houseBol,
        scacCode: data.scacCode,
        vesselName: data.vesselName,
        voyageNumber: data.voyageNumber,
        foreignPortOfUnlading: data.foreignPortOfUnlading,
        placeOfDelivery: data.placeOfDelivery,
        estimatedDeparture: data.estimatedDeparture ? new Date(data.estimatedDeparture) : undefined,
        estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
        filingDeadline: filingDeadline ?? undefined,
        bondType: data.bondType,
        bondSuretyCode: data.bondSuretyCode,
        isf5Data: data.isf5Data ?? undefined,
        commodities: data.commodities,
        containers: data.containers,
        statusHistory: {
          create: {
            status: 'draft',
            message: 'Filing created',
            changedById: req.user!.id,
          },
        },
      },
    });

    // Audit log
    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'filing.created', entityType: 'filing', entityId: filing.id,
      newValue: { filingType: data.filingType, masterBol: data.masterBol },
      ...meta,
    });

    res.status(201).json(filing);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    throw err;
  }
});

// ─── GET /api/v1/filings — List filings ───────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    status,
    filingType,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * pageSize;

  const where: any = { orgId: req.user!.orgId };
  if (status) where.status = status;
  if (filingType) where.filingType = filingType;
  if (search) {
    where.OR = [
      { importerName: { contains: search, mode: 'insensitive' } },
      { masterBol: { contains: search, mode: 'insensitive' } },
      { vesselName: { contains: search, mode: 'insensitive' } },
      { consigneeName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [filings, total] = await Promise.all([
    prisma.filing.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.filing.count({ where }),
  ]);

  res.json({
    data: filings,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ─── GET /api/v1/filings/:id — Get single filing ──────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
    include: {
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  res.json(filing);
});

// ─── PATCH /api/v1/filings/:id — Update draft filing ──────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    res.status(400).json({ error: 'Only draft or rejected filings can be edited' });
    return;
  }

  try {
    const data = createFilingSchema.partial().parse(req.body);

    // Recalculate deadline if departure changed
    let filingDeadline = existing.filingDeadline;
    if (data.estimatedDeparture) {
      filingDeadline = new Date(data.estimatedDeparture);
      filingDeadline.setHours(filingDeadline.getHours() - 24);
    }

    const filing = await prisma.filing.update({
      where: { id: paramId(req) },
      data: {
        ...data,
        estimatedDeparture: data.estimatedDeparture ? new Date(data.estimatedDeparture) : undefined,
        estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
        filingDeadline: filingDeadline ?? undefined,
      },
    });

    res.json(filing);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    throw err;
  }
});

// ─── DELETE /api/v1/filings/:id — Delete draft filing ─────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!existing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  if (existing.status !== 'draft') {
    res.status(400).json({ error: 'Only draft filings can be deleted' });
    return;
  }

  await prisma.filing.delete({ where: { id: paramId(req) } });
  res.json({ message: 'Filing deleted' });
});

// ─── POST /api/v1/filings/:id/submit — Submit to CBP ──────
router.post('/:id/submit', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  // State machine check
  if (!isValidTransition(filing.status, 'submitted')) {
    res.status(400).json({
      error: `Filing cannot be submitted from "${filing.status}" status`,
      allowedTransitions: getAllowedTransitions(filing.status),
    });
    return;
  }

  // Run validation before submitting
  const validation = validateFiling(filing);
  if (!validation.valid) {
    res.status(400).json({
      error: 'Filing has validation errors',
      validationErrors: validation.errors,
      score: validation.score,
    });
    return;
  }

  try {
    // Map to CustomsCity format (auto-detect ISF-10 vs ISF-5)
    const ccPayload = mapFilingToCCPayload(filing);

    // Create document in CustomsCity
    const createResult = await ccClient.createDocument(ccPayload);

    // Log the API call
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        filingId: filing.id,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/documents',
        requestPayload: ccPayload as any,
        responseStatus: createResult.status,
        responseBody: (createResult.validationErrors ?? createResult.data) as any,
        latencyMs: createResult.latencyMs,
      },
    });

    // Handle CC validation failures (201 + array of validation messages)
    if (!createResult.persisted) {
      const rawErrorObjects = createResult.validationErrors
        ?.filter((e: any) => e.field) || [];

      const rawErrors = rawErrorObjects.map((e: any) => `${e.field}: ${e.message}`);
      const errorSummary = rawErrors.join('; ') || 'Filing validation failed';

      // Pass original objects to translator for better field extraction
      const translatedErrors = translateValidationErrors(rawErrorObjects);

      // Store both human-readable summary and structured translated errors
      const rejectionData = JSON.stringify({
        summary: errorSummary,
        errors: translatedErrors,
      });

      await prisma.filing.update({
        where: { id: filing.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: rejectionData,
        },
      });

      await prisma.filingStatusHistory.create({
        data: {
          filingId: filing.id,
          status: 'rejected',
          message: `CBP filing validation failed (${createResult.validationErrors?.length ?? 0} issues)`,
          ccResponse: (createResult.validationErrors ?? createResult.data) as any,
          changedById: req.user!.id,
        },
      });

      res.status(422).json({
        error: 'Filing was rejected due to validation errors. Please review and correct the issues below.',
        validationErrors: translatedErrors,
        rawErrors: createResult.validationErrors,
        filing: await prisma.filing.findUnique({ where: { id: filing.id } }),
      });
      return;
    }

    if (createResult.status >= 400) {
      // API returned an error
      await prisma.filing.update({
        where: { id: filing.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: JSON.stringify(createResult.data),
        },
      });

      await prisma.filingStatusHistory.create({
        data: {
          filingId: filing.id,
          status: 'rejected',
          message: `CBP filing system error: ${createResult.status}`,
          ccResponse: createResult.data as any,
          changedById: req.user!.id,
        },
      });

      res.status(400).json({
        error: 'The filing was rejected by the CBP filing system. Please review your data and try again.',
        apiResponse: createResult.data,
      });
      return;
    }

    const ccFilingId = createResult.processId ?? createResult.data?._id ?? createResult.data?.id;

    // ISF-5 creates with send=true (one-step create+send), so skip the separate send call.
    // ISF-10 creates with send=false and requires a separate /api/send call.
    const isISF5 = filing.filingType === 'ISF-5';
    const wasSentDuringCreate = createResult.data?.send === 'add' || isISF5;

    let sendResult: { data: any; status: number; latencyMs: number } | null = null;
    if (!wasSentDuringCreate) {
      // ISF-10: separate send step
      const docType = 'isf';
      const sendPayload = {
        type: docType,
        sendAs: 'add',
        BOLNumber: [filing.houseBol ?? filing.masterBol],
      };
      sendResult = await ccClient.sendDocument(sendPayload);

      // Log the send call
      await prisma.submissionLog.create({
        data: {
          orgId: req.user!.orgId,
          filingId: filing.id,
          userId: req.user!.id,
          method: 'POST',
          url: '/api/send',
          requestPayload: sendPayload as any,
          responseStatus: sendResult.status,
          responseBody: sendResult.data as any,
          latencyMs: sendResult.latencyMs,
        },
      });
    }

    // Determine status: if ISF-5 (sent during create), success is based on createResult
    const sendOk = wasSentDuringCreate ? true : (sendResult!.status < 400);

    // Update filing status
    const newStatus = sendOk ? 'submitted' : 'rejected';
    const updatedFiling = await prisma.filing.update({
      where: { id: filing.id },
      data: {
        status: newStatus,
        ccFilingId: ccFilingId ?? null,
        submittedAt: newStatus === 'submitted' ? new Date() : undefined,
        rejectedAt: newStatus === 'rejected' ? new Date() : undefined,
        rejectionReason: newStatus === 'rejected' ? JSON.stringify(sendResult?.data ?? createResult.data) : undefined,
      },
    });

    await prisma.filingStatusHistory.create({
      data: {
        filingId: filing.id,
        status: newStatus,
        message: newStatus === 'submitted'
          ? 'Filing submitted to CBP'
          : `Submission failed: ${sendResult?.status ?? createResult.status}`,
        ccResponse: (sendResult?.data ?? createResult.data) as any,
        changedById: req.user!.id,
      },
    });

    res.json({
      filing: updatedFiling,
      ccFilingId,
      sendResponse: sendResult?.data ?? createResult.data,
    });

    // Audit log + notifications (fire-and-forget)
    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: `filing.${newStatus}`, entityType: 'filing', entityId: filing.id,
      oldValue: { status: filing.status },
      newValue: { status: newStatus, ccFilingId },
      ...meta,
    });
    if (newStatus === 'submitted') {
      notifyFilingSubmitted(req.user!.orgId, req.user!.id, filing.id, filing.masterBol || '');
    } else {
      notifyFilingRejected(req.user!.orgId, filing.id, filing.masterBol || '', JSON.stringify(sendResult?.data ?? createResult.data));
    }
  } catch (err: any) {
    // Log failed attempt
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        filingId: filing.id,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/documents',
        errorMessage: err.message,
        latencyMs: 0,
      },
    });

    res.status(502).json({
      error: 'Failed to communicate with the CBP filing system. Please try again later.',
      message: err.message,
    });

    notifyApiError(req.user!.orgId, req.user!.id, `Failed to submit filing: ${err.message}`);
  }
});

// ─── POST /api/v1/filings/:id/amend — Submit amendment ─────
router.post('/:id/amend', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  // Only accepted filings can be amended
  if (filing.status !== 'accepted') {
    res.status(400).json({
      error: `Filing cannot be amended from "${filing.status}" status. Only accepted filings can be amended.`,
      allowedTransitions: getAllowedTransitions(filing.status),
    });
    return;
  }

  if (!filing.ccFilingId) {
    res.status(400).json({ error: 'Filing has no CBP reference ID — cannot amend. The filing must be submitted first.' });
    return;
  }

  try {
    // Apply any updated fields from the request body
    const updates = createFilingSchema.partial().parse(req.body);

    // Recalculate deadline if departure changed
    let filingDeadline = filing.filingDeadline;
    if (updates.estimatedDeparture) {
      filingDeadline = new Date(updates.estimatedDeparture);
      filingDeadline.setHours(filingDeadline.getHours() - 24);
    }

    // Update the filing locally first
    const updatedFiling = await prisma.filing.update({
      where: { id: filing.id },
      data: {
        ...updates,
        estimatedDeparture: updates.estimatedDeparture ? new Date(updates.estimatedDeparture) : undefined,
        estimatedArrival: updates.estimatedArrival ? new Date(updates.estimatedArrival) : undefined,
        filingDeadline: filingDeadline ?? undefined,
        status: 'amended',
        amendedAt: new Date(),
      },
    });

    // Map and send amendment to CC API (sendAs = 'change' per official docs)
    const ccPayload = mapFilingToCCPayload(updatedFiling);
    ccPayload.sendAs = 'change'; // Amendment
    if (ccPayload.body[0]) {
      ccPayload.body[0].amendmentCode = 'FR'; // Full Replace for amendments
    }

    const ccResult = await ccClient.createDocument(ccPayload);

    // Log the API call
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        filingId: filing.id,
        userId: req.user!.id,
        method: 'POST',
        url: '/api/documents (amendment)',
        requestPayload: ccPayload as any,
        responseStatus: ccResult.status,
        responseBody: (ccResult.validationErrors ?? ccResult.data) as any,
        latencyMs: ccResult.latencyMs,
      },
    });

    // Handle CC validation failures
    if (!ccResult.persisted) {
      // Revert the filing status back
      await prisma.filing.update({
        where: { id: filing.id },
        data: { status: 'accepted', amendedAt: null },
      });
      res.status(422).json({
        error: 'Amendment was rejected due to validation errors. Please review and correct the issues.',
        validationErrors: translateValidationErrors(
          ccResult.validationErrors?.filter((e: any) => e.field).map((e: any) => `${e.field}: ${e.message}`) || []
        ),
        rawErrors: ccResult.validationErrors,
      });
      return;
    }

    // If CC accepted, send to CBP
    if (ccResult.status < 400 && ccResult.persisted) {
      const ccAmendId = ccResult.processId ?? ccResult.data?._id ?? ccResult.data?.id;
      const amendDocType = filing.filingType === 'ISF-5' ? 'isf-5' : 'isf';
      const amendSendPayload = { type: amendDocType, sendAs: 'change', BOLNumber: [filing.houseBol ?? filing.masterBol] };
      const sendResult = await ccClient.sendDocument(amendSendPayload);

      await prisma.submissionLog.create({
        data: {
          orgId: req.user!.orgId,
          filingId: filing.id,
          userId: req.user!.id,
          method: 'POST',
          url: '/api/send (amendment)',
          requestPayload: amendSendPayload as any,
          responseStatus: sendResult.status,
          responseBody: sendResult.data as any,
          latencyMs: sendResult.latencyMs,
        },
      });
    }

    await prisma.filingStatusHistory.create({
      data: {
        filingId: filing.id,
        status: 'amended',
        message: 'Filing amendment submitted',
        ccResponse: ccResult.data as any,
        changedById: req.user!.id,
      },
    });

    const meta = getRequestMeta(req);
    writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'filing.amended', entityType: 'filing', entityId: filing.id,
      oldValue: { status: filing.status },
      newValue: { status: 'amended', amendments: updates },
      ...meta,
    });
    notifyFilingAmended(req.user!.orgId, req.user!.id, filing.id, filing.masterBol || '');

    res.json({ filing: updatedFiling, ccResponse: ccResult.data });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.flatten() });
      return;
    }
    res.status(502).json({ error: 'Amendment failed', message: err.message });
    notifyApiError(req.user!.orgId, req.user!.id, `Failed to amend filing: ${err.message}`);
  }
});

// ─── POST /api/v1/filings/:id/cancel — Cancel a filing ────
router.post('/:id/cancel', filingMutationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  if (!isValidTransition(filing.status, 'cancelled')) {
    res.status(400).json({
      error: `Filing cannot be cancelled from "${filing.status}" status`,
      allowedTransitions: getAllowedTransitions(filing.status),
    });
    return;
  }

  // If filing was submitted to CC, send delete/cancel
  if (filing.ccFilingId) {
    try {
      const ccPayload = mapFilingToCCPayload(filing);
      ccPayload.sendAs = 'cancel'; // Cancel/Delete per official docs

      const ccResult = await ccClient.createDocument(ccPayload);

      await prisma.submissionLog.create({
        data: {
          orgId: req.user!.orgId,
          filingId: filing.id,
          userId: req.user!.id,
          method: 'POST',
          url: '/api/documents (cancellation)',
          requestPayload: ccPayload as any,
          responseStatus: ccResult.status,
          responseBody: ccResult.data as any,
          latencyMs: ccResult.latencyMs,
        },
      });

      if (!ccResult.persisted) {
        console.warn('[Cancel] CC API rejected cancellation payload — proceeding with local cancel');
      } else {
        // Send the cancel to CBP
        const cancelDocType = filing.filingType === 'ISF-5' ? 'isf-5' : 'isf';
        const cancelSendPayload = { type: cancelDocType, sendAs: 'cancel', BOLNumber: [filing.houseBol ?? filing.masterBol] };
        const sendResult = await ccClient.sendDocument(cancelSendPayload);
        await prisma.submissionLog.create({
          data: {
            orgId: req.user!.orgId,
            filingId: filing.id,
            userId: req.user!.id,
            method: 'POST',
            url: '/api/send (cancellation)',
            requestPayload: cancelSendPayload as any,
            responseStatus: sendResult.status,
            responseBody: sendResult.data as any,
            latencyMs: sendResult.latencyMs,
          },
        });
      }
    } catch (err: any) {
      // Log but don't block cancellation if CC API fails
      console.error('[Cancel] CC API call failed:', err.message);
    }
  }

  const updatedFiling = await prisma.filing.update({
    where: { id: filing.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
  });

  await prisma.filingStatusHistory.create({
    data: {
      filingId: filing.id,
      status: 'cancelled',
      message: req.body?.reason || 'Filing cancelled by user',
      changedById: req.user!.id,
    },
  });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'filing.cancelled', entityType: 'filing', entityId: filing.id,
    oldValue: { status: filing.status },
    newValue: { status: 'cancelled', reason: req.body?.reason },
    ...meta,
  });
  notifyFilingCancelled(req.user!.orgId, req.user!.id, filing.id, filing.masterBol || '');

  res.json({ filing: updatedFiling });
});

// ─── POST /api/v1/filings/:id/validate — Validate filing ──
router.post('/:id/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  const validation = validateFiling(filing);
  res.json(validation);
});

// ─── GET /api/v1/filings/stats — Dashboard stats ──────────
router.get('/stats/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user!.orgId;

  const [total, byStatus, recentFilings] = await Promise.all([
    prisma.filing.count({ where: { orgId } }),
    prisma.filing.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
    }),
    prisma.filing.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        filingType: true,
        status: true,
        importerName: true,
        masterBol: true,
        vesselName: true,
        filingDeadline: true,
        createdAt: true,
        submittedAt: true,
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  byStatus.forEach((s) => {
    statusCounts[s.status] = s._count.id;
  });

  res.json({
    total,
    statusCounts,
    recentFilings,
  });
});

// ─── POST /api/v1/filings/:id/check-status — Poll CC for CBP response ──
router.post('/:id/check-status', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  // Only check status for submitted filings (waiting for CBP response)
  if (filing.status !== 'submitted') {
    res.json({
      filing,
      ccStatus: null,
      messages: [],
      statusChanged: false,
      message: `Filing is "${filing.status}" — no status check needed`,
    });
    return;
  }

  const masterBol = filing.masterBol;
  const houseBol = filing.houseBol;

  if (!masterBol && !houseBol) {
    res.status(400).json({ error: 'Filing has no BOL numbers — cannot check status' });
    return;
  }

  try {
    // ── 1. Query CC /api/document-status ──
    const statusParams: Record<string, string> = {
      manifestType: 'ISF',
      skip: '0',
    };
    if (masterBol) statusParams.masterBOLNumber = masterBol;
    else if (houseBol) statusParams.houseBOLNumber = houseBol;

    const statusResult = await ccClient.getDocumentStatus(statusParams);

    // Log the API call
    await prisma.submissionLog.create({
      data: {
        orgId: req.user!.orgId,
        filingId: filing.id,
        userId: req.user!.id,
        method: 'GET',
        url: '/api/document-status',
        requestPayload: statusParams as any,
        responseStatus: statusResult.status,
        responseBody: statusResult.data as any,
        latencyMs: statusResult.latencyMs,
      },
    });

    const statusData = statusResult.data;
    const documents = statusData?.data ?? [];

    // Find the matching document status
    const matchingDoc = documents.find((d: any) =>
      (houseBol && d.bol === houseBol) ||
      (masterBol && d.masterBOL === masterBol)
    ) || documents[0];

    // ── 2. Query CC /api/messages for the full CBP message timeline ──
    let messages: any[] = [];
    if (houseBol) {
      try {
        // Build date range: from filing submission to now
        const dateFrom = filing.submittedAt
          ? new Date(new Date(filing.submittedAt).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : '2025-01-01';
        const dateTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const msgParams: Record<string, string> = {
          type: 'ISF',
          houseBOLNumber: houseBol,
          skip: '0',
          dateFrom,
          dateTo,
          typeDate: 'createdDate',
        };
        if (masterBol) msgParams.masterBOLNumber = masterBol;

        const msgResult = await ccClient.getMessages(msgParams);
        messages = msgResult.data?.data ?? [];

        // Log
        await prisma.submissionLog.create({
          data: {
            orgId: req.user!.orgId,
            filingId: filing.id,
            userId: req.user!.id,
            method: 'GET',
            url: '/api/messages',
            requestPayload: msgParams as any,
            responseStatus: msgResult.status,
            responseBody: msgResult.data as any,
            latencyMs: msgResult.latencyMs,
          },
        });
      } catch (msgErr: any) {
        console.warn(`[Status Check] Messages fetch failed for filing ${filing.id}:`, msgErr.message);
        // Non-fatal — we can still use document-status
      }
    }

    // ── 3. Determine if status changed ──
    const ccStatus = matchingDoc?.status?.toUpperCase(); // "ACCEPTED", "REJECTED", "ON HOLD", etc.
    let newStatus: string | null = null;

    if (ccStatus === 'ACCEPTED' || ccStatus === 'BILL ACCEPTED') {
      newStatus = 'accepted';
    } else if (ccStatus === 'REJECTED' || ccStatus === 'BILL REJECTED') {
      newStatus = 'rejected';
    } else if (ccStatus === 'ON HOLD' || ccStatus === 'HELD') {
      newStatus = 'on_hold';
    }

    // Also check messages for acceptance/rejection signals
    if (!newStatus && messages.length > 0) {
      const hasAccepted = messages.some((m: any) =>
        m.description?.includes('ACCEPTED') || m.description?.includes('BILL ACCEPTED')
      );
      const hasRejected = messages.some((m: any) =>
        m.description?.includes('REJECTED') || m.statusCode === 'REJECTED'
      );
      if (hasAccepted && !hasRejected) newStatus = 'accepted';
      else if (hasRejected) newStatus = 'rejected';
    }

    let statusChanged = false;
    let updatedFiling = filing;

    if (newStatus && newStatus !== filing.status) {
      statusChanged = true;

      // Extract rejection reason if rejected
      let rejectionReason: string | undefined;
      if (newStatus === 'rejected') {
        // Collect all rejection-related messages from CBP
        const rejectionMsgs = messages
          .filter((m: any) => m.description?.includes('REJECTED') || m.description?.includes('NOT ON FILE') || m.statusCode === 'REJECTED')
          .map((m: any) => m.description)
          .filter(Boolean);

        // Also include disposition descriptions from the doc status
        const allMsgs = [...new Set(rejectionMsgs)]; // deduplicate
        const rawReason = allMsgs.join(', ') || matchingDoc?.lastEvent?.codeDescription || 'Rejected by CBP';

        // Translate CBP codes into user-friendly messages
        const translatedErrors = translateCBPRejection(rawReason);

        rejectionReason = JSON.stringify({
          summary: rawReason,
          errors: translatedErrors,
        });
      }

      // Extract ISF transaction number
      const isfTxnNumber = messages.find((m: any) => m.ISFTransactionNumber)?.ISFTransactionNumber;

      updatedFiling = await prisma.filing.update({
        where: { id: filing.id },
        data: {
          status: newStatus,
          acceptedAt: newStatus === 'accepted' ? new Date() : undefined,
          rejectedAt: newStatus === 'rejected' ? new Date() : undefined,
          rejectionReason: rejectionReason ?? undefined,
          cbpTransactionId: isfTxnNumber ?? filing.cbpTransactionId ?? undefined,
        },
      });

      // Record status change in history
      const rawSummary = newStatus === 'rejected'
        ? (() => { try { return JSON.parse(rejectionReason || '{}').summary; } catch { return rejectionReason; } })()
        : undefined;

      await prisma.filingStatusHistory.create({
        data: {
          filingId: filing.id,
          status: newStatus,
          message: newStatus === 'accepted'
            ? `CBP accepted the ISF filing${isfTxnNumber ? ` (ISF Txn: ${isfTxnNumber})` : ''}`
            : newStatus === 'rejected'
            ? `CBP rejected the ISF filing: ${rawSummary || 'See rejection details'}`
            : `CBP placed filing on hold`,
          ccResponse: { documentStatus: matchingDoc, messages } as any,
          changedById: req.user!.id,
        },
      });

      // Audit log
      const meta = getRequestMeta(req);
      writeAuditLog({
        orgId: req.user!.orgId,
        userId: req.user!.id,
        action: `filing.status_update.${newStatus}`,
        entityType: 'filing',
        entityId: filing.id,
        oldValue: { status: filing.status },
        newValue: { status: newStatus, cbpTransactionId: isfTxnNumber },
        ...meta,
      });
    }

    res.json({
      filing: updatedFiling,
      ccStatus: matchingDoc ?? null,
      messages,
      statusChanged,
      newStatus: statusChanged ? newStatus : null,
      eventSummary: matchingDoc?.eventSummary ?? null,
      lastEvent: matchingDoc?.lastEvent ?? null,
    });
  } catch (err: any) {
    console.error(`[Status Check] Error for filing ${filing.id}:`, err);
    res.status(502).json({
      error: 'Failed to check filing status. Please try again later.',
      message: err.message,
    });
  }
});

// ─── POST /api/v1/filings/check-all-statuses — Bulk poll for all submitted filings ──
router.post('/check-all-statuses', ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const submittedFilings = await prisma.filing.findMany({
    where: {
      orgId: req.user!.orgId,
      status: 'submitted',
    },
    orderBy: { submittedAt: 'asc' },
    take: 20, // Limit to avoid overwhelming CC API
  });

  if (submittedFilings.length === 0) {
    res.json({ checked: 0, updated: 0, results: [] });
    return;
  }

  const results: Array<{ filingId: string; bol: string; oldStatus: string; newStatus: string | null; statusChanged: boolean }> = [];

  for (const filing of submittedFilings) {
    try {
      const masterBol = filing.masterBol;
      const houseBol = filing.houseBol;
      if (!masterBol && !houseBol) continue;

      const statusParams: Record<string, string> = {
        manifestType: 'ISF',
        skip: '0',
      };
      if (masterBol) statusParams.masterBOLNumber = masterBol;
      else if (houseBol) statusParams.houseBOLNumber = houseBol;

      const statusResult = await ccClient.getDocumentStatus(statusParams);
      const documents = statusResult.data?.data ?? [];
      const matchingDoc = documents.find((d: any) =>
        (houseBol && d.bol === houseBol) || (masterBol && d.masterBOL === masterBol)
      ) || documents[0];

      const ccStatus = matchingDoc?.status?.toUpperCase();
      let newStatus: string | null = null;

      if (ccStatus === 'ACCEPTED' || ccStatus === 'BILL ACCEPTED') newStatus = 'accepted';
      else if (ccStatus === 'REJECTED' || ccStatus === 'BILL REJECTED') newStatus = 'rejected';
      else if (ccStatus === 'ON HOLD' || ccStatus === 'HELD') newStatus = 'on_hold';

      if (newStatus && newStatus !== filing.status) {
        await prisma.filing.update({
          where: { id: filing.id },
          data: {
            status: newStatus,
            acceptedAt: newStatus === 'accepted' ? new Date() : undefined,
            rejectedAt: newStatus === 'rejected' ? new Date() : undefined,
            rejectionReason: newStatus === 'rejected' ? (matchingDoc?.lastEvent?.codeDescription || 'Rejected by CBP') : undefined,
            cbpTransactionId: matchingDoc?.ISFTransactionNumber ?? filing.cbpTransactionId ?? undefined,
          },
        });

        await prisma.filingStatusHistory.create({
          data: {
            filingId: filing.id,
            status: newStatus,
            message: `CBP status update: ${newStatus} (auto-check)`,
            ccResponse: matchingDoc as any,
            changedById: req.user!.id,
          },
        });

        results.push({
          filingId: filing.id,
          bol: filing.houseBol || filing.masterBol || '',
          oldStatus: filing.status,
          newStatus,
          statusChanged: true,
        });
      } else {
        results.push({
          filingId: filing.id,
          bol: filing.houseBol || filing.masterBol || '',
          oldStatus: filing.status,
          newStatus: null,
          statusChanged: false,
        });
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.warn(`[Bulk Status Check] Error for filing ${filing.id}:`, err.message);
      results.push({
        filingId: filing.id,
        bol: filing.houseBol || filing.masterBol || '',
        oldStatus: filing.status,
        newStatus: null,
        statusChanged: false,
      });
    }
  }

  const updated = results.filter(r => r.statusChanged).length;
  res.json({ checked: submittedFilings.length, updated, results });
});

// ─── POST /api/v1/filings/:id/duplicate — Clone filing as new draft ──
router.post('/:id/duplicate', filingMutationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  // Clone all filing data except identity/status fields
  const duplicated = await prisma.filing.create({
    data: {
      orgId: req.user!.orgId,
      createdById: req.user!.id,
      filingType: filing.filingType,
      status: 'draft',
      importerName: filing.importerName,
      importerNumber: filing.importerNumber,
      consigneeName: filing.consigneeName,
      consigneeNumber: filing.consigneeNumber,
      consigneeAddress: filing.consigneeAddress ?? undefined,
      manufacturer: filing.manufacturer ?? undefined,
      seller: filing.seller ?? undefined,
      buyer: filing.buyer ?? undefined,
      shipToParty: filing.shipToParty ?? undefined,
      containerStuffingLocation: filing.containerStuffingLocation ?? undefined,
      consolidator: filing.consolidator ?? undefined,
      masterBol: '', // Must be unique — user fills in
      houseBol: '',  // Must be unique — user fills in
      scacCode: filing.scacCode,
      vesselName: filing.vesselName,
      voyageNumber: '',  // Different per shipment
      foreignPortOfUnlading: filing.foreignPortOfUnlading,
      placeOfDelivery: filing.placeOfDelivery,
      bondType: filing.bondType,
      bondSuretyCode: filing.bondSuretyCode,
      isf5Data: filing.isf5Data ?? undefined,
      commodities: filing.commodities as any ?? [],
      containers: [], // Different per shipment
      statusHistory: {
        create: {
          status: 'draft',
          message: `Duplicated from filing ${filing.houseBol || filing.masterBol || filing.id.slice(0, 8)}`,
          changedById: req.user!.id,
        },
      },
    },
  });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'filing.duplicated', entityType: 'filing', entityId: duplicated.id,
    newValue: { sourceFilingId: filing.id, filingType: filing.filingType },
    ...meta,
  });

  res.status(201).json(duplicated);
});

// ─── POST /api/v1/filings/:id/save-template — Save filing as template ──
router.post('/:id/save-template', filingMutationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const filing = await prisma.filing.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!filing) {
    res.status(404).json({ error: 'Filing not found' });
    return;
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Template name is required' });
    return;
  }

  // Extract template-worthy data (exclude BOL, voyage, dates, containers — those change per shipment)
  const templateData = {
    importerName: filing.importerName,
    importerNumber: filing.importerNumber,
    consigneeName: filing.consigneeName,
    consigneeNumber: filing.consigneeNumber,
    consigneeAddress: filing.consigneeAddress,
    manufacturer: filing.manufacturer,
    seller: filing.seller,
    buyer: filing.buyer,
    shipToParty: filing.shipToParty,
    containerStuffingLocation: filing.containerStuffingLocation,
    consolidator: filing.consolidator,
    scacCode: filing.scacCode,
    foreignPortOfUnlading: filing.foreignPortOfUnlading,
    placeOfDelivery: filing.placeOfDelivery,
    bondType: filing.bondType,
    bondSuretyCode: filing.bondSuretyCode,
    isf5Data: filing.isf5Data,
    commodities: filing.commodities,
  };

  const template = await prisma.filingTemplate.create({
    data: {
      orgId: req.user!.orgId,
      createdById: req.user!.id,
      name: name.trim(),
      filingType: filing.filingType,
      templateData: templateData as any,
    },
  });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'template.created', entityType: 'filing_template', entityId: template.id,
    newValue: { name: template.name, filingType: template.filingType, sourceFilingId: filing.id },
    ...meta,
  });

  res.status(201).json(template);
});

// ─── POST /api/v1/filings/bulk-submit — Submit multiple draft filings ──
router.post('/bulk-submit', filingMutationLimiter, ccApiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filingIds } = req.body;
    if (!Array.isArray(filingIds) || filingIds.length === 0) {
      res.status(400).json({ error: 'filingIds array is required' });
      return;
    }

    if (filingIds.length > 20) {
      res.status(400).json({ error: 'Maximum 20 filings per bulk operation' });
      return;
    }

    // Fetch all filings that belong to this org and are in draft status
    const filings = await prisma.filing.findMany({
      where: {
        id: { in: filingIds },
        orgId: req.user!.orgId,
        status: 'draft',
      },
    });

    const results: Array<{
      filingId: string;
      bol: string;
      success: boolean;
      error?: string;
      newStatus?: string;
    }> = [];

    for (const filing of filings) {
      try {
        // Validate first
        const validation = validateFiling(filing);
        if (!validation.valid) {
          results.push({
            filingId: filing.id,
            bol: filing.houseBol || filing.masterBol || filing.id.slice(0, 8),
            success: false,
            error: `${validation.criticalCount} critical errors`,
          });
          continue;
        }

        // Map and submit to CC API
        const payload = mapFilingToCCPayload(filing);
        const ccResult = await ccClient.createDocument(payload);

        // Update filing status
        const ccFilingId = ccResult?.data?._id || ccResult?.data?.id || null;
        await prisma.filing.update({
          where: { id: filing.id },
          data: {
            status: 'submitted',
            ccFilingId: ccFilingId ? String(ccFilingId) : undefined,
            submittedAt: new Date(),
          },
        });

        // Create status history
        await prisma.filingStatusHistory.create({
          data: {
            filingId: filing.id,
            status: 'submitted',
            message: 'Bulk submission to CBP',
            ccResponse: ccResult?.data || null,
            changedById: req.user!.id,
          },
        });

        await notifyFilingSubmitted(req.user!.orgId, req.user!.id, filing.id, filing.houseBol || filing.masterBol || '');

        results.push({
          filingId: filing.id,
          bol: filing.houseBol || filing.masterBol || filing.id.slice(0, 8),
          success: true,
          newStatus: 'submitted',
        });

        // Rate limit: wait 500ms between CC API calls
        if (filings.indexOf(filing) < filings.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err: any) {
        results.push({
          filingId: filing.id,
          bol: filing.houseBol || filing.masterBol || filing.id.slice(0, 8),
          success: false,
          error: err.message,
        });
      }
    }

    // Track IDs that weren't found (either not in org or not draft)
    const processedIds = new Set(filings.map(f => f.id));
    const skipped = filingIds.filter(id => !processedIds.has(id));

    res.json({
      submitted: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      skipped: skipped.length,
      results,
      skippedIds: skipped,
    });
  } catch (err: any) {
    console.error('[BulkSubmit] Error:', err.message);
    res.status(500).json({ error: 'Bulk submission failed' });
  }
});

// ─── POST /api/v1/filings/bulk-delete — Delete multiple draft filings ──
router.post('/bulk-delete', filingMutationLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filingIds } = req.body;
    if (!Array.isArray(filingIds) || filingIds.length === 0) {
      res.status(400).json({ error: 'filingIds array is required' });
      return;
    }

    if (filingIds.length > 50) {
      res.status(400).json({ error: 'Maximum 50 filings per bulk delete' });
      return;
    }

    // Only delete draft filings
    const result = await prisma.filing.deleteMany({
      where: {
        id: { in: filingIds },
        orgId: req.user!.orgId,
        status: 'draft',
      },
    });

    res.json({
      deleted: result.count,
      requested: filingIds.length,
    });
  } catch (err: any) {
    console.error('[BulkDelete] Error:', err.message);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

export default router;
