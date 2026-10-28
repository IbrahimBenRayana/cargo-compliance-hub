/**
 * TIB response parsers.
 *
 * 1) TIB Extend/Close response (TX) — E0/E1 records per "Temporary
 *    Importation Bond / Extend Close", Jan 26 2018 rev 05, TIB-11..14.
 *    Each TRANSACTION grouping is one E0 condition reference, zero or more
 *    condition E1s, then a final-disposition E1 (A accepted / R rejected).
 *
 * 2) TIB Expiration Notice (TS) — X1 records per "Temporary Importation
 *    Bond / Expiration Notice", Jan 26 2018 rev 03, TS-9..11. Notification
 *    only; each transaction is a single X1 line.
 *
 * The TS batch walk here is deliberately NOT parseBatch(): the envelope
 * parser claims every X1 line as a Batch & Block condition record
 * (envelope/batch.ts), but inside a TS block an X1 line IS the notice.
 * The two X1 layouts are distinguished by position — envelope X1 carries a
 * condition code at 5-7; the notice carries the district/port at 3-6 — and
 * by context: notice X1s only occur between a B- and Y-record.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch, type ParsedCondition } from '../../envelope/batch.js';
import { OUTPUT_X1 as ENVELOPE_X1 } from '../../envelope/recordDefs.js';
import { CONDITION_CODES } from '../../envelope/conditionCodes.js';
import { OUTPUT_E0, OUTPUT_E1, OUTPUT_X1_NOTICE } from './recordDefs.js';

/** Valid E1 condition codes with narrative messages (Note 2, TIB-14). */
export const TIB_CONDITION_CODES: Record<string, string> = {
  '8VB': 'COMPUTER SITE INVALID FOR BLOCK',
  '8WA': 'NO ENTRY EXISTS',
  '8WI': 'TRANSACTION DATA REJECTED',
  '8WR': 'INVALID CONTROL ID / RECORD TYPE',
  '8XK': 'NO EXTENSION, ENTRY CANCLD/REJCTD',
  '8XM': 'EXTENSION PREV DENIED',
  '8XS': 'EXTENSION INVALID AFTER CLOSE DT',
  '8XT': 'SCHED CLOSE DT NOT WITHIN 60 DAYS',
  '8XU': 'ENTRY MUST BE IN CUSTOMS STATUS',
  '8XW': 'EXTENSION LIMIT REACHED',
  '8XX': 'CAN NOT EXTEND - 6 MONTH TIB',
  '8XY': "ENTRY TYPE MUST BE '23'",
  '8XZ': 'EXT-CLOSE REQ LATE, ENTRY CLOSED',
  '995': 'EXT GRANTED SUBJECT TO REVIEW',
  '996': 'CLOSURE REQ ACCEPTED',
  '998': 'TRANSACTION DATA REJECTED',
  '999': 'BATCH REJECTED',
};

// ── Extend/Close response (TX) ─────────────────────────────

export interface TibCondition {
  /** F fatal, W warning, I informational (Note 1, TIB-13). */
  severity: string;
  conditionCode: string;
  narrative: string;
}

export interface TibDisposition {
  /**
   * True on disposition A. Per Note 4 (TIB-14) acceptance is NOT final
   * relief: 995 extensions remain subject to CBP review and 996 closures
   * stay open until CBP reviews the supporting documentation.
   */
  accepted: boolean;
  conditionCode: string;
  narrative: string;
  /** Severity of the most severe condition found (space = clean accept). */
  severity: string;
  entryFilerCode?: string;
  entryNumber?: string;
  brokerReferenceNumber?: string;
}

export interface TibResponse {
  /** E0 reference type: SUMMRY (per-summary conditions) or BLOCK (TIB-12). */
  referenceType?: string;
  /** Relative position of the submitted XA detail (E0, TIB-12). */
  occurrence?: number;
  /** Identity echoed in the E0 reference fields (space filled when the input was not recognized, Note 1). */
  entryFilerCode?: string;
  entryNumber?: string;
  conditions: TibCondition[];
  disposition?: TibDisposition;
}

/**
 * Parse the E0/E1 lines of a TX response (the transaction lines of a
 * response block) into per-request results. Each E0 opens a new grouping
 * (structure map, TIB-11).
 */
