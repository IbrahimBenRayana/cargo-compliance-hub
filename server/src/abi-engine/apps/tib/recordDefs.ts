/**
 * Temporary Importation Bond (TIB) companion-application record definitions,
 * transcribed from two CATAIR chapters:
 *
 *  - "Temporary Importation Bond / Extend Close", Jan 26 2018, rev 05
 *    (docs/abi-engine/specs/entry-summary/tib-xa-e0-rev05-2018.pdf):
 *    the TE-application input XA-Record (TIB-9) and the TX-application
 *    output E0/E1 response records (TIB-12..14). Page refs are TIB-n.
 *
 *  - "Temporary Importation Bond / Expiration Notice", Jan 26 2018, rev 03
 *    (docs/abi-engine/specs/entry-summary/tib-x1-rev03-2018.pdf):
 *    the TS-application output X1-Record (TS-10..11). This chapter is
 *    notification-only — "There are no input records for TIB expiration
 *    notices" (TS-8). Page refs are TS-n.
 *
 * Naming note: the TIB notice X1-Record (application TS) is a different
 * record from the Batch & Block Control envelope X1 condition/disposition
 * record, despite sharing the control identifier — see OUTPUT_X1_NOTICE
 * below and the disambiguation walk in responseParser.ts.
 *
 * Both chapters print the two control positions as separate 1-char fields
 * (e.g. Control Identifier 1A = 'X', Record Type 1A = 'A'); per house style
 * they are combined into one 2-char constant, as in ae/responseDefs.ts.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** TIB Transaction Detail — input XA-Record (TIB-9). One per TRANSACTION grouping (TIB-8). */
export const INPUT_XA: RecordDef = {
  id: 'XA',
  name: 'TibTransactionDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'XA' },
    { name: 'districtPortOfEntrySummary', start: 3, end: 6, class: 'N', designation: 'M' }, // 4N
    { name: 'entryFilerCode', start: 7, end: 9, class: 'AN', designation: 'M' }, // must match B-record filer
    { name: 'filler', start: 10, end: 10, class: 'S', designation: 'M' },
    { name: 'entryNumber', start: 11, end: 18, class: 'AN', designation: 'M' }, // Appendix E format (Note 1)
    { name: 'extensionClosureCode', start: 19, end: 19, class: 'N', designation: 'M' }, // 1 = extension, 2 = closure (Note 2, TIB-10)
    { name: 'filler2', start: 20, end: 80, class: 'S', designation: 'M' },
  ],
};

/** TIB Condition Reference — output E0-Record (TIB-12). */
export const OUTPUT_E0: RecordDef = {
  id: 'E0',
  name: 'TibConditionReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E0' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'referenceDataTypeCode', start: 4, end: 9, class: 'AN', designation: 'M' }, // BLOCK | SUMMRY
    { name: 'filler2', start: 10, end: 10, class: 'S', designation: 'M' },
    { name: 'occurrencePosition', start: 11, end: 16, class: 'N', designation: 'M' },
    { name: 'filler3', start: 17, end: 17, class: 'S', designation: 'M' },
    { name: 'refIdConstant', start: 18, end: 24, class: 'X', designation: 'M', constant: 'REF ID:' },
    { name: 'filler4', start: 25, end: 25, class: 'S', designation: 'M' },
    // Reference Data Fields 1/2 — space filled when the XA input was not
    // recognized (Note 1, TIB-12), hence designation C despite the printed M.
    { name: 'entryFilerCode', start: 26, end: 28, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 29, end: 29, class: 'S', designation: 'M' },
    { name: 'entryNumber', start: 30, end: 37, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 38, end: 80, class: 'S', designation: 'M' },
  ],
};

/** TIB Condition/Disposition Response — output E1-Record (TIB-13..14). */
export const OUTPUT_E1: RecordDef = {
  id: 'E1',
  name: 'TibConditionDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E1' },
    { name: 'dispositionTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // space | A | R
    { name: 'severityCode', start: 4, end: 4, class: 'AN', designation: 'M' }, // F | W | I | space (Note 1)
    { name: 'conditionCode', start: 5, end: 7, class: 'AN', designation: 'M' }, // Note 2 table
    { name: 'filler', start: 8, end: 10, class: 'S', designation: 'M' },
    // Printed as 40AN, but the Note 2 narratives themselves contain
    // - , / and ' (e.g. "ENTRY TYPE MUST BE '23'", "EXT-CLOSE REQ LATE,
    // ENTRY CLOSED") which AN forbids — transcribed as X so genuine wire
    // narratives round-trip through the codec.
    { name: 'narrativeText', start: 11, end: 50, class: 'X', designation: 'M' },
    { name: 'entryFilerCode', start: 51, end: 53, class: 'AN', designation: 'C' }, // echoed from input XA
    { name: 'filler2', start: 54, end: 55, class: 'S', designation: 'M' }, // reserved: filer/entry expansion
    { name: 'entryNumber', start: 56, end: 63, class: 'AN', designation: 'C' }, // echoed from input XA
    { name: 'filler3', start: 64, end: 68, class: 'S', designation: 'M' },
    { name: 'brokerReferenceNumber', start: 69, end: 77, class: 'X', designation: 'C' }, // 9X (Note 5)
    { name: 'filler4', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

/**
 * TIB Expiration Notice — output X1-Record (TS-10..11), application TS.
 * Returned only for entry type 23 (TIB) summaries due to expire within one
 * month (TS-5). NOT the envelope X1 condition record — that one carries a
 * condition code at 5-7; this one carries the district/port at 3-6.
 */
export const OUTPUT_X1_NOTICE: RecordDef = {
  id: 'X1',
  name: 'TibExpirationNotice',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'X1' },
    { name: 'districtPortOfEntrySummary', start: 3, end: 6, class: 'N', designation: 'M' }, // 4N
    { name: 'entryFilerCode', start: 7, end: 9, class: 'AN', designation: 'M' }, // matches B-record filer
    { name: 'filler', start: 10, end: 10, class: 'S', designation: 'M' },
    { name: 'entryNumber', start: 11, end: 18, class: 'AN', designation: 'M' }, // 8 chars since rev 02 (TS-4)
    { name: 'importerOfRecordNumber', start: 19, end: 30, class: 'X', designation: 'M' }, // 12X
    { name: 'tibExpirationDate', start: 31, end: 36, class: 'N', designation: 'C' }, // MMDDYY (printed 6N, not D)
    { name: 'totalNumberOfExtensions', start: 37, end: 37, class: 'N', designation: 'C' },
    { name: 'filler2', start: 38, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [INPUT_XA, OUTPUT_E0, OUTPUT_E1, OUTPUT_X1_NOTICE]) {
  assertRecordDef(def);
}
