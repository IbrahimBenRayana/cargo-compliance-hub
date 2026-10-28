/**
 * Importer Security Filing response (SN) and Status Advisory (SA) parsers.
 *
 * SN response (ISF chapter, July 2017 v3, output usage map ISF-10..12):
 * within a response block each ISF Grouping opens with the echoed SF10 and
 * closes with a message-level SF90. CBP echoes the SF10, SF15(s) and
 * SF20(s) unconditionally; SF25/SF30/SF31/SF35/SF36/SF40/SF50 come back
 * only when in error. Every record in error is immediately followed by one
 * or more record-level SF90s (message types 11/13); the final SF90
 * (message types 01/02/03) carries the filing disposition (ISF-39).
 *
 * SA status advisory (supplement, August 2016 v1): SA10 (transaction
 * number), optional SA20 (CR reference), then 1-999 SA30/SA50 loops
 * pairing a bill number with a disposition code (SA-5..8).
 */
import { parseRecord, type RecordDef } from '../records/codec.js';
import { parseBatch, type ParsedCondition } from '../envelope/batch.js';
import { SF10, SF13, SF15, SF20, SF25, SF30, SF31, SF35, SF36, SF40, SF50, SF90, SA10, SA20, SA30, SA50, SF90_MESSAGE_TYPES, SA_DISPOSITION_CODES } from './recordDefs.js';

// ── SN response ────────────────────────────────────────────

export interface IsfRecordError {
  /** 11 = Record Rejected, 13 = Record Accepted with Warning (ISF-39). */
  messageTypeCode: string;
  errorCode?: string;
  narrative: string;
}

export interface IsfEchoedRecord {
  /** Control identifier of the echoed input record, e.g. 'SF15'. */
  recordId: string;
  raw: string;
  /** Field values parsed with the input record def. */
  values: Record<string, string>;
  /** Record-level SF90s (message types 11/13) that followed this record. */
  errors: IsfRecordError[];
}

export interface IsfDisposition {
  /** 01 = rejected, 02 = accepted, 03 = accepted with warning(s). */
  messageTypeCode: string;
  accepted: boolean;
  narrative: string;
  /** Meaning from the SF90 message-type table. */
  meaning?: string;
}

export interface IsfResponse {
  /** CBP-assigned FFF-NNNNNNNNNNN from the echoed SF10 (ISF-19 Note 5). */
  isfTransactionNumber?: string;
  /** Echoed submission records in wire order, with attached errors. */
  echoedRecords: IsfEchoedRecord[];
  /** Record-level SF90s seen before any echoed record (should not occur). */
  unattachedErrors: IsfRecordError[];
  /** Message-level SF90 (types 01/02/03) closing the ISF grouping. */
  disposition?: IsfDisposition;
  /** True when the disposition message type is 02 or 03. */
  accepted: boolean;
}

const ECHOED_RECORD_DEFS: Record<string, RecordDef> = {
  SF10, SF13, SF15, SF20, SF25, SF30, SF31, SF35, SF36, SF40, SF50,
};

/**
 * Parse the SF lines of an SN response (the transaction lines of a
 * response block) into per-filing results. Each SF10 starts a new ISF
 * grouping (the input map allows up to 999 groupings per block, ISF-7).
 */
export function parseIsfResponse(lines: string[]): IsfResponse[] {
  const responses: IsfResponse[] = [];
  let current: IsfResponse | null = null;
  let lastRecord: IsfEchoedRecord | null = null;

  const ensureCurrent = (): IsfResponse => {
    if (!current) {
      current = { echoedRecords: [], unattachedErrors: [], accepted: false };
      responses.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 4);
    if (id === 'SF90') {
      const rec = parseRecord(SF90, line);
      const messageTypeCode = rec.values.messageTypeCode ?? '';
      if (messageTypeCode === '11' || messageTypeCode === '13') {
        const error: IsfRecordError = {
          messageTypeCode,
          errorCode: rec.values.errorCode,
          narrative: rec.values.narrativeMessageText ?? '',
        };
        if (lastRecord) lastRecord.errors.push(error);
        else ensureCurrent().unattachedErrors.push(error);
      } else {
        // Message-level SF90 (01/02/03) — the filing disposition (ISF-12
        // Note 5). It closes the grouping; a following SF10 starts a new one.
        const response = ensureCurrent();
        response.disposition = {
          messageTypeCode,
          accepted: messageTypeCode === '02' || messageTypeCode === '03',
          narrative: rec.values.narrativeMessageText ?? '',
          meaning: SF90_MESSAGE_TYPES[messageTypeCode],
        };
        response.accepted = response.disposition.accepted;
        lastRecord = null;
      }
      continue;
    }

    const def = ECHOED_RECORD_DEFS[id];
    if (!def) continue; // non-ISF lines are ignored
    if (id === 'SF10') {
      const rec = parseRecord(SF10, line);
      current = {
        isfTransactionNumber: rec.values.isfTransactionNumber,
        echoedRecords: [],
        unattachedErrors: [],
        accepted: false,
      };
      responses.push(current);
      lastRecord = { recordId: id, raw: line.padEnd(80, ' '), values: rec.values, errors: [] };
      current.echoedRecords.push(lastRecord);
    } else {
      const rec = parseRecord(def, line);
      lastRecord = { recordId: id, raw: line.padEnd(80, ' '), values: rec.values, errors: [] };
      ensureCurrent().echoedRecords.push(lastRecord);
    }
  }

  return responses;
}

