/**
 * Filing write services — the create + submit logic for ISF filings, extracted
 * from routes/filings.ts so BOTH the JWT app routes and the public API
 * (routes/publicApi.ts) drive the exact same code path. Behavior is identical
 * to the original route handlers; these functions are just req/res-free
 * (callers pass userId + audit meta, and submit returns a {httpStatus, body}
 * outcome the caller maps to its response).
 */
import type { Filing } from '@prisma/client';
import { prisma } from '../config/database.js';
import { abiGateway } from './abi/gateway.js';
import { mapFilingToCCPayload } from './customscity.js';
import { validateFiling, isValidTransition, getAllowedTransitions } from './validation.js';
import { recordScoreSnapshot, triggerForStatus } from './compliance/scoreSnapshot.js';
import { translateValidationErrors } from './errorTranslator.js';
import { writeAuditLog } from './auditLog.js';
import { notifyFilingSubmitted, notifyFilingRejected, notifyApiError } from './notifications.js';
import { billShipmentForFiling } from './shipmentBilling.js';
import { getOrgEntitlements } from './entitlements.js';
import { CAPABILITIES } from '../config/plans.js';
import type { CreateFilingInput } from '../schemas/filing.js';

type AuditMeta = Record<string, unknown>;

/** Outcome of a submit attempt — the caller does `res.status(httpStatus).json(body)`. */
export interface SubmitOutcome {
  httpStatus: number;
  body: unknown;
}

// ─── Create a draft filing ─────────────────────────────────
export async function createFilingForOrg(params: {
  data: CreateFilingInput;
  orgId: string;
  userId: string;
  meta?: AuditMeta;
}): Promise<Filing> {
  const { data, orgId, userId, meta = {} } = params;

  // Calculate filing deadline (24h before departure)
  let filingDeadline: Date | null = null;
  if (data.estimatedDeparture) {
    filingDeadline = new Date(data.estimatedDeparture);
    filingDeadline.setHours(filingDeadline.getHours() - 24);
  }

  const filing = await prisma.filing.create({
    data: {
      orgId,
      createdById: userId,
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
        create: { status: 'draft', message: 'Filing created', changedById: userId },
      },
    },
  });

  writeAuditLog({
    orgId, userId,
    action: 'filing.created', entityType: 'filing', entityId: filing.id,
    newValue: { filingType: data.filingType, masterBol: data.masterBol },
    ...meta,
  });

  await recordScoreSnapshot(filing.id, 'created');
  return filing;
}

