/**
 * Census Warning Query response (CL) parser — Census Warning Query chapter,
 * September 20, 2014, CWQ-8..9.
 *
 * A CL response block repeats the CJ2 output record once per unresolved
 * Census warning on each entry summary that met the query criteria. On an
 * error condition (no data on file, access not authorized, …) the entry
 * summary data fields are space filled and the condition code / narrative
 * fields are populated instead (CJ2 Notes 1 and 2).
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import { OUTPUT_CJ2 } from './cjRecordDefs.js';

export interface CjWarningRow {
  districtPortOfEntry?: string;
  /** MMDDYY date the entry summary was last accepted in ACE. */
  aceAcceptanceDate?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  lineItemIdentifier?: string;
  htsNumber?: string;
  /** Unresolved Census warning code on this line (Appendix H). */
  censusWarningCode?: string;
  /** Populated only on error / no-data / not-authorized rows (Note 2). */
  conditionCode?: string;
  narrative?: string;
}

/** Parse the CJ2 lines of a CL response (the transaction lines of a block). */
export function parseCjResponse(lines: string[]): CjWarningRow[] {
  const rows: CjWarningRow[] = [];
  for (const line of lines) {
    if (line.slice(0, 3) !== 'CJ2') continue;
    const rec = parseRecord(OUTPUT_CJ2, line);
    rows.push({
      districtPortOfEntry: rec.values.districtPortOfEntry,
      aceAcceptanceDate: rec.values.aceAcceptanceDate,
      entryFilerCode: rec.values.entryFilerCode,
      entryNumber: rec.values.entryNumber,
      lineItemIdentifier: rec.values.entrySummaryLineItemIdentifier,
      htsNumber: rec.values.htsNumber,
      censusWarningCode: rec.values.censusWarningCode,
      conditionCode: rec.values.conditionCode,
      narrative: rec.values.narrativeText,
    });
  }
  return rows;
}

export interface CjResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  rows: CjWarningRow[];
}

/** Parse a complete CL wire response (A/B…Y/Z envelope included). */
export function parseCjResponseBatch(lines: string[]): CjResponseBatch {
  const batch = parseBatch(lines);
  const rows = batch.blocks.flatMap((b) => parseCjResponse(b.transactionLines));
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    rows,
  };
}
