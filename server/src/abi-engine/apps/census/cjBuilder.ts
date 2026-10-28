/**
 * Census Warning Query (CJ) transaction builder — Census Warning Query
 * chapter, September 20, 2014 (docs/abi-engine/specs/census/cj-census-warning-query.pdf).
 *
 * Assembles CJ1 record lines from a typed input. Each query criterion set
 * becomes one or more CJ1 records; per CWQ-5, a single CJ1 carries at most
 * five entry numbers, so longer entry-number lists are chunked into
 * additional CJ1 records exactly as the chapter instructs ("repeat this
 * input record as often as needed"). The output lines go into a block of a
 * CJ-application batch via buildBatch().
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { formatEntryNumber } from '../../ae/checkDigit.js';
import { INPUT_CJ1 } from './cjRecordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface CjQuery {
  /** District/port of entry (4 chars). Optional per CJ1 Note 1. */
  districtPortOfEntry?: string;
  /** MMDDYY. Both dates required together (CJ1 Note 2). */
  requestedFromDate?: string;
  /** MMDDYY. Both dates required together (CJ1 Note 2). */
  requestedToDate?: string;
  /**
   * Specific entry numbers: each either the 7-digit sequence (check digit
   * appended) or the full 8-character number (check digit validated). More
   * than five produces additional CJ1 records (CWQ-5).
   */
  entryNumbers?: string[];
}

export interface CjCensusWarningQueryInput {
  /** Entry filer code as assigned by CBP (3 chars). Mandatory on every CJ1. */
  filerCode: string;
  /** One entry per criteria set; each emits one or more CJ1 records. */
  queries: CjQuery[];
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'CensusWarningQuery', field, message };
  throw new RecordCodecError([issue]);
}

/** Convert an MMDDYY wire date to a UTC timestamp (YY read as 20YY). */
function mmddyyToUtc(value: string, field: string): number {
  if (!/^\d{6}$/.test(value)) fail(field, `date must be MMDDYY, got '${value}'`);
  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  const year = 2000 + Number(value.slice(4, 6));
  return Date.UTC(year, month - 1, day);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build one Census Warning Query transaction as 80-char CJ1 record lines.
 *
 * Client-side rejections per the chapter:
 * - each query must supply a district/port, a from/to date pair, or at
 *   least one entry number (CJ1 Notes 1-3);
 * - if either date is given, both must be (Note 2);
 * - the from date must not be after the to date, and the range may not
 *   exceed 31 days (Note 2). The chapter says the range "may not exceed 31
 *   days but may be any 31 day period"; we read that as an inclusive span
 *   of at most 31 calendar days (from == to counts as a 1-day span).
 */
export function buildCensusWarningQuery(input: CjCensusWarningQueryInput): string[] {
  if (input.queries.length === 0) {
    fail('queries', 'at least one query criteria set is required');
  }
  const lines: string[] = [];

  input.queries.forEach((query, qi) => {
    const hasFrom = query.requestedFromDate !== undefined;
    const hasTo = query.requestedToDate !== undefined;
    if (hasFrom !== hasTo) {
      // Note 2: if either date field is submitted, both must be submitted.
      fail(`queries[${qi}]`, 'requestedFromDate and requestedToDate must be provided together');
    }
    if (hasFrom && hasTo) {
      const from = mmddyyToUtc(query.requestedFromDate!, `queries[${qi}].requestedFromDate`);
      const to = mmddyyToUtc(query.requestedToDate!, `queries[${qi}].requestedToDate`);
      if (from > to) {
        fail(`queries[${qi}]`, 'requestedFromDate must not be after requestedToDate');
      }
      const spanDays = (to - from) / DAY_MS + 1; // inclusive day count
      if (spanDays > 31) {
        fail(`queries[${qi}]`, `date range may not exceed 31 days, got ${spanDays}`);
      }
    }

    const entryNumbers = (query.entryNumbers ?? []).map((n, ni) => {
      try {
        return formatEntryNumber(input.filerCode, n);
      } catch (err) {
        fail(`queries[${qi}].entryNumbers[${ni}]`, err instanceof Error ? err.message : String(err));
      }
    });

    // Notes 1 & 3: at least one criterion is mandatory per CJ1.
    if (!query.districtPortOfEntry && !hasFrom && entryNumbers.length === 0) {
      fail(
        `queries[${qi}]`,
        'a district/port, a from/to date pair, or at least one entry number is required'
      );
    }

    // CWQ-5: at most five entry numbers per CJ1; repeat the record for more.
    const groups = entryNumbers.length > 0 ? chunk(entryNumbers, 5) : [[]];
    for (const group of groups) {
      const values: Record<string, string | undefined> = {
        districtPortOfEntry: query.districtPortOfEntry,
        requestedFromDate: query.requestedFromDate,
        requestedToDate: query.requestedToDate,
        entryFilerCode: input.filerCode,
      };
      // Note 3: entry numbers must fill slots (1)..(n) contiguously.
      group.forEach((entryNumber, i) => {
        values[`entryNumber${i + 1}`] = entryNumber;
      });
      lines.push(writeRecord(INPUT_CJ1, values));
    }
  });

  return lines;
}
