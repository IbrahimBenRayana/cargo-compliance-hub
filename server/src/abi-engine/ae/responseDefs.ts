/**
 * Entry Summary Response (AX) output record definitions — transcribed from
 * the Entry Summary Create/Update chapter, July 2026
 * (docs/abi-engine/specs/entry-summary/ae-ax-create-update-2026-07.pdf).
 *
 * E0 = condition reference "signpost" (which submitted grouping caused a
 * condition); E1 = condition/final-disposition. Page refs are ESF-n.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

/** Entry Summary Condition Reference — output E0-Record (ESF-193). */
export const OUTPUT_E0: RecordDef = {
  id: 'E0',
  name: 'EntrySummaryConditionReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E0' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'referenceDataTypeCode', start: 4, end: 9, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 10, end: 10, class: 'S', designation: 'M' },
    { name: 'occurrencePosition', start: 11, end: 16, class: 'N', designation: 'M' },
    { name: 'filler3', start: 17, end: 17, class: 'S', designation: 'M' },
    { name: 'refIdConstant', start: 18, end: 24, class: 'X', designation: 'M' }, // 'REF ID:'
    { name: 'filler4', start: 25, end: 25, class: 'S', designation: 'M' },
    { name: 'referenceDataText', start: 26, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Entry Summary Condition/Disposition Response — output E1-Record (ESF-204). */
export const OUTPUT_E1: RecordDef = {
  id: 'E1',
  name: 'EntrySummaryConditionDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E1' },
    { name: 'dispositionTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // space | A | R
    { name: 'severityCode', start: 4, end: 4, class: 'AN', designation: 'M' }, // F | W | P | I | space
    { name: 'conditionCode', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'reasonCode', start: 8, end: 10, class: 'AN', designation: 'C' }, // CBP internal
    { name: 'narrativeText', start: 11, end: 50, class: 'AN', designation: 'M' },
    { name: 'entryFilerCode', start: 51, end: 53, class: 'AN', designation: 'C' },
    { name: 'filler', start: 54, end: 55, class: 'S', designation: 'M' },
    { name: 'entryNumber', start: 56, end: 63, class: 'AN', designation: 'C' },
    { name: 'versionNumber', start: 64, end: 68, class: 'N', designation: 'C' }, // 5N or 5S
    { name: 'brokerReferenceNumber', start: 69, end: 77, class: 'X', designation: 'C' },
    { name: 'filler2', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [OUTPUT_E0, OUTPUT_E1]) {
  assertRecordDef(def);
}
