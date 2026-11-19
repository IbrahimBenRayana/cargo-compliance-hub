/**
 * Apply CBP's verdict to a native ISF (native go-live 3.4; audit D5).
 *
 * The one place a CBP ISF outcome changes the filing: state (via
 * isfLifecycle), CBP's transaction number, rejection detail in CBP's own
 * words, history, notification + webhook, and billing. Exactly once: the
 * update claims the filing only while that transaction is still pending, so
 * a duplicate, late or stale response changes nothing and fires nothing.
 * Only the first accepted ADD bills the shipment.
 */
import { prisma } from '../../config/database.js';
import { notifyFilingAccepted, notifyFilingChangeRejected, notifyFilingRejected } from '../notifications.js';
import { billShipmentForFiling } from '../shipmentBilling.js';
import { recordScoreSnapshot, triggerForStatus } from '../compliance/scoreSnapshot.js';
import { isfStateOnVerdict } from './isfLifecycle.js';
import type { ResponseSummary } from './responses.js';

export async function applyIsfVerdict(opts: {
  filingId: string;
  transmissionId: string;
  filerCode: string;
  summary: ResponseSummary;
}): Promise<void> {
  const { summary } = opts;
  if (summary.verdict !== 'ACCEPTED' && summary.verdict !== 'REJECTED') return;

  const filing = await prisma.filing.findUnique({ where: { id: opts.filingId } });
  if (!filing || !filing.pendingAction || filing.lastTransmissionId !== opts.transmissionId) return;

  const action = filing.pendingAction;
  const next = isfStateOnVerdict(filing, summary.verdict);
  const now = new Date();
  const accepted = summary.verdict === 'ACCEPTED';
  const rejectionReason = accepted
    ? null
    : JSON.stringify({
        summary: summary.narrative ?? 'Rejected by CBP',
        errors: summary.conditions.map((c) => ({ code: c.code, narrative: c.narrative, explanation: c.explanation, blocking: c.blocking })),
      });

  const committed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.filing.updateMany({
      where: { id: filing.id, pendingAction: action, lastTransmissionId: opts.transmissionId },
      data: {
        status: next.status,
        cbpState: next.cbpState,
        pendingAction: null,
        ...(action === 'ADD' && accepted && {
          cbpTransactionId: summary.keys.isfTransactionNumber ?? filing.cbpTransactionId,
          isfFilerCode: opts.filerCode,
          acceptedAt: now,
          rejectedAt: null,
          rejectionReason: null,
        }),
        ...(!accepted && { rejectedAt: now, rejectionReason }),
        ...(action === 'REPLACE' && accepted && { amendedAt: now }),
        ...(action === 'DELETE' && accepted && { cancelledAt: now }),
      },
    });
    if (claimed.count === 0) return false;
    await tx.filingStatusHistory.create({
      data: {
        filingId: filing.id,
        status: next.status,
        message: `${action === 'ADD' ? 'ISF' : action === 'REPLACE' ? 'ISF replace' : 'ISF delete'} ${accepted ? 'accepted' : 'rejected'} by CBP` +
          (summary.keys.isfTransactionNumber ? ` (ISF Txn: ${summary.keys.isfTransactionNumber})` : '') +
          (!accepted && summary.conditions.length ? `: ${summary.conditions.map((c) => c.narrative).join('; ')}` : ''),
        ccResponse: { native: true, transmissionId: opts.transmissionId, summary } as never,
        changedById: filing.createdById,
      },
    });
    return true;
  });
  if (!committed) return;

  await recordScoreSnapshot(filing.id, triggerForStatus(next.status));
  const bol = filing.houseBol || filing.masterBol || filing.id.slice(0, 8);
  if (accepted) {
    await notifyFilingAccepted(filing.orgId, filing.id, bol);
    if (action === 'ADD') await billShipmentForFiling(filing.id, filing.orgId);
  } else {
    const reason = summary.conditions.map((c) => c.narrative).join('; ') || summary.narrative;
    // A rejected replace or delete leaves the filing accepted, so it never
    // shows up as a rejection; the notification has to carry it.
    if (action === 'ADD') await notifyFilingRejected(filing.orgId, filing.id, bol, reason);
    else await notifyFilingChangeRejected(filing.orgId, filing.id, bol, action as 'REPLACE' | 'DELETE', reason);
  }
}