// ─── Submit a filing to CBP ────────────────────────────────
export async function submitFilingToCBP(params: {
  filingId: string;
  orgId: string;
  userId: string;
  requestMeta?: AuditMeta;
}): Promise<SubmitOutcome> {
  const { filingId, orgId, userId, requestMeta = {} } = params;

  const filing = await prisma.filing.findFirst({ where: { id: filingId, orgId } });
  if (!filing) {
    return { httpStatus: 404, body: { error: 'Filing not found' } };
  }

  // State machine check
  if (!isValidTransition(filing.status, 'submitted')) {
    return {
      httpStatus: 400,
      body: {
        error: `Filing cannot be submitted from "${filing.status}" status`,
        allowedTransitions: getAllowedTransitions(filing.status),
      },
    };
  }

  // Run validation before submitting
  const validation = validateFiling(filing);
  if (!validation.valid) {
    return {
      httpStatus: 400,
      body: { error: 'Filing has validation errors', validationErrors: validation.errors, score: validation.score },
    };
  }

  // Billing gate — ISF filing is in every tier. A card must be on file before
  // we transmit, since the shipment is charged the moment CBP accepts it.
  const ent = await getOrgEntitlements(orgId);
  if (!ent.canFile || !ent.capabilities.includes(CAPABILITIES.ISF_FILING)) {
    return {
      httpStatus: 402,
      body: ent.delinquent
        ? { error: 'A previous charge failed — update your card to keep filing.', code: 'payment_required', upgradeUrl: '/settings?tab=billing' }
        : !ent.hasActiveTier
          ? { error: 'Choose a plan to submit filings.', code: 'subscription_required', upgradeUrl: '/settings?tab=billing' }
          : { error: 'Add a payment method to submit filings.', code: 'card_required', upgradeUrl: '/settings?tab=billing' },
    };
  }

  try {
    const ccPayload = mapFilingToCCPayload(filing);
    const createResult = await abiGateway.createDocument(ccPayload);

    await prisma.submissionLog.create({
      data: {
        orgId, filingId: filing.id, userId,
        method: 'POST', url: '/api/documents',
        requestPayload: ccPayload as any,
        responseStatus: createResult.status,
        responseBody: (createResult.validationErrors ?? createResult.data) as any,
        latencyMs: createResult.latencyMs,
      },
    });

    // CC validation failures (201 + array of validation messages)
    if (!createResult.persisted) {
      const rawErrorObjects = createResult.validationErrors?.filter((e: any) => e.field) || [];
      const rawErrors = rawErrorObjects.map((e: any) => `${e.field}: ${e.message}`);
      const errorSummary = rawErrors.join('; ') || 'Filing validation failed';
      const translatedErrors = translateValidationErrors(rawErrorObjects);
      const rejectionData = JSON.stringify({ summary: errorSummary, errors: translatedErrors });

      await prisma.filing.update({
        where: { id: filing.id },
        data: { status: 'rejected', rejectedAt: new Date(), rejectionReason: rejectionData },
      });
      await prisma.filingStatusHistory.create({
        data: {
          filingId: filing.id, status: 'rejected',
          message: `CBP filing validation failed (${createResult.validationErrors?.length ?? 0} issues)`,
          ccResponse: (createResult.validationErrors ?? createResult.data) as any,
          changedById: userId,
        },
      });
      await recordScoreSnapshot(filing.id, 'rejected');
      // Rejected before transmission to CBP — not billable (no charge created).

      return {
        httpStatus: 422,
        body: {
          error: 'Filing was rejected due to validation errors. Please review and correct the issues below.',
          validationErrors: translatedErrors,
          rawErrors: createResult.validationErrors,
          filing: await prisma.filing.findUnique({ where: { id: filing.id } }),
        },
      };
    }

    if (createResult.status >= 400) {
      await prisma.filing.update({
        where: { id: filing.id },
        data: { status: 'rejected', rejectedAt: new Date(), rejectionReason: JSON.stringify(createResult.data) },
      });
      await prisma.filingStatusHistory.create({
        data: {
          filingId: filing.id, status: 'rejected',
          message: `CBP filing system error: ${createResult.status}`,
          ccResponse: createResult.data as any,
          changedById: userId,
        },
      });
      await recordScoreSnapshot(filing.id, 'rejected');
      // CC returned a hard error before our filing made it to CBP — not billable.

      return {
        httpStatus: 400,
        body: {
          error: 'The filing was rejected by the CBP filing system. Please review your data and try again.',
          apiResponse: createResult.data,
        },
      };
    }

    const ccFilingId = createResult.processId ?? createResult.data?._id ?? createResult.data?.id;

    // ISF-5 creates with send=true (one-step). ISF-10 needs a separate send.
    const isISF5 = filing.filingType === 'ISF-5';
    const wasSentDuringCreate = createResult.data?.send === 'add' || isISF5;

    let sendResult: { data: any; status: number; latencyMs: number } | null = null;
    if (!wasSentDuringCreate) {
      const sendPayload = { type: 'isf', sendAs: 'add', BOLNumber: [filing.houseBol ?? filing.masterBol] };
      sendResult = await abiGateway.sendDocument(sendPayload);
      await prisma.submissionLog.create({
        data: {
          orgId, filingId: filing.id, userId,
          method: 'POST', url: '/api/send',
          requestPayload: sendPayload as any,
          responseStatus: sendResult.status,
          responseBody: sendResult.data as any,
          latencyMs: sendResult.latencyMs,
        },
      });
    }

    const sendOk = wasSentDuringCreate ? true : (sendResult!.status < 400);
    const newStatus = sendOk ? 'submitted' : 'rejected';
    const updatedFiling = await prisma.filing.update({
      where: { id: filing.id },
      data: {
        status: newStatus,
        ccFilingId: ccFilingId ?? null,
        submittedAt: newStatus === 'submitted' ? new Date() : undefined,
        rejectedAt: newStatus === 'rejected' ? new Date() : null,
        rejectionReason: newStatus === 'rejected'
          ? JSON.stringify(sendResult?.data ?? createResult.data)
          : null,
      },
    });

    await prisma.filingStatusHistory.create({
      data: {
        filingId: filing.id, status: newStatus,
        message: newStatus === 'submitted'
          ? 'Filing submitted to CBP'
          : `Submission failed: ${sendResult?.status ?? createResult.status}`,
        ccResponse: (sendResult?.data ?? createResult.data) as any,
        changedById: userId,
      },
    });
    await recordScoreSnapshot(filing.id, triggerForStatus(newStatus));

    // Bill on successful submission (idempotent on filingId; never throws).
    if (newStatus === 'submitted') {
      await billShipmentForFiling(filing.id, orgId);
    }

    // Audit + notifications (fire-and-forget).
    writeAuditLog({
      orgId, userId,
      action: `filing.${newStatus}`, entityType: 'filing', entityId: filing.id,
      oldValue: { status: filing.status },
      newValue: { status: newStatus, ccFilingId },
      ...requestMeta,
    });
    if (newStatus === 'submitted') {
      notifyFilingSubmitted(orgId, userId, filing.id, filing.masterBol || '');
    } else {
      notifyFilingRejected(orgId, filing.id, filing.masterBol || '', JSON.stringify(sendResult?.data ?? createResult.data));
    }

    return {
      httpStatus: 200,
      body: { filing: updatedFiling, ccFilingId, sendResponse: sendResult?.data ?? createResult.data },
    };
  } catch (err: any) {
    await prisma.submissionLog.create({
      data: {
        orgId, filingId: filing.id, userId,
        method: 'POST', url: '/api/documents',
        errorMessage: err.message, latencyMs: 0,
      },
    });
    notifyApiError(orgId, userId, `Failed to submit filing: ${err.message}`);
    return {
      httpStatus: 502,
      body: { error: 'Failed to communicate with the CBP filing system. Please try again later.', message: err.message },
    };
  }
}
