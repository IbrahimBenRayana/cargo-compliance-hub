/**
 * Census Warning Override response (CO) parser — Census Warning Override
 * chapter, May 19, 2008, CWO-9.
 *
 * A CO response block repeats the CW03 output record once per override
 * code / line item / entry summary submitted, each carrying a condition
 * code and narrative describing whether the override was performed or an
 * error condition exists.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import { OUTPUT_CW03 } from './cwRecordDefs.js';

export interface CwOverrideDisposition {
  entryFilerCode?: string;
  entryNumber?: string;
  lineItemIdentifier?: string;
  /** Census warning code that the override addressed. */
  censusWarningCode?: string;
  /** Override code that was applied (or attempted). */
  censusOverrideCode?: string;
  /** Disposition condition code for this override code (CWO-9). */
  conditionCode?: string;
  /** e.g. whether the override was performed or an error condition exists. */
  narrative?: string;
}

/** Parse the CW03 lines of a CO response (the transaction lines of a block). */
export function parseCwResponse(lines: string[]): CwOverrideDisposition[] {
  const dispositions: CwOverrideDisposition[] = [];
  for (const line of lines) {
    if (line.slice(0, 4) !== 'CW03') continue;
    const rec = parseRecord(OUTPUT_CW03, line);
    dispositions.push({
      entryFilerCode: rec.values.entryFilerCode,
      entryNumber: rec.values.entryNumber,
      lineItemIdentifier: rec.values.entrySummaryLineItemIdentifier,
      censusWarningCode: rec.values.censusWarningCode,
      censusOverrideCode: rec.values.censusOverrideCode,
      conditionCode: rec.values.conditionCode,
      narrative: rec.values.narrativeText,
    });
  }
  return dispositions;
}

export interface CwResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  dispositions: CwOverrideDisposition[];
}

/** Parse a complete CO wire response (A/B…Y/Z envelope included). */
export function parseCwResponseBatch(lines: string[]): CwResponseBatch {
  const batch = parseBatch(lines);
  const dispositions = batch.blocks.flatMap((b) => parseCwResponse(b.transactionLines));
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    dispositions,
  };
}
