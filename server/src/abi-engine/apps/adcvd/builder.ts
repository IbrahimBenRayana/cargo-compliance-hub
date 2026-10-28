/**
 * AD/CVD Case Information Query (AD) transaction builder — "AD/CVD Case
 * Information Query" chapter, July 9, 2026
 * (docs/abi-engine/specs/queries/ad-cvd-case-query-2026-07.pdf).
 *
 * Builds the transaction lines of a single AD query block. Per ADQ-7/9 only
 * a SINGLE type of query (Q1 case-number OR Q2 criteria) is allowed per
 * Block Control envelope, and only a single AD query block per batch; the
 * discriminated-union input enforces the first rule by construction. Q1
 * repeats as needed (five case numbers per record, ADQ-10); Q2 may appear
 * exactly once (ADQ-12).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { INPUT_Q1, INPUT_Q2 } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface AdCvdCaseNumberQueryInput {
  type: 'caseNumbers';
  /**
   * AD/CVD case numbers, each 7 digits (principal case: all 10-digit company
   * cases returned, ADQ-11 Note 1) or 10 digits (7-digit base + 3-char
   * company suffix). No dashes. Chunked five per Q1-Record.
   */
  caseNumbers: string[];
}

export interface AdCvdCriteriaQueryInput {
  type: 'criteria';
  /** A = active, I = inactive, B = both (ADQ-12). */
  companyCaseStatus: 'A' | 'I' | 'B';
  /** 2-char alphabetic ISO country code. */
  countryCode?: string;
  /** 8 or 10 digit HTS number (8-digit left justified, ADQ-12 Note 2). */
  htsNumber?: string;
  /** 5 or 7 digit TSUSA number; mutually exclusive with HTS (Note 4). */
  tsusaNumber?: string;
  /** MID of a foreign manufacturer (≤15 chars, left justified). */
  manufacturerId?: string;
  /** MID of a foreign exporter (≤15 chars, left justified). */
  foreignExporterId?: string;
  /** MMDDYY, within 7 days of transmission (ADQ-14 Note 5). */
  dateSinceLastUpdate?: string;
}

export type AdCvdCaseQueryInput = AdCvdCaseNumberQueryInput | AdCvdCriteriaQueryInput;

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'AdCvdCaseQuery', field, message };
  throw new RecordCodecError([issue]);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build the transaction lines of one AD/CVD Case Information Query block
 * (contents of a B…Y envelope; application code AD).
 */
export function buildAdCvdCaseQuery(input: AdCvdCaseQueryInput): string[] {
  if (input.type === 'caseNumbers') {
    if (input.caseNumbers.length === 0) {
      fail('caseNumbers', 'at least one AD/CVD case number is required');
    }
    return chunk(input.caseNumbers, 5).map((group) => {
      const values: Record<string, string | undefined> = {};
      group.forEach((caseNumber, i) => {
        if (!/^[A-Z0-9]{7}([A-Z0-9]{3})?$/i.test(caseNumber)) {
          fail(`caseNumbers[${i}]`, `case number '${caseNumber}' must be 7 or 10 characters, no dashes`);
        }
        values[`caseNumber${i + 1}`] = caseNumber.slice(0, 7);
        values[`caseNumber${i + 1}Suffix`] = caseNumber.slice(7) || undefined;
      });
      return writeRecord(INPUT_Q1, values);
    });
  }

  // Criteria query: at least one criterion beyond the status (ADQ-14 Note 1);
  // tariff criterion via HTS or TSUSA but never both (Note 4).
  if (input.htsNumber && input.tsusaNumber) {
    fail('htsNumber', 'query by HTS number or TSUSA number, not both (ADQ-14 Note 4)');
  }
  if (input.htsNumber && !/^[0-9]{8}([0-9]{2})?$/.test(input.htsNumber)) {
    fail('htsNumber', `HTS number '${input.htsNumber}' must be 8 or 10 digits`);
  }
  if (input.tsusaNumber && !/^[0-9]{5}([0-9]{2})?$/.test(input.tsusaNumber)) {
    fail('tsusaNumber', `TSUSA number '${input.tsusaNumber}' must be 5 or 7 digits`);
  }
  const hasCriterion =
    input.countryCode !== undefined ||
    input.htsNumber !== undefined ||
    input.tsusaNumber !== undefined ||
    input.manufacturerId !== undefined ||
    input.foreignExporterId !== undefined ||
    input.dateSinceLastUpdate !== undefined;
  if (!hasCriterion) {
    fail('companyCaseStatus', 'at least one criterion beyond the case status is required (ADQ-14 Note 1)');
  }

  return [
    writeRecord(INPUT_Q2, {
      companyCaseStatus: input.companyCaseStatus,
      countryCode: input.countryCode,
      htsNumber: input.htsNumber,
      tsusaNumber: input.tsusaNumber,
      manufacturerIdentificationCode: input.manufacturerId,
      foreignExporterIdentificationCode: input.foreignExporterId,
      dateSinceLastUpdate: input.dateSinceLastUpdate,
    }),
  ];
}
