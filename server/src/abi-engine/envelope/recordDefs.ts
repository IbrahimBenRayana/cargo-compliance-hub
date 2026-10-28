/**
 * Batch & Block Control record definitions — transcribed from the ACE ABI
 * CATAIR "ABI Batch & Block Control" chapter, V23 June 2023
 * (docs/abi-engine/specs/core/batch-block-control-v23-2023-06.pdf).
 *
 * Input records: A (batch header), B (block header), Y (block trailer),
 * Z (batch trailer). Output adds X0 (condition reference) and X1
 * (condition/disposition), plus statement fields on the output B-record.
 * Page references in comments are to the chapter's B&B-n page numbers.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── Input records ──────────────────────────────────────────

/** Batch Control Header — input A-Record (B&B-9). */
export const INPUT_A: RecordDef = {
  id: 'A',
  name: 'BatchControlHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'A' },
    { name: 'siteCode', start: 2, end: 5, class: 'AN', designation: 'M' },
    { name: 'idCode', start: 6, end: 8, class: 'AN', designation: 'M' },
    { name: 'password', start: 9, end: 14, class: 'AN', designation: 'M' },
    { name: 'transmissionDate', start: 15, end: 20, class: 'D', designation: 'O' },
    { name: 'filler', start: 21, end: 25, class: 'S', designation: 'M' },
    { name: 'appId', start: 26, end: 27, class: 'X', designation: 'M' }, // M for ESAR; X: $I/$R app ids exist (AMF-6)
    { name: 'filler2', start: 28, end: 37, class: 'S', designation: 'M' },
    { name: 'officeCode', start: 38, end: 39, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 40, end: 59, class: 'S', designation: 'M' },
    { name: 'userData', start: 60, end: 80, class: 'X', designation: 'O' },
  ],
};

/** Block Control Header — input B-Record (B&B-13). */
export const INPUT_B: RecordDef = {
  id: 'B',
  name: 'BlockControlHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'B' },
    { name: 'filler', start: 2, end: 3, class: 'S', designation: 'M' },
    { name: 'port', start: 4, end: 7, class: 'AN', designation: 'M' },
    { name: 'filerCode', start: 8, end: 10, class: 'AN', designation: 'M' },
    { name: 'appId', start: 11, end: 12, class: 'X', designation: 'M' }, // X: $I/$R app ids exist (AMF-6)
    { name: 'filler2', start: 13, end: 44, class: 'S', designation: 'M' },
    { name: 'officeCode', start: 45, end: 46, class: 'AN', designation: 'C' },
    { name: 'preparerPort', start: 47, end: 50, class: 'AN', designation: 'C' },
    { name: 'preparerFilerCode', start: 51, end: 53, class: 'AN', designation: 'C' },
    { name: 'preparerOfficeCode', start: 54, end: 55, class: 'AN', designation: 'C' },
    { name: 'preparerIndicator', start: 56, end: 56, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 57, end: 59, class: 'S', designation: 'M' },
    { name: 'userData', start: 60, end: 80, class: 'X', designation: 'O' },
  ],
};

/** Block Control Trailer — input Y-Record, ESAR variant (B&B-15). */
export const INPUT_Y: RecordDef = {
  id: 'Y',
  name: 'BlockControlTrailer',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'Y' },
    { name: 'filler', start: 2, end: 3, class: 'S', designation: 'M' },
    { name: 'port', start: 4, end: 7, class: 'AN', designation: 'M' },
    { name: 'filerCode', start: 8, end: 10, class: 'AN', designation: 'M' },
    { name: 'appId', start: 11, end: 12, class: 'X', designation: 'M' }, // X: $I/$R app ids exist (AMF-6)
    { name: 'filler2', start: 13, end: 44, class: 'S', designation: 'M' },
    { name: 'officeCode', start: 45, end: 46, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 47, end: 80, class: 'S', designation: 'C' },
  ],
};