export function parseTibResponse(lines: string[]): TibResponse[] {
  const responses: TibResponse[] = [];
  let current: TibResponse | null = null;

  const ensureCurrent = (): TibResponse => {
    if (!current) {
      current = { conditions: [] };
      responses.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === 'E0') {
      const rec = parseRecord(OUTPUT_E0, line);
      current = {
        referenceType: rec.values.referenceDataTypeCode,
        occurrence: Number(rec.values.occurrencePosition ?? '0'),
        entryFilerCode: rec.values.entryFilerCode,
        entryNumber: rec.values.entryNumber,
        conditions: [],
      };
      responses.push(current);
    } else if (id === 'E1') {
      const rec = parseRecord(OUTPUT_E1, line);
      const response = ensureCurrent();
      const code = rec.values.conditionCode ?? '';
      const narrative = rec.values.narrativeText ?? TIB_CONDITION_CODES[code] ?? '';
      const disposition = rec.values.dispositionTypeCode;
      if (disposition === 'A' || disposition === 'R') {
        response.disposition = {
          accepted: disposition === 'A',
          conditionCode: code,
          narrative,
          severity: rec.values.severityCode ?? '',
          entryFilerCode: rec.values.entryFilerCode,
          entryNumber: rec.values.entryNumber,
          brokerReferenceNumber: rec.values.brokerReferenceNumber,
        };
      } else {
        response.conditions.push({
          severity: rec.values.severityCode ?? '',
          conditionCode: code,
          narrative,
        });
      }
    }
    // Other line ids are not part of the TX transaction grouping (TIB-11).
  }

  return responses;
}

export interface TibResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (Batch & Block X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ParsedCondition[];
  responses: TibResponse[];
}

/** Parse a complete TX wire response (A/B…Y/Z envelope included). */
export function parseTibResponseBatch(lines: string[]): TibResponseBatch {
  const batch = parseBatch(lines);
  const responses = batch.blocks.flatMap((b) => parseTibResponse(b.transactionLines));
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    responses,
  };
}

// ── Expiration notice (TS) ─────────────────────────────────

export interface TibExpirationNotice {
  districtPortOfEntrySummary?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  importerOfRecordNumber?: string;
  /** MMDDYY (TS-10). */
  tibExpirationDate?: string;
  /** Total times this TIB summary has been extended (TS-10..11). */
  totalNumberOfExtensions?: number;
}

/** Parse TIB expiration notice X1 transaction lines (TS-10..11). */
export function parseTibExpirationNotices(lines: string[]): TibExpirationNotice[] {
  const notices: TibExpirationNotice[] = [];
  for (const line of lines) {
    if (line.slice(0, 2) !== 'X1') continue;
    const rec = parseRecord(OUTPUT_X1_NOTICE, line);
    notices.push({
      districtPortOfEntrySummary: rec.values.districtPortOfEntrySummary,
      entryFilerCode: rec.values.entryFilerCode,
      entryNumber: rec.values.entryNumber,
      importerOfRecordNumber: rec.values.importerOfRecordNumber,
      tibExpirationDate: rec.values.tibExpirationDate,
      totalNumberOfExtensions:
        rec.values.totalNumberOfExtensions !== undefined ? Number(rec.values.totalNumberOfExtensions) : undefined,
    });
  }
  return notices;
}

export interface TibExpirationNoticeBatch {
  /** True when ACE rejected the batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level Batch & Block X1 conditions found OUTSIDE any block. */
  envelopeConditions: ParsedCondition[];
  notices: TibExpirationNotice[];
}

/**
 * Parse a complete TS wire notification (A/B…Y/Z envelope included).
 * X1 lines between a B- and Y-record are TIB expiration notices; X1 lines
 * outside any block are Batch & Block envelope conditions (see module
 * header). Envelope X0 reference records are ignored — a notification
 * batch identifies its subject in the notice itself.
 */
export function parseTibExpirationNoticeBatch(lines: string[]): TibExpirationNoticeBatch {
  const result: TibExpirationNoticeBatch = { batchRejected: false, envelopeConditions: [], notices: [] };
  let inBlock = false;

  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const line = raw.padEnd(80, ' ');
    const id2 = line.slice(0, 2);
    if (id2 === 'X1') {
      if (inBlock) {
        result.notices.push(...parseTibExpirationNotices([line]));
      } else {
        const rec = parseRecord(ENVELOPE_X1, line);
        const code = rec.values.conditionCode ?? '';
        result.envelopeConditions.push({
          severity: rec.values.severity ?? '',
          conditionCode: code,
          narrative: rec.values.narrative ?? CONDITION_CODES[code] ?? '',
          finalDisposition: rec.values.dispositionType === 'R',
        });
        if (rec.values.dispositionType === 'R' || code === '999') result.batchRejected = true;
      }
    } else if (line[0] === 'B') {
      inBlock = true;
    } else if (line[0] === 'Y' || line[0] === 'Z') {
      inBlock = false;
    }
    // A-records and envelope X0 references carry nothing we surface here.
  }

  return result;
}