export interface IsfResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ParsedCondition[];
  filings: IsfResponse[];
}

/** Parse a complete SN wire response (A/B…Y/Z envelope included). */
export function parseIsfResponseBatch(lines: string[]): IsfResponseBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    filings: batch.blocks.flatMap((b) => parseIsfResponse(b.transactionLines)),
  };
}

// ── SA status advisory ─────────────────────────────────────

export interface IsfBillStatus {
  /**
   * SA30 bill number. The SA-7 layout defines positions 5-20 as 16AN
   * (4-char SCAC + 12-char sequence), but the supplement's printed
   * examples (SA-9) show a 2-char bill-type token before the SCAC, e.g.
   * 'SA30HBSC999999999999' / 'SA30OBSC777777777777'. We parse tolerantly:
   * a leading HB/OB is split off into billType, the remainder is the bill
   * number. A genuine bill whose SCAC begins with HB/OB would be
   * mis-split; the layout and examples cannot both be satisfied.
   */
  billNumber: string;
  /** HB (house) or OB (regular), when the leading token is present. */
  billType?: 'HB' | 'OB';
  /** S1-S7 / SA / SB / SC (Appendix N; SA-3). */
  dispositionCode: string;
  /** Narrative remarks from the SA50 record. */
  remarks: string;
  /** Meaning from the disposition-code table, when known. */
  meaning?: string;
}

export interface IsfStatusAdvisory {
  /** CBP-assigned FFF-NNNNNNNNNNN from the SA10 record (SA-5). */
  isfTransactionNumber?: string;
  /** SA20 CR user-defined reference, echoed when provided on input (SA-6). */
  reference?: { qualifier: string; value: string };
  /** SA30/SA50 loops (1-999 per the SA-7/8 loop definition). */
  bills: IsfBillStatus[];
}

function splitBillNumber(raw: string): Pick<IsfBillStatus, 'billNumber' | 'billType'> {
  const match = /^(HB|OB)(.+)$/.exec(raw);
  if (match) return { billType: match[1] as 'HB' | 'OB', billNumber: match[2] };
  return { billNumber: raw };
}

/**
 * Parse the SA lines of a status-advisory block. Each SA10 starts a new
 * advisory ("one SA transaction will occur for each bill of lading", SA-7).
 */
export function parseIsfStatusAdvisory(lines: string[]): IsfStatusAdvisory[] {
  const advisories: IsfStatusAdvisory[] = [];
  let current: IsfStatusAdvisory | null = null;
  let pendingBill: Pick<IsfBillStatus, 'billNumber' | 'billType'> | null = null;

  const ensureCurrent = (): IsfStatusAdvisory => {
    if (!current) {
      current = { bills: [] };
      advisories.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 4);
    if (id === 'SA10') {
      const rec = parseRecord(SA10, line);
      current = { isfTransactionNumber: rec.values.isfTransactionNumber, bills: [] };
      advisories.push(current);
      pendingBill = null;
    } else if (id === 'SA20') {
      const rec = parseRecord(SA20, line);
      ensureCurrent().reference = {
        qualifier: rec.values.codeQualifier ?? '',
        value: rec.values.referenceData ?? '',
      };
    } else if (id === 'SA30') {
      const rec = parseRecord(SA30, line);
      pendingBill = splitBillNumber(rec.values.billNumber ?? '');
    } else if (id === 'SA50') {
      const rec = parseRecord(SA50, line);
      const dispositionCode = rec.values.dispositionCode ?? '';
      ensureCurrent().bills.push({
        billNumber: pendingBill?.billNumber ?? '',
        billType: pendingBill?.billType,
        dispositionCode,
        remarks: rec.values.remarks ?? '',
        meaning: SA_DISPOSITION_CODES[dispositionCode],
      });
      pendingBill = null;
    }
  }

  return advisories;
}

export interface IsfStatusAdvisoryBatch {
  batchRejected: boolean;
  envelopeConditions: ParsedCondition[];
  advisories: IsfStatusAdvisory[];
}

/** Parse a complete SA wire notification (A/B…Y/Z envelope included). */
export function parseIsfStatusAdvisoryBatch(lines: string[]): IsfStatusAdvisoryBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    advisories: batch.blocks.flatMap((b) => parseIsfStatusAdvisory(b.transactionLines)),
  };
}