/** Batch Control Trailer — input Z-Record, ESAR variant (B&B-12). */
export const INPUT_Z: RecordDef = {
  id: 'Z',
  name: 'BatchControlTrailer',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'Z' },
    { name: 'siteCode', start: 2, end: 5, class: 'AN', designation: 'M' },
    { name: 'idCode', start: 6, end: 8, class: 'AN', designation: 'M' },
    { name: 'filler', start: 9, end: 14, class: 'S', designation: 'M' }, // ESAR: space; eMAN would carry password
    { name: 'transmissionDate', start: 15, end: 20, class: 'D', designation: 'C' },
    { name: 'filler2', start: 21, end: 37, class: 'S', designation: 'M' },
    { name: 'officeCode', start: 38, end: 39, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 40, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Output-only records ────────────────────────────────────

/** Block/Transaction Condition Reference — output X0-Record (B&B-29). */
export const OUTPUT_X0: RecordDef = {
  id: 'X0',
  name: 'ConditionReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'X0' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'refType', start: 4, end: 9, class: 'AN', designation: 'M' }, // BLOCK | TRNACT
    { name: 'filler2', start: 10, end: 10, class: 'S', designation: 'M' },
    { name: 'occurrence', start: 11, end: 16, class: 'N', designation: 'M' },
    { name: 'filler3', start: 17, end: 17, class: 'S', designation: 'M' },
    { name: 'refIdConstant', start: 18, end: 24, class: 'X', designation: 'M' }, // 'REF ID:'
    { name: 'filler4', start: 25, end: 25, class: 'S', designation: 'M' },
    { name: 'referenceText', start: 26, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Batch/Block/Transaction Condition/Disposition — output X1-Record (B&B-31). */
export const OUTPUT_X1: RecordDef = {
  id: 'X1',
  name: 'ConditionDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'X1' },
    { name: 'dispositionType', start: 3, end: 3, class: 'AN', designation: 'M' }, // space | R
    { name: 'severity', start: 4, end: 4, class: 'AN', designation: 'M' }, // always F
    { name: 'conditionCode', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'filler', start: 8, end: 9, class: 'S', designation: 'M' },
    { name: 'reasonCode', start: 10, end: 10, class: 'AN', designation: 'C' },
    { name: 'narrative', start: 11, end: 50, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 51, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Output B-Record (B&B-25) — mirrors input B plus statement fields 13–44. */
export const OUTPUT_B: RecordDef = {
  id: 'B',
  name: 'BlockControlHeaderOut',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'B' },
    { name: 'filler', start: 2, end: 3, class: 'S', designation: 'M' },
    { name: 'port', start: 4, end: 7, class: 'AN', designation: 'M' },
    { name: 'filerCode', start: 8, end: 10, class: 'AN', designation: 'M' },
    { name: 'appId', start: 11, end: 12, class: 'X', designation: 'M' }, // X: $I/$R app ids exist (AMF-6)
    { name: 'statementStatus', start: 13, end: 13, class: 'AN', designation: 'C' }, // P | F
    { name: 'statementNumber', start: 14, end: 23, class: 'AN', designation: 'C' },
    { name: 'preliminaryStatementPrintDate', start: 24, end: 29, class: 'D', designation: 'C' },
    { name: 'paymentTypeCode', start: 30, end: 30, class: 'AN', designation: 'C' },
    { name: 'importerOfRecordNumber', start: 31, end: 42, class: 'X', designation: 'C' },
    { name: 'statementClientBranchId', start: 43, end: 44, class: 'AN', designation: 'C' },
    { name: 'officeCode', start: 45, end: 46, class: 'AN', designation: 'C' },
    { name: 'preparerPort', start: 47, end: 50, class: 'AN', designation: 'C' },
    { name: 'preparerFilerCode', start: 51, end: 53, class: 'AN', designation: 'C' },
    { name: 'preparerOfficeCode', start: 54, end: 55, class: 'AN', designation: 'C' },
    { name: 'preparerIndicator', start: 56, end: 56, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 57, end: 59, class: 'S', designation: 'M' },
    { name: 'userData', start: 60, end: 80, class: 'X', designation: 'C' },
  ],
};

/** Output Y-Record (B&B-28) — mirrors input Y plus the image count. */
export const OUTPUT_Y: RecordDef = {
  id: 'Y',
  name: 'BlockControlTrailerOut',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'Y' },
    { name: 'filler', start: 2, end: 3, class: 'S', designation: 'M' },
    { name: 'port', start: 4, end: 7, class: 'AN', designation: 'M' },
    { name: 'filerCode', start: 8, end: 10, class: 'AN', designation: 'M' },
    { name: 'appId', start: 11, end: 12, class: 'X', designation: 'M' }, // X: $I/$R app ids exist (AMF-6)
    { name: 'imageCount', start: 13, end: 17, class: 'N', designation: 'M' },
    { name: 'filler2', start: 18, end: 44, class: 'S', designation: 'M' },
    { name: 'officeCode', start: 45, end: 46, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 47, end: 79, class: 'S', designation: 'C' },
    { name: 'aceGeneratedIndicator', start: 80, end: 80, class: 'AN', designation: 'C' },
  ],
};

for (const def of [INPUT_A, INPUT_B, INPUT_Y, INPUT_Z, OUTPUT_X0, OUTPUT_X1, OUTPUT_B, OUTPUT_Y]) {
  assertRecordDef(def);
}
