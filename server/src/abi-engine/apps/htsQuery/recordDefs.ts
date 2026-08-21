/**
 * Harmonized Tariff Schedule Query (HA/HY) record definitions — transcribed
 * from the ACE ABI CATAIR "Harmonized Tariff Schedule (HTS)" chapter, March
 * 2023 (docs/abi-engine/specs/reference-data/hts-query-2023-03.pdf). Page
 * references in comments are the chapter's HTS-n page numbers.
 *
 * Input: W query request — one individual tariff number or a range; no more
 * than 100 tariff numbers per query (HTS-46). Output: for each W request,
 * conditional detail records W1 through W9, WA through WL, FOLLOWED by the
 * mandatory W0 record whose narrative either reports the number of tariff
 * numbers in the range or carries the error text (HTS-47). Application
 * codes: input HA, response HY (HTS-8; APPLICATION_CODES.htsQuery).
 *
 * Transcription notes (ambiguities resolved):
 * - The chapter splits position 1 (Control Identifier) and position 2
 *   (Record Identifier) into two data elements; they are transcribed as a
 *   single 2-char constant per this codebase's convention (cf. quota Q2).
 *   The input W record is the exception: position 2 is a space filler
 *   (HTS-46), so its control identifier is the single character W.
 * - Date fields the chapter classes as 6N in MMDDYY format (As of Date,
 *   effective dates) are declared class D so the codec validates them as
 *   dates on write; parseRecord never class-validates, so blanks parse
 *   cleanly. The 4N MMDD restriction dates of W4 stay class N (class D
 *   means a full MMDDYY date).
 * - Fillers the chapter prints as "Space fill" AN/X are declared class S so
 *   the writer enforces spaces (cf. quota Q5).
 * - W5-W9 and WA-WC print identical layouts (special rate + tax/fee,
 *   HTS-55..70), as do WE-WK (special rate only, HTS-72..78); they are
 *   generated from two factories keyed by record identifier.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

// ── Input record ───────────────────────────────────────────

/** HTS Query Request — input W-Record (HTS-46). */
export const INPUT_W: RecordDef = {
  id: 'W',
  name: 'HtsQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'W' },
    { name: 'filler', start: 2, end: 2, class: 'S', designation: 'M' },
    { name: 'fromTariffNumber', start: 3, end: 12, class: 'X', designation: 'M' }, // 8-10 digits, left justified (Note 1)
    { name: 'asOfDate', start: 13, end: 18, class: 'D', designation: 'C' }, // MMDDYY; current date assumed when blank
    { name: 'toTariffNumber', start: 19, end: 28, class: 'X', designation: 'C' }, // space fill to query one number (Note 1)
    { name: 'filler2', start: 29, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Output records ─────────────────────────────────────────

/** Query echo + narrative — mandatory output W0-Record (HTS-47). */
export const OUTPUT_W0: RecordDef = {
  id: 'W0',
  name: 'HtsQueryNarrative',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'W0' },
    { name: 'fromTariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'asOfDate', start: 13, end: 18, class: 'D', designation: 'C' },
    { name: 'toTariffNumber', start: 19, end: 28, class: 'AN', designation: 'C' },
    // Error text, or the number of tariff numbers in the range, or
    // RANGE EXCEEDS 100 (HTS-47).
    { name: 'narrativeMessage', start: 29, end: 68, class: 'X', designation: 'M' },
    { name: 'filler', start: 69, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Effective dates, units, description, column 1 specific rate — output W1-Record (HTS-48..49). */
export const OUTPUT_W1: RecordDef = {
  id: 'W1',
  name: 'HtsQueryBaseData',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'W1' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'recordBeginEffectiveDate', start: 14, end: 19, class: 'D', designation: 'M' }, // MMDDYY
    { name: 'recordEndEffectiveDate', start: 20, end: 25, class: 'D', designation: 'M' }, // MMDDYY
    { name: 'numberOfReportingUnits', start: 26, end: 26, class: 'N', designation: 'M' },
    { name: 'unit1', start: 27, end: 29, class: 'X', designation: 'C' }, // Appendix C UOM; X = none required
    { name: 'unit2', start: 30, end: 32, class: 'X', designation: 'C' },
    { name: 'unit3', start: 33, end: 35, class: 'X', designation: 'C' },
    { name: 'dutyComputationCode', start: 36, end: 36, class: 'X', designation: 'M' }, // Appendix F; X = complex rate
    { name: 'commodityDescription', start: 37, end: 66, class: 'X', designation: 'C' },
    { name: 'column1SpecificRate', start: 67, end: 78, class: 'N', designation: 'C' }, // 8 implied decimals
    { name: 'baseRateIndicator', start: 79, end: 79, class: 'X', designation: 'C' }, // B = base rate
    { name: 'filler2', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Column 1/2 rates, CVD flag, additional tariff indicator — output W2-Record (HTS-50..51). */
export const OUTPUT_W2: RecordDef = {
  id: 'W2',
  name: 'HtsQueryRates',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'W2' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'column1RateAdValorem', start: 13, end: 24, class: 'N', designation: 'C' }, // 8 implied decimals
    { name: 'column1RateOther', start: 25, end: 36, class: 'N', designation: 'C' },
    { name: 'column2RateSpecific', start: 37, end: 48, class: 'N', designation: 'C' },
    { name: 'column2RateAdValorem', start: 49, end: 60, class: 'N', designation: 'C' },
    { name: 'column2RateOther', start: 61, end: 72, class: 'N', designation: 'C' },
    { name: 'countervailingDutyFlag', start: 73, end: 73, class: 'X', designation: 'C' }, // 1 = subject to CVD
    { name: 'additionalTariffNumberIndicator', start: 74, end: 74, class: 'X', designation: 'C' }, // R = may be required
    { name: 'miscPermitLicenseIndicator', start: 75, end: 76, class: 'AN', designation: 'C' }, // V2 Note 1 codes (HTS-13)
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' },
  ],
};

/** GSP exclusions, AD flag, quota indicator, category, SPI codes — output W3-Record (HTS-52). */
export const OUTPUT_W3: RecordDef = {
  id: 'W3',
  name: 'HtsQueryPrograms',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'W3' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'gspExcludedCountries', start: 13, end: 32, class: 'X', designation: 'C' }, // up to ten 2-char ISO codes
    { name: 'filler', start: 33, end: 47, class: 'S', designation: 'M' }, // mandatory space fill (Rev 2)
    { name: 'antidumpingDutyFlag', start: 48, end: 48, class: 'X', designation: 'C' }, // 1 = subject to ADD
    { name: 'quotaIndicator', start: 49, end: 49, class: 'X', designation: 'C' }, // 1 = subject to quota
    { name: 'categoryNumber', start: 50, end: 52, class: 'N', designation: 'C' }, // textile category
    { name: 'spiCodes', start: 53, end: 80, class: 'X', designation: 'C' }, // up to fourteen 2-char codes (V3 Note 2)
  ],
};

/** Value/quantity edits, date restrictions, origin edit — output W4-Record (HTS-53..54). */
export const OUTPUT_W4: RecordDef = {
  id: 'W4',
  name: 'HtsQueryEdits',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'W4' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'valueEditCode', start: 13, end: 15, class: 'X', designation: 'C' }, // V4 Note 1 codes
    { name: 'valueLowBounds', start: 16, end: 25, class: 'N', designation: 'C' }, // 5 implied decimals
    { name: 'valueHighBounds', start: 26, end: 35, class: 'N', designation: 'C' },
    { name: 'entryDateRestrictionCode1', start: 36, end: 36, class: 'X', designation: 'C' }, // V4 Note 2 codes
    { name: 'beginRestrictionDate1', start: 37, end: 40, class: 'N', designation: 'C' }, // MMDD
    { name: 'endRestrictionDate1', start: 41, end: 44, class: 'N', designation: 'C' },
    { name: 'entryDateRestrictionCode2', start: 45, end: 45, class: 'X', designation: 'C' },
    { name: 'beginRestrictionDate2', start: 46, end: 49, class: 'N', designation: 'C' },
    { name: 'endRestrictionDate2', start: 50, end: 53, class: 'N', designation: 'C' },
    { name: 'isoCountryOfOriginEditCode', start: 54, end: 55, class: 'X', designation: 'C' }, // ISO code | 01 | 02
    { name: 'filler', start: 56, end: 57, class: 'S', designation: 'M' },
    { name: 'quantityEditCode', start: 58, end: 60, class: 'N', designation: 'C' }, // V4 Note 3 codes
    { name: 'quantityEditLowBounds', start: 61, end: 70, class: 'N', designation: 'C' }, // 5 implied decimals
    { name: 'quantityEditHighBounds', start: 71, end: 80, class: 'N', designation: 'C' },
  ],
};

