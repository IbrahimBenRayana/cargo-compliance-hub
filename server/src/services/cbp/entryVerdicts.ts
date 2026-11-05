/**
 * Apply CBP's entry responses (native go-live 4.2; audit D5).
 *
 * AX settles the entry summary (only for the transmission still pending);
 * SX settles the certified cargo release. The entry's status is derived
 * from both (entryLifecycle). Notification, webhook and billing fire only
 * on the transition into ACCEPTED or REJECTED, and billing is idempotent at
 * the database, so duplicate or late responses change nothing twice.
 *
 * A rejected replace or delete is the exception: the entry keeps its status
 * because the accepted summary stays on file, but people still hear that CBP
 * refused the change, in those words, and never that the entry was accepted.
 *
 * The entry's payload can hold unsent edits, so each accepted summary is kept
 * as acceptedVersion. A rejected replace falls back to it and keeps the edits
 * in rejectedPayload to fix and resend.
 */
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { notify } from '../notifications.js';
import { emitWebhook } from '../webhooks.js';
import { billShipment } from '../shipmentBilling.js';
import { extractDenormFromPayload } from '../abiDocumentMapper.js';
import { entryStateOnReleaseVerdict, entryStateOnSummaryVerdict } from './entryLifecycle.js';
import type { ResponseSummary } from './responses.js';

interface AcceptedEntryVersion { payload: Prisma.InputJsonValue; releaseRequested: boolean }

export async function applyEntryVerdict(opts: { docId: string; transmissionId: string; summary: ResponseSummary }): Promise<void> {
  const { summary } = opts;
  if (summary.verdict !== 'ACCEPTED' && summary.verdict !== 'REJECTED') return;
  const isRelease = summary.application === 'SX';
  if (!isRelease && summary.application !== 'AX') return;

  const doc = await prisma.abiDocument.findUnique({ where: { id: opts.docId } });
  if (!doc || doc.lastTransmissionId !== opts.transmissionId) return;
  // The summary verdict only counts while that transaction is pending.
  if (!isRelease && !doc.pendingAction) return;

  const rejectedReplace = !isRelease && summary.verdict === 'REJECTED' && doc.pendingAction === 'REPLACE';
  const fallback = rejectedReplace ? (doc.acceptedVersion as unknown as AcceptedEntryVersion | null) : null;
  if (rejectedReplace && !fallback) {
    logger.warn({ docId: doc.id }, '[CBP] Rejected replace of an entry with no accepted version on record; its data was left as sent');
  }
  const acceptedSummary = !isRelease && summary.verdict === 'ACCEPTED' && doc.pendingAction !== 'DELETE';

  const settling = fallback ? { ...doc, releaseRequested: fallback.releaseRequested } : doc;
  const next = isRelease ? entryStateOnReleaseVerdict(doc, summary.verdict) : entryStateOnSummaryVerdict(settling, summary.verdict);
  const reason = summary.verdict === 'REJECTED'
    ? JSON.stringify({ summary: summary.narrative ?? 'Rejected by CBP', errors: summary.conditions })
    : null;

  const claimed = await prisma.abiDocument.updateMany({
    where: isRelease
      ? { id: doc.id, lastTransmissionId: opts.transmissionId, cargoReleaseStatus: doc.cargoReleaseStatus }
      : { id: doc.id, lastTransmissionId: opts.transmissionId, pendingAction: doc.pendingAction },
    data: {
      status: next.status,
      cbpState: next.cbpState,
      pendingAction: next.pendingAction,
      entrySummaryStatus: next.entrySummaryStatus,
      cargoReleaseStatus: next.cargoReleaseStatus,
      respondedAt: new Date(),
      ...(reason && { lastError: reason }),
      ...(fallback && {
        payload: fallback.payload,
        ...extractDenormFromPayload(fallback.payload),
        releaseRequested: fallback.releaseRequested,
        // Resending what CBP holds carries no edits; keep the ones already saved.
        ...(!isDeepStrictEqual(doc.payload, fallback.payload) && { rejectedPayload: doc.payload as Prisma.InputJsonValue }),
      }),
      ...(acceptedSummary && {
        acceptedVersion: { payload: doc.payload, releaseRequested: doc.releaseRequested } as Prisma.InputJsonValue,
        rejectedPayload: Prisma.DbNull,
      }),
    },
  });
  if (claimed.count === 0) return;

  const becameTerminal = next.status !== doc.status && (next.status === 'ACCEPTED' || next.status === 'REJECTED');
  const refusedChange = !isRelease && summary.verdict === 'REJECTED' && doc.pendingAction !== 'ADD'
    ? (doc.pendingAction === 'REPLACE' ? 'Replace' : 'Delete')
    : null;
  if (!becameTerminal && !refusedChange) return;

  const ref = doc.entryNumber || doc.mbolNumber || doc.id.slice(0, 8);
  const accepted = next.status === 'ACCEPTED' && !refusedChange;
  const reasons = summary.conditions.map((c) => c.narrative).join('; ') || summary.narrative || 'see details';
  await notify({
    kind: accepted ? 'entry_accepted' : 'entry_rejected',
    audience: { orgId: doc.orgId, roles: ['OPERATOR', 'ADMIN', 'OWNER'] },
    title: refusedChange ? `Entry ${refusedChange} Rejected by CBP` : accepted ? 'Entry Accepted by CBP' : 'Entry Rejected by CBP',
    message: refusedChange
      ? `CBP rejected the ${refusedChange.toLowerCase()} of entry ${ref}: ${reasons}. The accepted entry stays on file at CBP, so the change is not in effect.`
      : accepted
        ? `Entry ${ref} has been accepted by CBP.`
        : `Entry ${ref} was rejected by CBP: ${reasons}.`,
    linkUrl: `/abi-documents/${doc.id}`,
    metadata: { entryNumber: ref, entryType: doc.entryType, mbolNumber: doc.mbolNumber },
    abiDocumentId: doc.id,
    dedupeKey: `abi_${doc.id}_${opts.transmissionId}_${accepted ? 'accepted' : 'rejected'}`,
  });
  emitWebhook(doc.orgId, accepted ? 'entry.accepted' : 'entry.rejected', {
    abiDocumentId: doc.id, entryNumber: doc.entryNumber, entryType: doc.entryType, mbolNumber: doc.mbolNumber,
    ...(refusedChange && { action: doc.pendingAction, onFile: true }),
  });
  if (becameTerminal && next.status === 'ACCEPTED') {
    // Priced by what was filed: shipmentBilling reads the entry's ISF link itself.
    await billShipment({ abiDocumentId: doc.id }, doc.orgId);
  }
}
