/**
 * HTS Query (HA) transaction builder — "Harmonized Tariff Schedule (HTS)"
 * chapter, March 2023
 * (docs/abi-engine/specs/reference-data/hts-query-2023-03.pdf).
 *
 * Builds the transaction lines of a single HA query block: one W-Record per
 * query (HTS-46). Each W-Record queries an individual tariff number, or a
 * range when a To Tariff Number is given; no more than 100 tariff numbers
 * can be queried at one time (HTS-46), so ranges wider than 100 come back
 * as RANGE EXCEEDS 100 in the W0 narrative.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { INPUT_W } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface HtsQueryRequest {
  /**
   * 8, 9 or 10 digit HTS tariff number, no punctuation; left justified on
   * the wire (HTS-46). A partial (8/9-digit) number broadens the search
   * range (HTS-46 Note 1).
   */
  htsNumber: string;
  /**
   * Date the tariff data must be in effect, accepted as MMDDYY (the wire
   * format, HTS-46) or YYYYMMDD (converted). When omitted, ACE assumes the
   * current date (HTS-8).
   */
  asOfDate?: string;
  /**
   * Optional range end: output covers tariff numbers >= htsNumber and
   * <= toHtsNumber (HTS-46 Note 1). Omit to query one number.
   */
  toHtsNumber?: string;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'HtsQuery', field, message };
  throw new RecordCodecError([issue]);
}

/** Normalize an as-of date to the MMDDYY wire format (HTS-46). */
function toMmddyy(asOfDate: string, at: string): string {
  if (/^[0-9]{6}$/.test(asOfDate)) return asOfDate; // already MMDDYY
  if (/^[0-9]{8}$/.test(asOfDate)) {
    // YYYYMMDD → MMDDYY
    return asOfDate.slice(4, 6) + asOfDate.slice(6, 8) + asOfDate.slice(2, 4);
  }
  fail(at, `as of date '${asOfDate}' must be MMDDYY or YYYYMMDD`);
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build the transaction lines of one HTS query block (contents of a B…Y
 * envelope; application code HA). One W-Record per query.
 */
export function buildHtsQuery(queries: HtsQueryRequest[]): string[] {
  if (queries.length === 0) {
    fail('queries', 'at least one HTS query is required');
  }
  if (queries.length > 100) {
    fail('queries', `at most 100 tariff numbers can be queried at one time (HTS-46), got ${queries.length}`);
  }

  return queries.map((query, i) => {
    const at = `queries[${i}]`;
    if (!/^[0-9]{8,10}$/.test(query.htsNumber)) {
      fail(`${at}.htsNumber`, `tariff number '${query.htsNumber}' must be 8-10 digits, no punctuation`);
    }
    if (query.toHtsNumber !== undefined && !/^[0-9]{8,10}$/.test(query.toHtsNumber)) {
      fail(`${at}.toHtsNumber`, `to tariff number '${query.toHtsNumber}' must be 8-10 digits, no punctuation`);
    }
    return writeRecord(INPUT_W, {
      fromTariffNumber: query.htsNumber,
      asOfDate: query.asOfDate === undefined ? undefined : toMmddyy(query.asOfDate, `${at}.asOfDate`),
      toTariffNumber: query.toHtsNumber,
    });
  });
}
