/**
 * Census Warning Override (CW/CO) record definitions — transcribed from the
 * ACE ABI CATAIR "Census Warning Override" chapter, May 19, 2008
 * (docs/abi-engine/specs/census/cw-census-warning-override.pdf).
 *
 * Input records (application identifier CW on the B-record, CWO-5): CW01 and
 * CW02. Output record (application identifier CO): CW03. Page references in
 * comments are to the chapter's CWO-n page numbers.
 *
 * The chapter prints the record tag as two data elements — Control
 * Identifier (positions 1-2, always 'CW') and Record Type (positions 3-4,
 * e.g. '01') — so both are declared as separate constant fields here.
 * Per house convention every spec "Filler" row is an explicit class-'S'
 * mandatory field so each record tiles positions 1-80.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** Entry summary identification — input CW01-Record (CWO-6). */
export const INPUT_CW01: RecordDef = {
  id: 'CW01',
  name: 'CensusOverrideEntryIdentification',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'CW' },
    { name: 'recordType', start: 3, end: 4, class: 'AN', designation: 'M', constant: '01' },
    { name: 'entryFilerCode', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'filler', start: 8, end: 9, class: 'S', designation: 'M' }, // reserved: filer/entry number expansion
    { name: 'entryNumber', start: 10, end: 17, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 18, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Override codes per line item — input CW02-Record (CWO-7 to CWO-8). */
export const INPUT_CW02: RecordDef = {
  id: 'CW02',
  name: 'CensusOverrideLineItemCodes',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'CW' },
    { name: 'recordType', start: 3, end: 4, class: 'AN', designation: 'M', constant: '02' },
    { name: 'filler', start: 5, end: 6, class: 'S', designation: 'M' }, // reserved: line item id expansion
    { name: 'entrySummaryLineItemIdentifier', start: 7, end: 9, class: 'X', designation: 'M' },
    { name: 'censusWarningConditionCode1', start: 10, end: 12, class: 'AN', designation: 'M' },
    { name: 'censusWarningConditionOverrideCode1', start: 13, end: 14, class: 'AN', designation: 'M' },
    { name: 'censusWarningConditionCode2', start: 15, end: 17, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode2', start: 18, end: 19, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionCode3', start: 20, end: 22, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode3', start: 23, end: 24, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionCode4', start: 25, end: 27, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode4', start: 28, end: 29, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionCode5', start: 30, end: 32, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode5', start: 33, end: 34, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionCode6', start: 35, end: 37, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode6', start: 38, end: 39, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionCode7', start: 40, end: 42, class: 'AN', designation: 'C' },
    { name: 'censusWarningConditionOverrideCode7', start: 43, end: 44, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 45, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Override disposition — output CW03-Record on the CO response (CWO-9). */
export const OUTPUT_CW03: RecordDef = {
  id: 'CW03',
  name: 'CensusOverrideDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'CW' },
    { name: 'recordType', start: 3, end: 4, class: 'AN', designation: 'M', constant: '03' },
    { name: 'entryFilerCode', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'filler', start: 8, end: 9, class: 'S', designation: 'M' }, // reserved: filer/entry number expansion
    { name: 'entryNumber', start: 10, end: 17, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 18, end: 19, class: 'S', designation: 'M' }, // reserved: line item id expansion
    { name: 'entrySummaryLineItemIdentifier', start: 20, end: 22, class: 'X', designation: 'M' },
    { name: 'censusWarningCode', start: 23, end: 25, class: 'AN', designation: 'M' },
    { name: 'censusOverrideCode', start: 26, end: 27, class: 'AN', designation: 'M' },
    { name: 'conditionCode', start: 28, end: 30, class: 'AN', designation: 'M' },
    { name: 'narrativeText', start: 31, end: 70, class: 'AN', designation: 'M' },
    { name: 'filler3', start: 71, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [INPUT_CW01, INPUT_CW02, OUTPUT_CW03]) {
  assertRecordDef(def);
}
