/**
 * Census Warning Query (CJ/CL) record definitions — transcribed from the
 * ACE ABI CATAIR "Census Warning Query" chapter, September 20, 2014
 * (docs/abi-engine/specs/census/cj-census-warning-query.pdf).
 *
 * Input record (application identifier CJ on the B-record, CWQ-4): CJ1.
 * Output record (application identifier CL): CJ2. Page references in
 * comments are to the chapter's CWQ-n page numbers.
 *
 * The chapter prints the record tag as two data elements — Control
 * Identifier (positions 1-2, always 'CJ') and a one-character Record Type
 * (position 3) — both declared as separate constant fields here. Per house
 * convention every spec "Filler" row is an explicit class-'S' mandatory
 * field (the spec prints designation C on the CJ1 position 23-24 filler;
 * designation is irrelevant to a class-S field, so it is normalised to M
 * like every other filler) so each record tiles positions 1-80.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** Query criteria — input CJ1-Record (CWQ-5 to CWQ-6). */
export const INPUT_CJ1: RecordDef = {
  id: 'CJ1',
  name: 'CensusWarningQueryCriteria',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'CJ' },
    { name: 'recordType', start: 3, end: 3, class: 'AN', designation: 'M', constant: '1' },
    { name: 'districtPortOfEntry', start: 4, end: 7, class: 'AN', designation: 'C' }, // Note 1
    { name: 'requestedFromDate', start: 8, end: 13, class: 'D', designation: 'C' }, // MMDDYY, Note 2
    { name: 'requestedToDate', start: 14, end: 19, class: 'D', designation: 'C' }, // MMDDYY, Note 2
    { name: 'entryFilerCode', start: 20, end: 22, class: 'AN', designation: 'M' },
    { name: 'filler', start: 23, end: 24, class: 'S', designation: 'M' }, // reserved: filer/entry number expansion
    { name: 'entryNumber1', start: 25, end: 32, class: 'AN', designation: 'C' }, // Note 3
    { name: 'filler2', start: 33, end: 34, class: 'S', designation: 'M' }, // reserved: entry number expansion
    { name: 'entryNumber2', start: 35, end: 42, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 43, end: 44, class: 'S', designation: 'M' }, // reserved: entry number expansion
    { name: 'entryNumber3', start: 45, end: 52, class: 'AN', designation: 'C' },
    { name: 'filler4', start: 53, end: 54, class: 'S', designation: 'M' }, // reserved: entry number expansion
    { name: 'entryNumber4', start: 55, end: 62, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 63, end: 64, class: 'S', designation: 'M' }, // reserved: entry number expansion
    { name: 'entryNumber5', start: 65, end: 72, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Query result — output CJ2-Record on the CL response (CWQ-8 to CWQ-9). */
export const OUTPUT_CJ2: RecordDef = {
  id: 'CJ2',
  name: 'CensusWarningQueryResult',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'CJ' },
    { name: 'recordType', start: 3, end: 3, class: 'AN', designation: 'M', constant: '2' },
    { name: 'districtPortOfEntry', start: 4, end: 7, class: 'AN', designation: 'M' },
    { name: 'aceAcceptanceDate', start: 8, end: 13, class: 'D', designation: 'M' }, // MMDDYY, last accepted in ACE
    { name: 'entryFilerCode', start: 14, end: 16, class: 'AN', designation: 'M' },
    { name: 'filler', start: 17, end: 18, class: 'S', designation: 'M' }, // reserved: filer/entry number expansion
    { name: 'entryNumber', start: 19, end: 26, class: 'AN', designation: 'C' }, // Note 1: space filled on error
    { name: 'filler2', start: 27, end: 28, class: 'S', designation: 'M' }, // reserved: line item id expansion
    { name: 'entrySummaryLineItemIdentifier', start: 29, end: 31, class: 'X', designation: 'C' }, // Note 1
    { name: 'htsNumber', start: 32, end: 41, class: 'AN', designation: 'C' }, // Note 1
    { name: 'censusWarningCode', start: 42, end: 44, class: 'AN', designation: 'C' }, // Note 1
    { name: 'filler3', start: 45, end: 46, class: 'S', designation: 'M' },
    { name: 'conditionCode', start: 47, end: 49, class: 'AN', designation: 'C' }, // Note 2: error/no-data only
    { name: 'narrativeText', start: 50, end: 79, class: 'X', designation: 'C' }, // Note 2
    { name: 'filler4', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [INPUT_CJ1, OUTPUT_CJ2]) {
  assertRecordDef(def);
}
