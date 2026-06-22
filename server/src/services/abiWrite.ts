/**
 * ABI Entry write services — extracted from routes/abiDocuments.ts so both the
 * JWT app routes and the public API share one code path. Behavior is identical
 * to the original handlers; req/res-free (callers map the {httpStatus, body}
 * outcome to their response).
 *
 * NOTE: only the CREATE path lives here for now. The SEND path (which is
 * entangled with the polling subsystem) is extracted in a following increment.
 */
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import {
  prefillFromFiling,
  prefillFromManifestQuery,
  extractDenormFromPayload,
} from './abiDocumentMapper.js';
import { sanitizeErrorMessage } from './errorTranslator.js';
import { createABIDocumentSchema } from '../schemas/abiDocument.js';
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
