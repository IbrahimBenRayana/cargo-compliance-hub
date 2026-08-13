/**
 * Phase-5 shadow run — cutover evidence for the native ABI engine.
 *
 * After every successful CustomsCity submission, generate the equivalent
 * native CATAIR transmission from the SAME document payload and store it
 * on the document: migrate (v1→v2) → duty engine (ingested USITC rates) →
 * client-side validation → builder. The stored wire + note become the
 * side-by-side record that de-risks the eventual CC→native flag flip.
 *
 * This function NEVER throws and never mutates anything except the two
 * shadow columns — a shadow failure is itself useful evidence (the note
 * says exactly which document shapes the native path can't express yet).
 */
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { migrateV1ToV2 } from '../abi-engine/payload/migrateV1.js';
import type { AbiDocumentBody } from './abi/types.js';
import { enrichWithDuty } from '../abi-engine/duty/engine.js';
import { DbHtsRateSource } from '../abi-engine/refdata/dbRateSource.js';
import { toAeEntrySummaryInput } from '../abi-engine/payload/toAeInput.js';
import { validateEntrySummary } from '../abi-engine/validate/entrySummary.js';
import { buildEntrySummary } from '../abi-engine/ae/builder.js';
import { RecordCodecError } from '../abi-engine/records/codec.js';

function describeError(err: unknown): string {
  if (err instanceof RecordCodecError) {
    return err.issues.map((i) => `${i.record}.${i.field}: ${i.message}`).join('\n');
  }
  return err instanceof Error ? err.message : String(err);
}

export async function captureNativeShadow(documentId: string): Promise<void> {
  let note = '';
  let wireText: string | null = null;
  try {
    const doc = await prisma.abiDocument.findUnique({ where: { id: documentId } });
    if (!doc) return;

    const now = new Date();
    const applicabilityDate = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;

    const payload = migrateV1ToV2(doc.payload as unknown as AbiDocumentBody);
    const priced = await enrichWithDuty(payload, new DbHtsRateSource(prisma.htsRateLine), {
      applicabilityDate,
    });
    const input = toAeEntrySummaryInput(priced, 'A');
    const issues = validateEntrySummary(input);
    const lines = buildEntrySummary(input);
    wireText = lines.join('\n');
    note =
      issues.length === 0
        ? 'ok'
        : `built with ${issues.length} validation issue(s):\n${issues.map((i) => `${i.field}: ${i.message}`).join('\n')}`;
  } catch (err) {
    note = `shadow failed: ${describeError(err)}`;
  }

  try {
    await prisma.abiDocument.update({
      where: { id: documentId },
      data: { nativeWireText: wireText, nativeShadowNote: note.slice(0, 10_000) },
    });
    logger.info(
      { documentId, ok: wireText !== null },
      `[AbiShadow] native shadow ${wireText !== null ? 'captured' : 'recorded failure'}`
    );
  } catch (err) {
    // Even the bookkeeping write is best-effort.
    logger.warn({ documentId, err: describeError(err) }, '[AbiShadow] failed to store shadow result');
  }
}
