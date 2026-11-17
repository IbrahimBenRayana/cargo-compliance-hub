/**
 * Cargo Manifest/In-bond/Entry Status Query (CQ) transaction builder —
 * chapter revision 21, September 9, 2025
 * (docs/abi-engine/specs/queries/cargo-manifest-entry-release-query-v21-2025-09.pdf).
 *
 * Builds the transaction lines of a CQ block: one WR1 per question. Only one
 * kind of question may be asked per WR1 (ACMQ-14 Note 1).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { INPUT_WR1 } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

/**
 * How many notifications to return (ACMQ-20 Note 5): the most recent only,
 * up to the last five, or all of them.
 */
export type ManifestQueryLimit = 'latest' | 'last5' | 'all';

interface Limited {
  /** Defaults to 'all'. */
  limit?: ManifestQueryLimit;
}

/** An ocean, rail or truck bill of lading (master, regular or house). */
export interface BillQuery extends Limited {
  type: 'bill';
  /** SCAC of the party that issued the bill. */
  issuerCode: string;
  /** Bill number without the SCAC, at most 12 characters. */
  billNumber: string;
  /** Also return the related house bills, or the master of a house (pos 71). */
  relatedBills?: boolean;
}

/** An air waybill, optionally narrowed to one house air waybill. */
export interface AirWaybillQuery extends Limited {
  type: 'airWaybill';
  /** 11 characters: 3-character carrier prefix + 8-digit serial, no hyphen. */
  airWaybillNumber: string;
  houseAirWaybillNumber?: string;
}

/** An in-bond movement, by in-bond number only (ACMQ-14 Notes 1-2). */
export interface InbondQuery extends Limited {
  type: 'inbond';
  /** 9 digits, V + 10 alphanumerics, or an 11-character air waybill number. */
  inbondNumber: string;
  /** Air carrier code; mandatory when the in-bond moves by air (ACMQ-13). */
  airCarrierCode?: string;
}

/** An entry's release status. Entries up to 6 months old only (ACMQ-12). */
export interface EntryQuery extends Limited {
  type: 'entry';
  /** Must equal the filer code of the block (B record). */
  filerCode: string;
  /** Entry number without the filer code. */
  entryNumber: string;
  /** Also return the status of the bills and in-bonds on the entry (pos 72). */
  withBills?: boolean;
}

export type ManifestQueryRequest = BillQuery | AirWaybillQuery | InbondQuery | EntryQuery;

// ── Helpers ────────────────────────────────────────────────

const LIMIT_CODE: Record<ManifestQueryLimit, string | undefined> = { latest: undefined, last5: '1', all: '2' };

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'ManifestQuery', field, message };
  throw new RecordCodecError([issue]);
}

function check(at: string, field: string, value: string, pattern: RegExp, expected: string): void {
  if (!pattern.test(value)) fail(`${at}.${field}`, `'${value}' must be ${expected}`);
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build the transaction lines of one CQ block (contents of a B…Y envelope;
 * application code CQ). One WR1 per request.
 */
export function buildManifestQuery(requests: ManifestQueryRequest[]): string[] {
  if (requests.length === 0) {
    fail('requests', 'at least one query is required');
  }

  return requests.map((request, i) => {
    const at = `requests[${i}]`;
    const limitOutputOption = LIMIT_CODE[request.limit ?? 'all'];
    switch (request.type) {
      case 'bill':
        check(at, 'issuerCode', request.issuerCode, /^[A-Z0-9]{2,4}$/, 'a 2-4 character carrier code');
        check(at, 'billNumber', request.billNumber, /^[A-Z0-9]{1,12}$/, '1-12 letters and digits, no punctuation');
        return writeRecord(INPUT_WR1, {
          billIssuerCode: request.issuerCode,
          billOfLadingNumber: request.billNumber,
          requestRelatedBills: request.relatedBills ? 'Y' : undefined,
          limitOutputOption,
        });
      case 'airWaybill':
        check(at, 'airWaybillNumber', request.airWaybillNumber, /^[A-Z0-9]{11}$/, '11 characters, no hyphen');
        if (request.houseAirWaybillNumber !== undefined) {
          check(at, 'houseAirWaybillNumber', request.houseAirWaybillNumber, /^[A-Z0-9]{1,12}$/, '1-12 letters and digits');
        }
        return writeRecord(INPUT_WR1, {
          airWaybillNumber: request.airWaybillNumber,
          houseAirWaybillNumber: request.houseAirWaybillNumber,
          limitOutputOption,
        });
      case 'inbond':
        check(at, 'inbondNumber', request.inbondNumber, /^([0-9]{9}|V[A-Z0-9]{10}|[A-Z0-9]{11})$/, 'a 9-digit, V-prefixed or air waybill in-bond number (ACMQ-14 Note 2)');
        if (request.airCarrierCode !== undefined) {
          check(at, 'airCarrierCode', request.airCarrierCode, /^[A-Z0-9]{2,3}$/, 'a 2-3 character air carrier code');
        }
        return writeRecord(INPUT_WR1, {
          inbondNumber: request.inbondNumber,
          billIssuerCode: request.airCarrierCode,
          limitOutputOption,
        });
      case 'entry':
        check(at, 'filerCode', request.filerCode, /^[A-Z0-9]{3}$/, 'a 3-character filer code');
        check(at, 'entryNumber', request.entryNumber, /^[A-Z0-9]{8,9}$/, '8-9 characters without the filer code');
        return writeRecord(INPUT_WR1, {
          entryFilerCode: request.filerCode,
          entryNumber: request.entryNumber,
          requestBillAndEntryData: request.withBills ? 'Y' : undefined,
          limitOutputOption,
        });
    }
  });
}
