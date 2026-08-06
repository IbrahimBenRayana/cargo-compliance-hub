/**
 * Entry Summary Response (AX) parser — Entry Summary Create/Update chapter,
 * July 2026, ESF-193..212.
 *
 * Within a response block, each submitted entry summary comes back as a
 * TRANSACTION grouping: an unconditional E0 signpost of type SUMMRY, then
 * zero or more (E0-reference group → E1-condition group) pairs, ending in a
 * final-disposition E1 (disposition type A = accepted, R = rejected). The
 * SUMMRY signpost's reference text carries the filer code, entry number,
 * broker reference, and CBP team number at fixed offsets (ESF-194).
 */
import { parseRecord } from '../records/codec.js';
import { parseBatch } from '../envelope/batch.js';
import { OUTPUT_E0, OUTPUT_E1 } from './responseDefs.js';

export interface AeReference {
  /** E0 reference data type, e.g. 'LINITM', 'TARIFF' (see REFERENCE_DATA_TYPES). */
  type: string;
  /** Relative position of the offending detail within its repeating group. */
  occurrence: number;
  /** Identifying data echoed from the submission. */
  text: string;
}

export interface AeCondition {
  /** F fatal, W census warning, P PGA warning, I informational. */
  severity: string;
  conditionCode: string;
  narrative: string;
  /** Signposts identifying which submitted grouping caused the condition. */
  references: AeReference[];
}

export interface AeDisposition {
  accepted: boolean;
  conditionCode: string;
  /** e.g. SUMMARY HAS BEEN ADDED / SUMMARY HAS BEEN REPLACED / TRANSACTION DATA REJECTED. */
  narrative: string;
  /** Severity of the most severe condition found (space = clean accept). */
  severity: string;
  entryFilerCode?: string;
  entryNumber?: string;
  /** 5-digit version (major 3 + minor 2), present on accepted add/replace. */
  versionNumber?: string;
  brokerReferenceNumber?: string;
}

export interface AeSummaryResponse {
  /** Identity echoed in the SUMMRY signpost. */
  entryFilerCode?: string;
  entryNumber?: string;
  brokerReferenceNumber?: string;
  cbpTeamNumber?: string;
  conditions: AeCondition[];
  disposition?: AeDisposition;
}

/** Split the SUMMRY signpost reference text per the ESF-194 offsets. */
function parseSummryReference(text: string): Pick<
  AeSummaryResponse,
  'entryFilerCode' | 'entryNumber' | 'brokerReferenceNumber' | 'cbpTeamNumber'
> {
  // referenceText occupies positions 26-80; offsets below are relative.
  const padded = text.padEnd(55, ' ');
  const pick = (from: number, to: number) => padded.slice(from, to).trim() || undefined;
  return {
    entryFilerCode: pick(0, 3), // pos 26-28
    entryNumber: pick(4, 12), // pos 30-37
    brokerReferenceNumber: pick(13, 25), // pos 39-50
    cbpTeamNumber: pick(26, 29), // pos 52-54
  };
}

/**
 * Parse the E0/E1 lines of an AX response (the transaction lines of a
 * response block) into per-summary results.
 */
export function parseAeResponse(lines: string[]): AeSummaryResponse[] {
  const summaries: AeSummaryResponse[] = [];
  let current: AeSummaryResponse | null = null;
  let refGroup: AeReference[] = [];
  let lastWasCondition = false;

  const ensureCurrent = (): AeSummaryResponse => {
    if (!current) {
      current = { conditions: [] };
      summaries.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === 'E0') {
      const rec = parseRecord(OUTPUT_E0, line);
      const type = rec.values.referenceDataTypeCode ?? '';
      const text = rec.values.referenceDataText ?? '';
      if (type === 'SUMMRY') {
        current = { ...parseSummryReference(text), conditions: [] };
        summaries.push(current);
        refGroup = [];
        lastWasCondition = false;
      } else {
        if (lastWasCondition) refGroup = [];
        refGroup.push({
          type,
          occurrence: Number(rec.values.occurrencePosition ?? '0'),
          text,
        });
        lastWasCondition = false;
      }
    } else if (id === 'E1') {
      const rec = parseRecord(OUTPUT_E1, line);
      const summary = ensureCurrent();
      const disposition = rec.values.dispositionTypeCode;
      if (disposition === 'A' || disposition === 'R') {
        summary.disposition = {
          accepted: disposition === 'A',
          conditionCode: rec.values.conditionCode ?? '',
          narrative: rec.values.narrativeText ?? '',
          severity: rec.values.severityCode ?? '',
          entryFilerCode: rec.values.entryFilerCode,
          entryNumber: rec.values.entryNumber,
          versionNumber: rec.values.versionNumber,
          brokerReferenceNumber: rec.values.brokerReferenceNumber,
        };
        refGroup = [];
        lastWasCondition = false;
      } else {
        summary.conditions.push({
          severity: rec.values.severityCode ?? '',
          conditionCode: rec.values.conditionCode ?? '',
          narrative: rec.values.narrativeText ?? '',
          references: [...refGroup],
        });
        lastWasCondition = true;
      }
    }
    // Non-E0/E1 lines (application-specific extras) are ignored here.
  }

  return summaries;
}

export interface AeResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  summaries: AeSummaryResponse[];
}

/** Parse a complete AX wire response (A/B…Y/Z envelope included). */
export function parseAeResponseBatch(lines: string[]): AeResponseBatch {
  const batch = parseBatch(lines);
  const summaries = batch.blocks.flatMap((b) => parseAeResponse(b.transactionLines));
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    summaries,
  };
}
