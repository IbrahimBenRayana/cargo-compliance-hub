/**
 * Entry Summary Query (EQ) transaction builder — "Entry Summary Query"
 * chapter, V26 May 2026 (docs/abi-engine/specs/entry-summary/es-query-v26-2026-05.pdf).
 *
 * Builds the transaction lines of one Entry Summary Query grouping (optional
 * J0, then J1-records OR a single J2-record, per the input structure map on
 * ESQ-16). The output lines go into a block of an EQ-application batch via
 * buildBatch() — and the chapter requires a SINGLE block per batch and a
 * SINGLE query type per block, which this builder enforces by construction.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { formatEntryNumber } from '../../ae/checkDigit.js';
import { INPUT_J0, INPUT_J1, INPUT_J2, ES_QUERY_CRITERIA_TYPES, type EsQueryCriteriaType } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface EsQueryEntry {
  /** 3-char entry filer code. */
  filerCode: string;
  /** 7-digit sequence (check digit appended) or full 8-char entry number. */
  entryNumber: string;
}

export interface EsQueryCriteria {
  /** Criteria query type (ESQ-19): AII, DOC, RCN, PSC, LIQ, NLQ, or EES. */
  type: EsQueryCriteriaType;
  /** Starting acceptance date/time, MMDDYYHHMMSSXX (XX = AM|PM). */
  fromDateTime: string;
  /** Ending acceptance date/time, MMDDYYHHMMSSXX. Range ≤ 31 days (Note 1). */
  toDateTime: string;
  /** Entry-type category flags (Note 3). */
  entrySummaries?: boolean;
  ftaReconSummaries?: boolean;
  otherReconSummaries?: boolean;
  drawbackSummaries?: boolean;
  dutyDeferralSummaries?: boolean;
  /** Collection/bill information code 1-6 (Note 5). */
  collectionBillInformationCode?: '1' | '2' | '3' | '4' | '5' | '6';
}

export interface EsQueryInput {
  /** Emit a J0-record requesting the AE 10- through 90-record detail. */
  returnDetail?: boolean;
  /** Entry Number Query (J1) — up to five entries per record, repeated. */
  entries?: EsQueryEntry[];
  /** Criteria Query (J2) — mutually exclusive with `entries` (ESQ-16). */
  criteria?: EsQueryCriteria;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'EntrySummaryQuery', field, message };
  throw new RecordCodecError([issue]);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// 12-hour clock; midnight is 120000AM, end-of-day 115959PM (J2 Note 2).
const DATE_TIME_RE = /^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{2}(0[1-9]|1[0-2])[0-5][0-9][0-5][0-9](AM|PM)$/;

// ── Builder ────────────────────────────────────────────────

/**
 * Build one Entry Summary Query as 80-char record lines. Exactly one of
 * `entries` (J1 path) or `criteria` (J2 path) must be provided.
 */
export function buildEntrySummaryQuery(input: EsQueryInput): string[] {
  const hasEntries = (input.entries?.length ?? 0) > 0;
  const hasCriteria = input.criteria !== undefined;
  if (hasEntries && hasCriteria) {
    fail('entries/criteria', 'an entry-number query (J1) and a criteria query (J2) cannot be combined in one block');
  }
  if (!hasEntries && !hasCriteria) {
    fail('entries/criteria', 'either entries (J1) or criteria (J2) must be provided');
  }

  const lines: string[] = [];
  if (input.returnDetail) {
    lines.push(writeRecord(INPUT_J0, { returnDetailRequestIndicator: 'Y' }));
  }

  if (hasEntries) {
    // Validates the filer code format and the entry-number check digit, and
    // appends the check digit to 7-digit sequences (AE Table 1 formula).
    const formatted = input.entries!.map((e) => ({
      filerCode: e.filerCode,
      entryNumber: formatEntryNumber(e.filerCode, e.entryNumber),
    }));
    for (const group of chunk(formatted, 5)) {
      const values: Record<string, string | undefined> = {};
      group.forEach((e, i) => {
        values[`entryFilerCode${i + 1}`] = e.filerCode;
        values[`entryNumber${i + 1}`] = e.entryNumber;
      });
      lines.push(writeRecord(INPUT_J1, values));
    }
    return lines;
  }

  const c = input.criteria!;
  if (!(ES_QUERY_CRITERIA_TYPES as readonly string[]).includes(c.type)) {
    fail('criteria.type', `unknown criteria query type '${c.type}'`);
  }
  if (!DATE_TIME_RE.test(c.fromDateTime)) {
    fail('criteria.fromDateTime', `date/time must be MMDDYYHHMMSSXX, got '${c.fromDateTime}'`);
  }
  if (!DATE_TIME_RE.test(c.toDateTime)) {
    fail('criteria.toDateTime', `date/time must be MMDDYYHHMMSSXX, got '${c.toDateTime}'`);
  }
  lines.push(
    writeRecord(INPUT_J2, {
      criteriaQueryTypeCode: c.type,
      requestedFromDateTime: c.fromDateTime,
      requestedToDateTime: c.toDateTime,
      entrySummariesFlag: c.entrySummaries ? 'Y' : undefined,
      ftaReconSummariesFlag: c.ftaReconSummaries ? 'Y' : undefined,
      otherReconSummariesFlag: c.otherReconSummaries ? 'Y' : undefined,
      drawbackSummariesFlag: c.drawbackSummaries ? 'Y' : undefined,
      dutyDeferralSummariesFlag: c.dutyDeferralSummaries ? 'Y' : undefined,
      collectionBillInformationCode: c.collectionBillInformationCode,
    })
  );
  return lines;
}
