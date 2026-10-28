/**
 * TIB Extend/Close (TE) transaction builder — "Temporary Importation Bond /
 * Extend Close" chapter, Jan 26 2018 rev 05
 * (docs/abi-engine/specs/entry-summary/tib-xa-e0-rev05-2018.pdf).
 *
 * A TIB TRANSACTION grouping is a single XA-Record (structure map, TIB-8)
 * requesting an extension or closure of a type-23 (TIB) entry summary. The
 * returned lines go into a block of a TE-application batch via buildBatch();
 * more than one grouping may repeat per block (Loop Repeat > 1, TIB-8).
 *
 * Rules CBP checks server-side (entry exists, entry type is 23, extension
 * count/window limits, customs status …) come back as E1 conditions — see
 * TIB_CONDITION_CODES in responseParser.ts (Note 2, TIB-14).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { formatEntryNumber } from '../../ae/checkDigit.js';
import { INPUT_XA } from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

/** extend → Extension/Closure Code 1; close → 2 (Note 2, TIB-10). */
export type TibAction = 'extend' | 'close';

export interface TibExtendCloseInput {
  action: TibAction;
  /** District/port of the entry summary — exactly 4 numerals (TIB-9). */
  districtPortOfEntrySummary: string;
  /**
   * Entry filer code (3). Chapter rule: must be the same as the entry filer
   * code in the enclosing block control header, Record Identifier B (TIB-9)
   * — wire the identical code into buildBatch()'s block.
   */
  filerCode: string;
  /**
   * Filer-assigned 7-digit sequence (check digit appended) or the full
   * 8-char entry number (embedded check digit validated) — Appendix E via
   * Note 1, TIB-9.
   */
  entryNumber: string;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'TibExtendClose', field, message };
  throw new RecordCodecError([issue]);
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build one TIB extend/close transaction as 80-char record lines (a single
 * XA-Record). Chapter-stated structural violations fail client-side before
 * transmission.
 */
export function buildTibExtension(input: TibExtendCloseInput): string[] {
  if (!/^[0-9]{4}$/.test(input.districtPortOfEntrySummary)) {
    fail(
      'districtPortOfEntrySummary',
      `district/port of entry summary must be exactly 4 numerals (TIB-9), got '${input.districtPortOfEntrySummary}'`
    );
  }
  if (input.filerCode.length !== 3) {
    fail('filerCode', `entry filer code must be exactly 3 characters (TIB-9), got '${input.filerCode}'`);
  }
  // Appendix E entry-number format incl. check digit (Note 1, TIB-9).
  const entryNumber = formatEntryNumber(input.filerCode, input.entryNumber);

  return [
    writeRecord(INPUT_XA, {
      districtPortOfEntrySummary: input.districtPortOfEntrySummary,
      entryFilerCode: input.filerCode,
      entryNumber,
      extensionClosureCode: input.action === 'extend' ? '1' : '2',
    }),
  ];
}
