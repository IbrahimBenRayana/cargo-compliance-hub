/**
 * Quota Query (QA) transaction builder — "Quota Query" chapter, April 30,
 * 2015 (docs/abi-engine/specs/queries/qa-quota-query-2015-04.pdf).
 *
 * Builds the transaction lines of a single QA query block: one Q1-Record per
 * request, at most 99 requests per Block Control envelope (QA-8).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { INPUT_Q1 } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface QuotaQueryRequest {
  /** R = tariff number, X = textile category number (QA-10). */
  typeCode: 'R' | 'X';
  /** 8-10 digit HTS number (R) or 3-digit textile category number (X). */
  queryId: string;
  /**
   * Second HTS number for two-tariff quotas: Chapter 99 levels pair the Ch.
   * 99 number (first) with the schedule 1-97 number (second); Special
   * Regime/Access pairs 9802008015 with the schedule 1-94 number (QA-11
   * Note 1). Must be space filled when typeCode is X.
   */
  secondTariffNumber?: string;
  /** 2-char ISO country code. */
  countryOfOrigin: string;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'QuotaQuery', field, message };
  throw new RecordCodecError([issue]);
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build the transaction lines of one Quota Query block (contents of a B…Y
 * envelope; application code QA). One Q1-Record per request.
 */
export function buildQuotaQuery(requests: QuotaQueryRequest[]): string[] {
  if (requests.length === 0) {
    fail('requests', 'at least one quota query request is required');
  }
  if (requests.length > 99) {
    fail('requests', `at most 99 quota query requests per block (QA-8), got ${requests.length}`);
  }

  return requests.map((request, i) => {
    const at = `requests[${i}]`;
    if (request.typeCode === 'R') {
      if (!/^[0-9]{8,10}$/.test(request.queryId)) {
        fail(`${at}.queryId`, `tariff query id '${request.queryId}' must be 8-10 digits, no punctuation`);
      }
    } else {
      if (!/^[0-9]{3}$/.test(request.queryId)) {
        fail(`${at}.queryId`, `textile category '${request.queryId}' must be a 3-digit number`);
      }
      if (request.secondTariffNumber !== undefined) {
        fail(`${at}.secondTariffNumber`, 'second tariff number must be space filled when the query type is X (QA-10)');
      }
    }
    if (request.secondTariffNumber !== undefined && !/^[0-9]{8,10}$/.test(request.secondTariffNumber)) {
      fail(`${at}.secondTariffNumber`, `second tariff number '${request.secondTariffNumber}' must be 8-10 digits`);
    }
    return writeRecord(INPUT_Q1, {
      quotaQueryIdTypeCode: request.typeCode,
      quotaQueryId: request.queryId,
      secondTariffNumber: request.secondTariffNumber,
      countryOfOrigin: request.countryOfOrigin,
    });
  });
}
