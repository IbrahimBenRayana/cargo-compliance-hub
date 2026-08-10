/**
 * Census Warning Override (CW) transaction builder — Census Warning Override
 * chapter, May 19, 2008 (docs/abi-engine/specs/census/cw-census-warning-override.pdf).
 *
 * Assembles the CW01/CW02 record lines for one Census warning override
 * transaction from a typed input. Per the chapter (CWO-6): a CW01 record
 * identifies an entry summary and must be followed by at least one CW02
 * record; the CW01 may be repeated for additional entry summaries. Each
 * CW02 carries one line item's warning/override code pairs — at most seven,
 * matching the maximum of seven Census warnings per entry summary line item
 * (CWO-5). The output lines go into a block of a CW-application batch via
 * buildBatch().
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../../records/codec.js';
import { formatEntryNumber } from '../../ae/checkDigit.js';
import { INPUT_CW01, INPUT_CW02 } from './cwRecordDefs.js';

// ── Input types ────────────────────────────────────────────

export interface CwOverride {
  /** Census warning condition code being resolved (Appendix H). */
  warningCode: string;
  /** Override code explaining why the submitted data is correct (Appendix H). */
  overrideCode: string;
}

export interface CwLineOverrides {
  /** Filer's entry summary line item identifier (≤3 chars, one CW02 each). */
  lineItemIdentifier: string;
  /** 1–7 warning/override pairs (CWO-5: up to seven warnings per line). */
  overrides: CwOverride[];
}

export interface CwEntryOverrides {
  /**
   * Entry number: either the 7-digit sequence (check digit appended) or the
   * full 8-character number (check digit validated), per AE Table 1.
   */
  entryNumber: string;
  lines: CwLineOverrides[];
}

export interface CwCensusOverrideInput {
  /** Entry filer code as assigned by CBP (3 chars). */
  filerCode: string;
  entries: CwEntryOverrides[];
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'CensusWarningOverride', field, message };
  throw new RecordCodecError([issue]);
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build one Census Warning Override transaction as 80-char record lines:
 * for each entry summary, a CW01 record followed by one CW02 record per
 * line item (CWO-6..8).
 */
export function buildCensusOverride(input: CwCensusOverrideInput): string[] {
  if (input.entries.length === 0) {
    fail('entries', 'at least one entry summary is required');
  }
  const lines: string[] = [];

  input.entries.forEach((entry, ei) => {
    const entryNumber = formatEntryNumber(input.filerCode, entry.entryNumber);
    lines.push(
      writeRecord(INPUT_CW01, {
        entryFilerCode: input.filerCode,
        entryNumber,
      })
    );

    // CWO-6: each CW01 must be accompanied by at least one CW02 record.
    if (entry.lines.length === 0) {
      fail(`entries[${ei}].lines`, 'at least one CW02 line item override is required per entry summary');
    }

    entry.lines.forEach((line, li) => {
      if (line.overrides.length === 0) {
        fail(`entries[${ei}].lines[${li}].overrides`, 'at least one warning/override code pair is required');
      }
      if (line.overrides.length > 7) {
        fail(
          `entries[${ei}].lines[${li}].overrides`,
          `at most 7 warning/override code pairs per line item, got ${line.overrides.length}`
        );
      }
      const values: Record<string, string | undefined> = {
        entrySummaryLineItemIdentifier: line.lineItemIdentifier,
      };
      line.overrides.forEach((pair, i) => {
        values[`censusWarningConditionCode${i + 1}`] = pair.warningCode;
        values[`censusWarningConditionOverrideCode${i + 1}`] = pair.overrideCode;
      });
      lines.push(writeRecord(INPUT_CW02, values));
    });
  });

  return lines;
}