/** Additional SPI codes 15-30 beyond the W3 record — output WD-Record (HTS-71). */
export const OUTPUT_WD: RecordDef = {
  id: 'WD',
  name: 'HtsQueryAdditionalSpi',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'WD' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'spiCodes', start: 13, end: 44, class: 'X', designation: 'C' }, // up to sixteen additional 2-char codes
    { name: 'filler', start: 45, end: 80, class: 'S', designation: 'M' },
  ],
};

/** PGA indicator codes for the tariff number — output WL-Record (HTS-79). */
export const OUTPUT_WL: RecordDef = {
  id: 'WL',
  name: 'HtsQueryPgaIndicators',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'WL' },
    { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
    { name: 'pgaCodes', start: 13, end: 72, class: 'X', designation: 'C' }, // up to twenty 3-char PGA codes (Note 1)
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Repeating special-rate families ────────────────────────

/** Record identifiers of the special rate + tax/fee family (HTS-55..70). */
export const SPECIAL_RATE_TAX_FEE_IDS = ['W5', 'W6', 'W7', 'W8', 'W9', 'WA', 'WB', 'WC'] as const;

/** Record identifiers of the special-rate-only family (HTS-72..78). */
export const SPECIAL_RATE_ONLY_IDS = ['WE', 'WF', 'WG', 'WH', 'WI', 'WJ', 'WK'] as const;

/** ISO country, special rates, tax/fee data — W5..W9, WA..WC (HTS-55..70). */
function specialRateTaxFeeDef(id: string): RecordDef {
  return {
    id,
    name: `HtsQuerySpecialRateTaxFee${id}`,
    fields: [
      { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: id },
      { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
      { name: 'isoCountryCode', start: 13, end: 14, class: 'X', designation: 'C' }, // ISO code; also E/J/R + space
      { name: 'specificSpecialRate', start: 15, end: 26, class: 'N', designation: 'C' }, // 8 implied decimals
      { name: 'adValoremSpecialRate', start: 27, end: 38, class: 'N', designation: 'C' },
      { name: 'otherSpecialRate', start: 39, end: 50, class: 'N', designation: 'C' },
      { name: 'taxFeeClassCode', start: 51, end: 53, class: 'X', designation: 'C' }, // Appendix B
      { name: 'taxFeeComputationCode', start: 54, end: 54, class: 'X', designation: 'C' }, // Appendix F
      { name: 'taxFeeFlag', start: 55, end: 55, class: 'X', designation: 'C' }, // 1 required | 2 may be required
      { name: 'taxFeeSpecificRate', start: 56, end: 67, class: 'N', designation: 'C' }, // 8 implied decimals
      { name: 'taxFeeAdValoremRate', start: 68, end: 79, class: 'N', designation: 'C' },
      { name: 'filler', start: 80, end: 80, class: 'S', designation: 'M' },
    ],
  };
}

/** ISO country + special rates only — WE..WK (HTS-72..78). */
function specialRateOnlyDef(id: string): RecordDef {
  return {
    id,
    name: `HtsQuerySpecialRate${id}`,
    fields: [
      { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: id },
      { name: 'tariffNumber', start: 3, end: 12, class: 'X', designation: 'M' },
      { name: 'isoCountryCode', start: 13, end: 14, class: 'X', designation: 'C' },
      { name: 'specificSpecialRate', start: 15, end: 26, class: 'N', designation: 'C' }, // 8 implied decimals
      { name: 'adValoremSpecialRate', start: 27, end: 38, class: 'N', designation: 'C' },
      { name: 'otherSpecialRate', start: 39, end: 50, class: 'N', designation: 'C' },
      { name: 'filler', start: 51, end: 80, class: 'S', designation: 'M' },
    ],
  };
}

/** One RecordDef per W5..WC identifier, keyed by identifier. */
export const OUTPUT_SPECIAL_RATE_TAX_FEE: Readonly<Record<string, RecordDef>> = Object.fromEntries(
  SPECIAL_RATE_TAX_FEE_IDS.map((id) => [id, specialRateTaxFeeDef(id)])
);

/** One RecordDef per WE..WK identifier, keyed by identifier. */
export const OUTPUT_SPECIAL_RATE_ONLY: Readonly<Record<string, RecordDef>> = Object.fromEntries(
  SPECIAL_RATE_ONLY_IDS.map((id) => [id, specialRateOnlyDef(id)])
);

for (const def of [
  INPUT_W,
  OUTPUT_W0,
  OUTPUT_W1,
  OUTPUT_W2,
  OUTPUT_W3,
  OUTPUT_W4,
  OUTPUT_WD,
  OUTPUT_WL,
  ...Object.values(OUTPUT_SPECIAL_RATE_TAX_FEE),
  ...Object.values(OUTPUT_SPECIAL_RATE_ONLY),
]) {
  assertRecordDef(def);
}
