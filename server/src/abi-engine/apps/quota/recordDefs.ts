/**
 * Quota Query (QA/QB) record definitions — transcribed from the ACE ABI
 * CATAIR "Quota Query" chapter, April 30, 2015
 * (docs/abi-engine/specs/queries/qa-quota-query-2015-04.pdf). Page
 * references in comments are the chapter's QA-n page numbers.
 *
 * Input: Q1 quota query request, up to 99 per block (QA-8). Output: for each
 * Q1 either a Q2/Q3/Q4 results grouping (repeatable) or a single Q5 error
 * record — never both (QA-9). Application codes: input QA, response QB
 * (QA-5; APPLICATION_CODES.quotaQuery).
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** Quota Query Request — input Q1-Record (QA-10..11). */
export const INPUT_Q1: RecordDef = {
  id: 'Q1',
  name: 'QuotaQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q1' },
    { name: 'quotaQueryIdTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // R tariff | X textile category
    { name: 'quotaQueryId', start: 4, end: 13, class: 'AN', designation: 'M' }, // 8-10 digit HTS or 3-digit category, left justified
    { name: 'secondTariffNumber', start: 14, end: 23, class: 'AN', designation: 'O' }, // Ch. 99 / Special Regime pairs, Note 1; spaces when type X
    { name: 'countryOfOrigin', start: 24, end: 25, class: 'X', designation: 'M' }, // ISO country code
    { name: 'filler', start: 26, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Quota Query Results — output Q2-Record (QA-12..14). */
export const OUTPUT_Q2: RecordDef = {
  id: 'Q2',
  name: 'QuotaQueryResults',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q2' },
    { name: 'quotaQueryIdTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // R | X
    { name: 'quotaQueryId', start: 4, end: 13, class: 'AN', designation: 'M' },
    { name: 'quotaId', start: 14, end: 28, class: 'X', designation: 'M' }, // 9-char category code, Note 1 QA-14
    { name: 'countryOfOrigin', start: 29, end: 30, class: 'X', designation: 'M' }, // 99 = all countries/aggregate
    { name: 'quotaLimit', start: 31, end: 41, class: 'N', designation: 'C' }, // spaces when the record has no limit
    { name: 'unitOfMeasureCode', start: 42, end: 44, class: 'X', designation: 'M' },
    // Format NNN.NNN with 3 implied decimals (QA-13).
    { name: 'textileConversionFactor', start: 45, end: 50, class: 'N', designation: 'C' },
    { name: 'beginningPeriodDate', start: 51, end: 56, class: 'D', designation: 'M' },
    { name: 'endingPeriodDate', start: 57, end: 62, class: 'D', designation: 'M' },
    { name: 'quotaPeriod', start: 63, end: 68, class: 'X', designation: 'M' }, // YY + period-within-year
    { name: 'thresholdQuantity', start: 69, end: 79, class: 'N', designation: 'M' },
    { name: 'filler', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Additional Quota Query Results — output Q3-Record (QA-15..16). */
export const OUTPUT_Q3: RecordDef = {
  id: 'Q3',
  name: 'QuotaQueryAdditionalResults',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q3' },
    { name: 'globalIndicator', start: 3, end: 4, class: 'X', designation: 'C' }, // 99 when reported by >1 country
    // PD/ED + OPEN|POTF|FILL|EXPD|BAND|HOLD|EXCL (QA-15).
    { name: 'periodProcessingIndicator', start: 5, end: 10, class: 'X', designation: 'C' },
    { name: 'description', start: 11, end: 50, class: 'X', designation: 'C' },
    { name: 'quotaType', start: 51, end: 53, class: 'X', designation: 'M' }, // TRQ | TPL | ABS | STA
    { name: 'quantityToDate', start: 54, end: 64, class: 'N', designation: 'M' },
    { name: 'recordNumber', start: 65, end: 68, class: 'N', designation: 'M' }, // ordinal of the result record
    { name: 'secondTariffNumber', start: 69, end: 78, class: 'AN', designation: 'C' }, // echoes the input Q1
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Additional Quota Query Results — output Q4-Record (QA-17). */
export const OUTPUT_Q4: RecordDef = {
  id: 'Q4',
  name: 'QuotaQueryStatusResults',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q4' },
    // Spec designation is M but "if there have been no transactions, spaces
    // are returned" (QA-17) — declared C so blank parses cleanly.
    { name: 'lastQuotaTransactionDate', start: 3, end: 8, class: 'D', designation: 'C' },
    { name: 'dateOfStatus', start: 9, end: 14, class: 'D', designation: 'M' },
    { name: 'timeOfStatus', start: 15, end: 18, class: 'N', designation: 'M' }, // HHMM military time
    { name: 'filler', start: 19, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Quota Error Message — output Q5-Record (QA-18..19). */
export const OUTPUT_Q5: RecordDef = {
  id: 'Q5',
  name: 'QuotaQueryError',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q5' },
    { name: 'quotaQueryIdTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // R | X
    { name: 'quotaQueryId', start: 4, end: 13, class: 'AN', designation: 'M' },
    { name: 'countryOfOrigin', start: 14, end: 15, class: 'A', designation: 'M' },
    { name: 'filler', start: 16, end: 17, class: 'S', designation: 'M' },
    { name: 'conditionCode', start: 18, end: 20, class: 'AN', designation: 'M' }, // QUOTA_CONDITION_CODES
    { name: 'filler2', start: 21, end: 22, class: 'S', designation: 'M' },
    { name: 'narrativeText', start: 23, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Q5 condition codes and narrative text (QA-19 Note 1). */
export const QUOTA_CONDITION_CODES = {
  Q05: 'BANNED IMPORT',
  Q40: 'Q1 RECORD MISSING',
  Q41: 'Q1 RECORD COUNT EXCEEDED',
  Q42: 'BAD INPUT RECORD',
  Q43: 'INVALID QUERY TYPE CODE',
  Q44: 'INVALID CATEGORY NUMBER',
  Q45: 'INVALID TARIFF NUMBER',
  Q46: 'NOT USED WITH QUERY TYPE',
  Q47: 'INVALID COUNTRY CODE',
  Q48: 'FILLER NOT BLANK',
  Q49: 'NO QUOTA RECORDS FOR TARIFF',
  Q50: 'NO QUOTA FOR CATEGORY',
} as const;

for (const def of [INPUT_Q1, OUTPUT_Q2, OUTPUT_Q3, OUTPUT_Q4, OUTPUT_Q5]) {
  assertRecordDef(def);
}
