/**
 * CBP transmissions that never got an answer (BUG-022).
 *
 * CBP answers within minutes; when it stays silent (typically a filer code
 * that isn't approved on our queue, or a lost message), the shipment used to
 * say "Submitted" forever while its ISF deadline ran out. A sent transmission
 * with no answer after NO_ANSWER_MINUTES is flagged once: the org is told
 * (bell + link) and operations is alerted. The transmission stays SENT, so a
 * late answer is still applied when it arrives.
 */
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { notify } from '../notifications.js';

export const NO_ANSWER_MINUTES = 20;

export function isOverdue(t: { status: string; sentAt: Date | string | null }, now: Date = new Date()): boolean {
  if (t.status !== 'SENT' || !t.sentAt) return false;
  return now.getTime() - new Date(t.sentAt).getTime() > NO_ANSWER_MINUTES * 60_000;
}

const WHAT: Record<string, string> = { SF: 'ISF', AE: 'entry summary', HP: 'cargo release' };

export async function flagUnansweredTransmissions(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - NO_ANSWER_MINUTES * 60_000);
  const rows = await prisma.cbpTransmission.findMany({
    where: { status: 'SENT', sentAt: { lt: cutoff }, orgId: { not: null } },
    select: { id: true, orgId: true, entityType: true, entityId: true, application: true, action: true, filerCode: true, sentAt: true },
    orderBy: { sentAt: 'asc' },
    take: 200,
  });

  let flagged = 0;
  for (const t of rows) {
    const dedupeKey = `cbp-no-answer:${t.id}`;
    if (await prisma.notification.findFirst({ where: { dedupeKey }, select: { id: true } })) continue;
    const isFiling = t.entityType === 'filing';
    const what = WHAT[t.application] ?? 'filing';
    const minutes = Math.round((now.getTime() - new Date(t.sentAt!).getTime()) / 60_000);
    await notify({
      kind: 'cbp_no_answer',
      audience: { orgId: t.orgId!, roles: ['OPERATOR'] },
      title: `No answer from CBP for your ${what}`,
      message:
        `Sent under filer code ${t.filerCode} ${minutes} minutes ago and CBP has not answered. ` +
        'If you file under your own filer code, check with your CBP client representative that our queue is approved for it. ' +
        'MyCargoLens support has been alerted.',
      linkUrl: isFiling ? `/shipments/${t.entityId}` : `/abi-documents/${t.entityId}`,
      ...(isFiling ? { filingId: t.entityId } : { abiDocumentId: t.entityId }),
      dedupeKey,
    });
    logger.error(
      { transmissionId: t.id, orgId: t.orgId, application: t.application, action: t.action, filerCode: t.filerCode, minutes },
      '[CBP] No answer from CBP for a transmission',
    );
    flagged++;
  }
  return flagged;
}
