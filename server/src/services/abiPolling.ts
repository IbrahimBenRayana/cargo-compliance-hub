/**
 * ABI status polling — refreshes entry-summary / cargo-release statuses for a
 * sent ABI document against CC's list endpoint. Moved out of
 * routes/abiDocuments.ts so the send service (services/abiWrite.ts) and both
 * the /send + /poll routes share one implementation. Behavior is unchanged.
 */
import { prisma } from '../config/database.js';
import { abiGateway } from './abi/gateway.js';
import { notify } from './notifications.js';
import { emitWebhook } from './webhooks.js';
import logger from '../config/logger.js';
import { CC_POLL_INTERVAL_MS } from '../config/schedules.js';

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
 * call. Returns whether a terminal status was reached.
 */
export async function runSinglePoll(args: {
  docId: string;
  orgId: string;
  userId: string | null;
  entryType: '01' | '11';
  entryNumber: string | null;
  mbolNumber: string | null;
}): Promise<{ terminal: boolean }> {
  const { docId, orgId, userId, entryType, entryNumber, mbolNumber } = args;

  const { dateFrom, dateTo } = buildPollDateWindow();
  const result = await abiGateway.listABIDocuments({
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

    emitWebhook(orgId, nextStatus === 'ACCEPTED' ? 'entry.accepted' : 'entry.rejected', {
      abiDocumentId: docId,
      entryNumber: ccEntryNumber || entryNumber,
      entryType,
      mbolNumber,
    });
  }

  return { terminal: !!nextStatus };
}

/**
 * Fire-and-forget poller (mirrors manifestQuery.ts): 10 attempts × interval.
 */
export async function pollABIDocumentStatus(
  docId: string,
  orgId: string,
  entryType: '01' | '11',
  entryNumber: string | null,
  mbolNumber: string | null
): Promise<void> {
  const MAX_ATTEMPTS = 10;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, CC_POLL_INTERVAL_MS));

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
