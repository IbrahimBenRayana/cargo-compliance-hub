/**
 * ABI Entry write services — extracted from routes/abiDocuments.ts so both the
 * JWT app routes and the public API share one code path. Behavior is identical
 * to the original handlers; req/res-free (callers map the {httpStatus, body}
 * outcome to their response).
 *
 * Covers CREATE (createAbiDocumentForOrg) and SEND (sendAbiDocumentToCBP).
 * The send path's polling subsystem lives in ./abiPolling.ts.
 */
import { transmitEntryNative } from './cbp/nativeEntry.js';
import { checkEntryFiler, loadOrgCbpConfig } from './cbp/filerIdentity.js';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { abiGateway } from './abi/gateway.js';
import {
  prefillFromFiling,
  prefillFromManifestQuery,
  extractDenormFromPayload,
  extractCCErrorMessage,
  mapABIDocumentToCC,
  hasNativeOnlyData,
  buildSendPayload,
  canonicaliseEntryNumber,
} from './abiDocumentMapper.js';
import { sanitizeErrorMessage } from './errorTranslator.js';
import { createABIDocumentSchema, abiDocumentBodySchema } from '../schemas/abiDocument.js';
import { writeAuditLog } from './auditLog.js';
import { notify } from './notifications.js';
import { getOrgEntitlements } from './entitlements.js';
import { captureNativeShadow } from './abiShadow.js';
import { pollABIDocumentStatus } from './abiPolling.js';
import { emitWebhook } from './webhooks.js';
import logger from '../config/logger.js';

export interface AbiWriteOutcome {
  httpStatus: number;
  body: unknown;
}

type CreateAbiInput = z.infer<typeof createABIDocumentSchema>;

// ─── Create a DRAFT ABI Entry document ─────────────────────
export async function createAbiDocumentForOrg(params: {
  data: CreateAbiInput;
  orgId: string;
  userId: string;
}): Promise<AbiWriteOutcome> {
  const { data, orgId, userId } = params;
  const { payload: providedPayload, manifestQueryId, filingId } = data;

  let initialPayload: any = providedPayload ?? {};

  // Optional pre-fill from a linked ISF filing (same org). Runs first so a
  // manifest query's CBP-derived shipment fields can override it below.
  if (filingId) {
    const linkedFiling = await prisma.filing.findFirst({ where: { id: filingId, orgId } });
    if (!linkedFiling) {
      return { httpStatus: 404, body: { error: 'Linked ISF filing not found' } };
    }
    const filingPrefill = prefillFromFiling(linkedFiling);
    initialPayload = { ...filingPrefill, ...initialPayload };
    if (filingPrefill.manifest && !providedPayload?.manifest) {
      initialPayload.manifest = filingPrefill.manifest;
    }
  }

  // Optional pre-fill from a completed manifest query (same org).
  if (manifestQueryId) {
    const mq = await prisma.manifestQuery.findFirst({ where: { id: manifestQueryId, orgId } });
    if (!mq) {
      return { httpStatus: 404, body: { error: 'Manifest query not found' } };
    }
    if (mq.response) {
      const prefill = prefillFromManifestQuery({ response: mq.response });
      initialPayload = { ...prefill, ...initialPayload };
      if (prefill.manifest && !providedPayload?.manifest) {
        initialPayload.manifest = prefill.manifest;
      }
    }
  }

  const denorm = extractDenormFromPayload(initialPayload);

  try {
    const doc = await prisma.abiDocument.create({
      data: {
        orgId,
        userId,
        status: 'DRAFT',
        payload: initialPayload,
        filingId: filingId ?? null,
        manifestQueryId: manifestQueryId ?? null,
        ...denorm,
      },
    });
    return { httpStatus: 201, body: { data: doc } };
  } catch (err: any) {
    logger.error({ err }, 'Failed to create ABI document');
    return { httpStatus: 500, body: { error: sanitizeErrorMessage(err.message || 'Failed to create ABI document') } };
  }
}

type AuditMeta = Record<string, unknown>;

type EntryEditState = { status: string; lastTransmissionId: string | null; pendingAction: string | null; cbpState: string };

/** A native entry CBP rejected, with nothing pending: correct it and resend. */
export function isNativeResendable(doc: EntryEditState): boolean {
  return doc.status === 'REJECTED' && doc.lastTransmissionId !== null && doc.pendingAction === null && doc.cbpState !== 'ON_FILE';
}

