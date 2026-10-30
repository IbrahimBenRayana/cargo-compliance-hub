/**
 * Dispatcher handlers for native filings (native go-live D3).
 *
 * taggedTransmissionHandler: CBP echoes our B-record user data ("MCL" +
 * transmission id), so a tagged response settles exactly that transmission
 * (status, respondedAt, and any key CBP assigned, e.g. the ISF transaction
 * number). Informational messages never change status.
 *
 * businessKeyHandler: unsolicited messages carry no tag (ISF SA advisories,
 * cargo release SO, UC notifications). They are matched to the latest
 * transmission CBP could have seen with the same ISF transaction or entry
 * number, without changing its status; the filing-level verdict logic decides
 * what they mean.
 */
import { prisma } from '../../config/database.js';
import type { InboundHandler } from './dispatcher.js';
import { summarizeResponse } from './responses.js';
import { applyIsfVerdict } from './isfVerdicts.js';
import { applyEntryVerdict } from './entryVerdicts.js';

export const taggedTransmissionHandler: InboundHandler = async (row) => {
  if (!row.userDataTag?.startsWith('MCL')) return null;
  const tx = await prisma.cbpTransmission.findUnique({ where: { userDataTag: row.userDataTag } });
  if (!tx) return null;
  const summary = summarizeResponse(row.application, row.lines);
  if (summary.verdict !== 'INFO') {
    await prisma.cbpTransmission.update({
      where: { id: tx.id },
      data: {
        status: summary.verdict,
        respondedAt: new Date(),
        isfTransactionNumber: tx.isfTransactionNumber ?? summary.keys.isfTransactionNumber,
        entryNumber: tx.entryNumber ?? summary.keys.entryNumber,
      },
    });
    // The filing itself follows CBP's verdict (status, notify, webhook, billing).
    if (tx.entityType === 'filing' && tx.entityId) {
      await applyIsfVerdict({ filingId: tx.entityId, transmissionId: tx.id, filerCode: tx.filerCode, summary });
    }
    if (tx.entityType === 'abi_document' && tx.entityId) {
      await applyEntryVerdict({ docId: tx.entityId, transmissionId: tx.id, summary });
    }
  }
  return {
    entityType: tx.entityType ?? 'cbp_transmission',
    entityId: tx.entityId ?? tx.id,
    transmissionId: tx.id,
    parsed: summary,
  };
};

export const businessKeyHandler: InboundHandler = async (row) => {
  const summary = summarizeResponse(row.application, row.lines);
  const { isfTransactionNumber, entryNumber } = summary.keys;
  if (!isfTransactionNumber && !entryNumber) return null;
  const tx = await prisma.cbpTransmission.findFirst({
    where: isfTransactionNumber
      ? { isfTransactionNumber, environment: row.environment, status: { not: 'FAILED' } }
      : { entryNumber, environment: row.environment, status: { not: 'FAILED' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!tx) return null;
  // A cargo release response (SX) may come without our tag: it settles the
  // entry's release by entry number. Other unsolicited messages are recorded only.
  if (summary.application === 'SX' && tx.entityType === 'abi_document' && tx.entityId) {
    await applyEntryVerdict({ docId: tx.entityId, transmissionId: tx.id, summary });
  }
  return {
    entityType: tx.entityType ?? 'cbp_transmission',
    entityId: tx.entityId ?? tx.id,
    transmissionId: tx.id,
    parsed: summary,
  };
};
