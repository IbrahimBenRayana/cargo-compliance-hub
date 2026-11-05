/**
 * Apply CBP's entry responses (native go-live 4.2; audit D5).
 *
 * AX settles the entry summary (only for the transmission still pending);
 * SX settles the certified cargo release, and only counts for a summary CBP
 * accepted. CBP answers the two separately and in no promised order, so an SX
 * for a summary still in flight waits on its stored inbound row until the AX:
 * accepted, it applies then; rejected, it is never applied. An SX for any
 * other summary is logged and ignored. The entry's status is derived from
 * both (entryLifecycle). Notification, webhook and billing fire only on the
 * transition into ACCEPTED or REJECTED, and billing is idempotent at the
 * database, so duplicate or late responses change nothing twice.
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

interface AcceptedEntryVersion { payload: Prisma.InputJsonValue; releaseRequested: boolean; transmissionId?: string }
type VerdictOpts = { docId: string; transmissionId: string; summary: ResponseSummary };

/** Whether the summary CBP holds for this entry is the one this transmission sent. */
function holdsSummary(
  doc: { cbpState: string; pendingAction: string | null; lastTransmissionId: string | null; acceptedVersion: unknown },
  transmissionId: string,
): boolean {
  if (doc.cbpState !== 'ON_FILE') return false;
  const held = (doc.acceptedVersion as AcceptedEntryVersion | null)?.transmissionId;
  // Accepted before versions recorded their transmission: the latest settled one.
  return held ? held === transmissionId : doc.lastTransmissionId === transmissionId && !doc.pendingAction;
}

export async function applyEntryVerdict(opts: VerdictOpts): Promise<void> {
  const summaryAccepted = await settleVerdict(opts);
  // CBP may have answered the release first; it counts now the summary does.
  if (summaryAccepted) await applyStoredRelease(opts.docId, opts.transmissionId);
}

/** Apply CBP's latest stored release verdict for this transmission, if there is one. */
export async function applyStoredRelease(docId: string, transmissionId: string): Promise<void> {
  const stored = await prisma.cbpInboundMessage.findMany({
    where: { transmissionId, application: 'SX' },
    orderBy: { receivedAt: 'desc' },
    select: { parsed: true },
  });
  const latest = stored.map((m) => m.parsed as unknown as ResponseSummary | null).find((s) => s?.verdict === 'ACCEPTED' || s?.verdict === 'REJECTED');
  if (latest) await settleVerdict({ docId, transmissionId, summary: latest });
}

/** Returns true when this call put a newly accepted summary on file. */
async function settleVerdict(opts: VerdictOpts, retry = true): Promise<boolean> {
  const { summary } = opts;
  if (summary.verdict !== 'ACCEPTED' && summary.verdict !== 'REJECTED') return false;
  const isRelease = summary.application === 'SX';
  if (!isRelease && summary.application !== 'AX') return false;

  const doc = await prisma.abiDocument.findUnique({ where: { id: opts.docId } });
  if (!doc) return false;
  const reason = summary.verdict === 'REJECTED'
    ? JSON.stringify({ summary: summary.narrative ?? 'Rejected by CBP', errors: summary.conditions })
    : null;

  if (isRelease) {
    if (doc.pendingAction && doc.lastTransmissionId === opts.transmissionId) return false;
    if (!holdsSummary(doc, opts.transmissionId)) {
      logger.warn({ docId: doc.id, transmissionId: opts.transmissionId, verdict: summary.verdict }, '[CBP] Cargo release response for a summary CBP does not hold; ignored');
      return false;
    }
    if (doc.cargoReleaseStatus === summary.verdict && (!reason || doc.lastError === reason)) return false;
  } else if (doc.lastTransmissionId !== opts.transmissionId || !doc.pendingAction) {
    // The summary verdict only counts while that transaction is pending.
    return false;
  }

  const rejectedReplace = !isRelease && summary.verdict === 'REJECTED' && doc.pendingAction === 'REPLACE';
  const fallback = rejectedReplace ? (doc.acceptedVersion as unknown as AcceptedEntryVersion | null) : null;
  if (rejectedReplace && !fallback) {
    logger.warn({ docId: doc.id }, '[CBP] Rejected replace of an entry with no accepted version on record; its data was left as sent');
  }
  const acceptedSummary = !isRelease && summary.verdict === 'ACCEPTED' && doc.pendingAction !== 'DELETE';

  const settling = fallback ? { ...doc, releaseRequested: fallback.releaseRequested } : doc;
  const next = isRelease ? entryStateOnReleaseVerdict(doc, summary.verdict) : entryStateOnSummaryVerdict(settling, summary.verdict);

  const claimed = await prisma.abiDocument.updateMany({
    where: { id: doc.id, lastTransmissionId: doc.lastTransmissionId, pendingAction: doc.pendingAction, ...(isRelease && { cargoReleaseStatus: doc.cargoReleaseStatus }) },
    data: {
      status: next.status,
      cargoReleaseStatus: next.cargoReleaseStatus,
      respondedAt: new Date(),
      ...(!isRelease && { cbpState: next.cbpState, pendingAction: next.pendingAction, entrySummaryStatus: next.entrySummaryStatus }),
      ...(reason && { lastError: reason }),
      ...(fallback && {
        payload: fallback.payload,
        ...extractDenormFromPayload(fallback.payload),
        releaseRequested: fallback.releaseRequested,
        // Resending what CBP holds carries no edits; keep the ones already saved.
        ...(!isDeepStrictEqual(doc.payload, fallback.payload) && { rejectedPayload: doc.payload as Prisma.InputJsonValue }),
      }),
      ...(acceptedSummary && {
        acceptedVersion: { payload: doc.payload, releaseRequested: doc.releaseRequested, transmissionId: opts.transmissionId } as Prisma.InputJsonValue,
        rejectedPayload: Prisma.DbNull,
      }),
    },
  });
  if (claimed.count === 0) {
    // A release is not spent by losing the race: the row moved, so judge it again.
    return isRelease && retry ? settleVerdict(opts, false) : false;
  }

  const becameTerminal = next.status !== doc.status && (next.status === 'ACCEPTED' || next.status === 'REJECTED');
  const refusedChange = !isRelease && summary.verdict === 'REJECTED' && doc.pendingAction !== 'ADD'
    ? (doc.pendingAction === 'REPLACE' ? 'Replace' : 'Delete')
    : null;
  if (!becameTerminal && !refusedChange) return acceptedSummary;

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
  return acceptedSummary;
}