/**
 * Whether the entry's data may be edited: any draft; a native entry CBP
 * rejected (to resend it); or a native entry CBP holds, to send a
 * replacement. Never while CBP's answer is pending.
 */
export function isEntryEditable(doc: EntryEditState): boolean {
  if (doc.pendingAction) return false;
  if (doc.status === 'DRAFT') return true;
  if (doc.lastTransmissionId === null) return false;
  return isNativeResendable(doc) || doc.cbpState === 'ON_FILE';
}

// ─── Send (transmit) an ABI Entry to CBP ───────────────────
// Two-step CC flow (create document → send), with atomic DRAFT→SENDING claim,
// duplicate cleanup-and-retry, billing on success, fire-and-forget polling, and
// rollback-to-DRAFT on failure. Extracted verbatim from routes/abiDocuments.ts.
export async function sendAbiDocumentToCBP(params: {
  docId: string;
  orgId: string;
  userId: string;
  requestMeta?: AuditMeta;
}): Promise<AbiWriteOutcome> {
  const { docId, orgId, userId, requestMeta = {} } = params;

  const doc = await prisma.abiDocument.findFirst({ where: { id: docId, orgId } });
  if (!doc) {
    return { httpStatus: 404, body: { error: 'ABI document not found' } };
  }

  // A native entry CBP rejected is corrected and sent again under the same
  // entry number (audit FNA-12).
  const nativeResend = isNativeResendable(doc);
  // Idempotency — already transmitted / in-flight → return current state.
  if (!nativeResend && (doc.status === 'SENDING' || doc.status === 'SENT' || doc.status === 'ACCEPTED' || doc.status === 'REJECTED')) {
    return { httpStatus: 200, body: { data: doc, note: `Already in status ${doc.status}` } };
  }
  if (doc.status !== 'DRAFT' && !nativeResend) {
    return { httpStatus: 400, body: { error: `Cannot send document in status ${doc.status}` } };
  }

  // CBP suspended de minimis (Section 321 / Type 86) on 2025-08-29 under
  // EO 14324 and made it indefinite by interim final rule on 2026-06-24;
  // ACE rejects every Type 86. Low-value shipments need a formal (01) or
  // informal (11) entry.
  if (doc.entryType === '86') {
    return {
      httpStatus: 422,
      body: {
        error: 'CBP no longer accepts Type 86 (de minimis) entries. File this shipment as a formal (01) or informal (11) entry.',
        code: 'entry_type_suspended',
      },
    };
  }

  // Filer identity (audit BNA-01): the entry number must carry this org's
  // own filer code (from its CBP setup, never S7P or another org's code),
  // a valid check digit, and an approved service-center queue.
  const filerCheck = checkEntryFiler(await loadOrgCbpConfig(orgId), String((doc.payload as { entryNumber?: unknown } | null)?.entryNumber ?? ''));
  if (!filerCheck.ok) {
    return { httpStatus: 422, body: { error: filerCheck.message, code: filerCheck.code } };
  }

  // Full payload validation (deep) before we touch CC.
  const bodyResult = abiDocumentBodySchema.safeParse(doc.payload);
  if (!bodyResult.success) {
    return { httpStatus: 400, body: { error: 'ABI document is incomplete or invalid', details: bodyResult.error.flatten() } };
  }

  // Billing gate — a card must be on file before we transmit, since the entry
  // is charged the moment CBP accepts it.
  const ent = await getOrgEntitlements(orgId);
  if (!ent.canFile) {
    return {
      httpStatus: 402,
      body: ent.billingHold
        ? { error: 'Your account is on hold for an overdue invoice. Contact us to keep filing.', code: 'billing_hold' }
        : ent.delinquent
        ? { error: 'A previous charge failed — update your card to keep filing.', code: 'payment_required', upgradeUrl: '/settings?tab=billing' }
        : { error: 'Add a payment method to submit entries.', code: 'card_required', upgradeUrl: '/settings?tab=billing' },
    };
  }
  // Entries have no public price (pricing v2): each org's entry prices are set
  // by MyCargoLens. Until they are, an accepted entry would go unbilled.
  if (!ent.entryPricingSet) {
    return {
      httpStatus: 402,
      body: { error: 'Entry pricing has not been set up for your account yet. Contact us to start filing entries.', code: 'entry_pricing_required' },
    };
  }

  const denorm = extractDenormFromPayload(doc.payload);
  if (!denorm.mbolNumber) {
    return { httpStatus: 400, body: { error: 'ABI document payload is missing manifest MBOL number' } };
  }
  if (!denorm.entryNumber) {
    return { httpStatus: 400, body: { error: 'ABI document payload is missing filer-assigned entry number' } };
  }

  // Native gateway (the default): our own certified engine. CustomsCity
  // remains only as a per-org fallback (OrgCbpConfig.gateway = 'CC').
  if (((await loadOrgCbpConfig(orgId))?.gateway ?? 'NATIVE') === 'NATIVE') {
    // Keep the list columns (entry number, MBOL, ports) in step with the payload.
    await prisma.abiDocument.updateMany({ where: { id: doc.id, status: doc.status }, data: denorm });
    const native = await transmitEntryNative({ docId: doc.id, orgId, userId, action: 'ADD' });
    if (native.httpStatus >= 300) return { httpStatus: native.httpStatus, body: native.body };
    const updated = await prisma.abiDocument.findUnique({ where: { id: doc.id } });
    emitWebhook(orgId, 'entry.sent', { abiDocumentId: doc.id, entryNumber: doc.entryNumber, entryType: doc.entryType, mbolNumber: doc.mbolNumber });
    return { httpStatus: 200, body: { data: updated, native: native.body } };
  }

  // CustomsCity has no fields for ch.99 numbers, trade program claims or
  // AD/CVD cases, so they would silently not reach CBP (audit MHT-06).
  if (hasNativeOnlyData(bodyResult.data)) {
    return {
      httpStatus: 422,
      body: { error: 'The legacy filing route cannot carry Chapter 99, trade program or AD/CVD claims. Transmit this entry through the native engine.', code: 'NATIVE_ONLY_DATA' },
    };
  }

  // Atomic DRAFT→SENDING (single UPDATE with a status predicate — exactly one
  // concurrent caller wins; the loser short-circuits with the current status).
  const claim = await prisma.abiDocument.updateMany({
    where: { id: doc.id, status: 'DRAFT' },
    data: { status: 'SENDING', sentAt: new Date(), lastError: null, ...denorm },
  });
  if (claim.count === 0) {
    const current = await prisma.abiDocument.findUnique({ where: { id: doc.id } });
    return {
      httpStatus: 200,
      body: { data: current, note: `Another request already transitioned the document (now ${current?.status}).` },
    };
  }
  const sendingDoc = await prisma.abiDocument.findUniqueOrThrow({ where: { id: doc.id } });

  try {
    // Step 1 — POST /api/abi/documents
    const createPayload = mapABIDocumentToCC(sendingDoc);
    let createResult = await abiGateway.createABIDocument(createPayload);

    await prisma.submissionLog.create({
      data: {
        orgId, userId, correlationId: sendingDoc.id,
        method: 'POST', url: '/api/abi/documents',
        requestPayload: createPayload as any,
        responseStatus: createResult.status,
        responseBody: createResult.data as any,
        latencyMs: createResult.latencyMs,
      },
    });

    // Auto-recover from CC "already exists" (500): delete the stale entry by
    // entry number, then retry create. Idempotent transmit semantics.
    const isDuplicate =
      createResult.status === 500 && /already exist/i.test(String(createResult.data?.message ?? ''));

    if (isDuplicate && sendingDoc.entryNumber) {
      logger.info(
        { docId: sendingDoc.id, entryNumber: sendingDoc.entryNumber },
        'CC reports duplicate on create — attempting cleanup-then-retry',
      );
      const canonicalEntry = canonicaliseEntryNumber(sendingDoc.entryNumber);
      const deleteResult = await abiGateway
        .deleteABIDocument({ entryNumber: canonicalEntry })
        .catch((err: any) => ({ status: 0, data: { error: err?.message ?? 'delete failed' }, latencyMs: 0 }));

      await prisma.submissionLog.create({
        data: {
          orgId, userId, correlationId: sendingDoc.id,
          method: 'DELETE', url: '/api/abi/documents',
          requestPayload: { 'entry-number': canonicalEntry } as any,
          responseStatus: deleteResult.status,
          responseBody: deleteResult.data as any,
          latencyMs: deleteResult.latencyMs ?? 0,
        },
      });

      if (deleteResult.status >= 200 && deleteResult.status < 300) {
        createResult = await abiGateway.createABIDocument(createPayload);
        await prisma.submissionLog.create({
          data: {
            orgId, userId, correlationId: sendingDoc.id,
            method: 'POST', url: '/api/abi/documents (retry after duplicate cleanup)',
            requestPayload: createPayload as any,
            responseStatus: createResult.status,
            responseBody: createResult.data as any,
            latencyMs: createResult.latencyMs,
          },
        });
      }
    }

    // CC returns 2xx only when the document was actually accepted.
    if (createResult.status < 200 || createResult.status >= 300) {
      throw new Error(extractCCErrorMessage(createResult.data, createResult.status, 'create'));
    }

    const ccDocumentId: string | null = createResult.data?._id ?? createResult.data?.documentId ?? null;
    const postCreateDoc = await prisma.abiDocument.update({
      where: { id: sendingDoc.id },
      data: { ...(ccDocumentId ? { ccDocumentId } : {}) },
    });

    // Step 2 — POST /api/abi/send
    const sendPayload = buildSendPayload(postCreateDoc, 'add');
    const sendResult = await abiGateway.sendABIDocument(sendPayload);

    await prisma.submissionLog.create({
      data: {
        orgId, userId, correlationId: postCreateDoc.id,
        method: 'POST', url: '/api/abi/send',
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

    // Phase-5 parallel-run evidence: generate the native CATAIR equivalent
    // of what was just filed through CC. Fire-and-forget — a shadow failure
    // is recorded on the document, never surfaced to this flow.
    captureNativeShadow(sentDoc.id).catch(() => { /* recorded internally */ });

    writeAuditLog({
      orgId, userId,
      action: 'abi_document.sent', entityType: 'abi_document', entityId: sentDoc.id,
      newValue: { entryNumber: sentDoc.entryNumber, mbolNumber: sentDoc.mbolNumber, ccDocumentId: sentDoc.ccDocumentId },
      ...requestMeta,
    });

    notify({
      kind: 'entry_submitted',
      audience: { orgId, userIds: [userId] },
      title: 'Entry Transmitted',
      message: `Entry ${sentDoc.entryNumber || sentDoc.mbolNumber || sentDoc.id.slice(0, 8)} sent to CBP. Awaiting acceptance.`,
      linkUrl: `/abi-documents/${sentDoc.id}`,
      metadata: { entryNumber: sentDoc.entryNumber, entryType: sentDoc.entryType, mbolNumber: sentDoc.mbolNumber },
      abiDocumentId: sentDoc.id,
    }).catch(() => {});

    emitWebhook(orgId, 'entry.sent', {
      abiDocumentId: sentDoc.id,
      entryNumber: sentDoc.entryNumber,
      entryType: sentDoc.entryType,
      mbolNumber: sentDoc.mbolNumber,
    });

    // NOTE: billing is NOT done on send. The shipment is charged only when CBP
    // ACCEPTS the entry (see the acceptance handler in services/abiPolling.ts),
    // so a rejected entry is never charged. A linked ISF+Entry bills once
    // because both anchor on the same filingId.

    // Fire-and-forget polling.
    pollABIDocumentStatus(
      sentDoc.id,
      sentDoc.orgId,
      sentDoc.entryType as '01' | '11' | '86',
      sentDoc.entryNumber,
      sentDoc.mbolNumber,
    ).catch((err) => {
      logger.error({ err, docId: sentDoc.id }, 'Background ABI poll failed');
    });

    return { httpStatus: 200, body: { data: sentDoc } };
  } catch (err: any) {
    logger.error({ err, docId: sendingDoc.id }, 'Failed to transmit ABI document');
    const translated = sanitizeErrorMessage(err?.message || 'Failed to transmit ABI document');
    // Rollback to DRAFT so the user can retry.
    await prisma.abiDocument.update({
      where: { id: sendingDoc.id },
      data: { status: 'DRAFT', lastError: translated },
    });
    return { httpStatus: 502, body: { error: translated } };
  }
}
