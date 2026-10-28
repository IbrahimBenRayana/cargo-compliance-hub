/**
 * AD/CVD Case Information Query (AD/AC) record definitions — transcribed from
 * the ACE ABI CATAIR "AD/CVD Case Information Query" chapter, July 9, 2026
 * (docs/abi-engine/specs/queries/ad-cvd-case-query-2026-07.pdf). Page
 * references in comments are the chapter's ADQ-n page numbers.
 *
 * Input: Q1 case-number query (up to five case numbers each, repeatable) and
 * Q2 criteria query (one per block; Q1 and Q2 may not be co-mingled in a
 * block) — ADQ-9..14. Output: RA..RJ per-case detail records plus the RX
 * failed-query condition record — ADQ-15..30. Application codes: input AD,
 * response AC (ADQ-7/8; APPLICATION_CODES.adCvdCaseQuery).
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** AD/CVD Case Number Query Request — input Q1-Record (ADQ-10). */
export const INPUT_Q1: RecordDef = {
  id: 'Q1',
  name: 'AdCvdCaseNumberQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q1' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    // 7-digit principal case; 10-digit cases split base/suffix. No dashes.
    { name: 'caseNumber1', start: 4, end: 10, class: 'AN', designation: 'M' },
    { name: 'caseNumber1Suffix', start: 11, end: 13, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 14, end: 14, class: 'S', designation: 'M' },
    { name: 'caseNumber2', start: 15, end: 21, class: 'AN', designation: 'C' },
    { name: 'caseNumber2Suffix', start: 22, end: 24, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 25, end: 25, class: 'S', designation: 'M' },
    { name: 'caseNumber3', start: 26, end: 32, class: 'AN', designation: 'C' },
    { name: 'caseNumber3Suffix', start: 33, end: 35, class: 'AN', designation: 'C' },
    { name: 'filler4', start: 36, end: 36, class: 'S', designation: 'M' },
    { name: 'caseNumber4', start: 37, end: 43, class: 'AN', designation: 'C' },
    { name: 'caseNumber4Suffix', start: 44, end: 46, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 47, end: 47, class: 'S', designation: 'M' },
    { name: 'caseNumber5', start: 48, end: 54, class: 'AN', designation: 'C' },
    { name: 'caseNumber5Suffix', start: 55, end: 57, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** AD/CVD Case Criteria Query Request — input Q2-Record (ADQ-12..13). */
export const INPUT_Q2: RecordDef = {
  id: 'Q2',
  name: 'AdCvdCaseCriteriaQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'Q2' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'companyCaseStatus', start: 4, end: 4, class: 'A', designation: 'M' }, // A | I | B
    { name: 'filler2', start: 5, end: 5, class: 'S', designation: 'M' },
    { name: 'countryCode', start: 6, end: 7, class: 'A', designation: 'C' },
    { name: 'filler3', start: 8, end: 8, class: 'S', designation: 'M' },
    // Spec class "10N or 8N/2S": 8-digit queries are LEFT justified (ADQ-12),
    // so we override the numeric class's default right justification.
    { name: 'htsNumber', start: 9, end: 18, class: 'N', designation: 'C', justify: 'left' },
    { name: 'filler4', start: 19, end: 19, class: 'S', designation: 'M' },
    // Spec class "7N or 5N/2S": 5-digit queries left justified (ADQ-13).
    { name: 'tsusaNumber', start: 20, end: 26, class: 'N', designation: 'C', justify: 'left' },
    { name: 'filler5', start: 27, end: 27, class: 'S', designation: 'M' },
    { name: 'manufacturerIdentificationCode', start: 28, end: 42, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 43, end: 43, class: 'S', designation: 'M' },
    { name: 'foreignExporterIdentificationCode', start: 44, end: 58, class: 'AN', designation: 'C' },
    { name: 'filler7', start: 59, end: 59, class: 'S', designation: 'M' },
    { name: 'dateSinceLastUpdate', start: 60, end: 65, class: 'D', designation: 'C' }, // within 7 days, Note 5
    { name: 'filler8', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** AD/CVD Case General Information — output RA-Record (ADQ-16..17). */
export const OUTPUT_RA: RecordDef = {
  id: 'RA',
  name: 'AdCvdCaseGeneralInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RA' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' }, // A/C + ISO country + commodity + company
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'relatedCaseNumber', start: 14, end: 23, class: 'AN', designation: 'C' }, // 7 or 10 digits since Oct 2019
    { name: 'filler2', start: 24, end: 24, class: 'S', designation: 'M' },
    { name: 'shortDescription', start: 25, end: 54, class: 'X', designation: 'M' },
    { name: 'filler3', start: 55, end: 55, class: 'S', designation: 'M' },
    { name: 'countryCode', start: 56, end: 57, class: 'A', designation: 'M' },
    { name: 'filler4', start: 58, end: 58, class: 'S', designation: 'M' },
    { name: 'companyCaseStatus', start: 59, end: 60, class: 'A', designation: 'M' }, // AC, IC, ID, IF, IL, IO, IS, IT, IX
    { name: 'filler5', start: 61, end: 61, class: 'S', designation: 'M' },
    { name: 'companyCaseStatusEffectiveDate', start: 62, end: 67, class: 'D', designation: 'M' },
    { name: 'filler6', start: 68, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Official Name of the AD/CVD Case — output RB-Record (ADQ-18). */
export const OUTPUT_RB: RecordDef = {
  id: 'RB',
  name: 'AdCvdOfficialCaseName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RB' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'recordSequence', start: 13, end: 13, class: 'AN', designation: 'M' }, // 1..5, 65 chars each
    { name: 'filler', start: 14, end: 14, class: 'S', designation: 'M' },
    { name: 'officialCaseName', start: 15, end: 79, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Manufacturer Details — output RC-Record (ADQ-19). */
export const OUTPUT_RC: RecordDef = {
  id: 'RC',
  name: 'AdCvdManufacturerDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RC' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'recordSequence', start: 13, end: 13, class: 'AN', designation: 'M' }, // 1 new name, 2 continuation
    { name: 'manufacturerIdentificationCode', start: 14, end: 28, class: 'AN', designation: 'C' },
    { name: 'filler', start: 29, end: 29, class: 'S', designation: 'M' },
    { name: 'manufacturerName', start: 30, end: 79, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Foreign Exporter Details — output RD-Record (ADQ-20). */
export const OUTPUT_RD: RecordDef = {
  id: 'RD',
  name: 'AdCvdForeignExporterDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RD' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'recordSequence', start: 13, end: 13, class: 'AN', designation: 'M' }, // 1 new name, 2 continuation
    { name: 'foreignExporterIdentificationCode', start: 14, end: 28, class: 'AN', designation: 'C' },
    { name: 'filler', start: 29, end: 29, class: 'S', designation: 'M' },
    { name: 'foreignExporterName', start: 30, end: 79, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Department of Commerce Contact Information — output RE-Record (ADQ-21). */
export const OUTPUT_RE: RecordDef = {
  id: 'RE',
  name: 'AdCvdCommerceContactInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RE' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'contactOffice', start: 13, end: 32, class: 'AN', designation: 'M' },
    { name: 'contactName', start: 33, end: 52, class: 'AN', designation: 'M' },
    { name: 'contactTelephoneNumber1', start: 53, end: 62, class: 'N', designation: 'M' }, // no dashes
    { name: 'contactTelephoneNumber1Extension', start: 63, end: 66, class: 'N', designation: 'C' },
    { name: 'contactTelephoneNumber2', start: 67, end: 76, class: 'N', designation: 'M' },
    { name: 'contactTelephoneNumber2Extension', start: 77, end: 80, class: 'N', designation: 'C' },
  ],
};

/** Deposit Rate Details — output RF-Record (ADQ-22..23). */
export const OUTPUT_RF: RecordDef = {
  id: 'RF',
  name: 'AdCvdDepositRateDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RF' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'depositRateEffectiveDate', start: 14, end: 19, class: 'D', designation: 'M' },
    { name: 'filler2', start: 20, end: 20, class: 'S', designation: 'M' },
    // Percentage, 2 implied decimals: 10.17% → 001017 (Note 1, ADQ-23).
    { name: 'adValoremDepositRate', start: 21, end: 26, class: 'N', designation: 'C' },
    { name: 'filler3', start: 27, end: 27, class: 'S', designation: 'M' },
    // Dollars and cents, 2 implied decimals: $110.25 → 00011025 (Note 2).
    { name: 'specificDepositRate', start: 28, end: 35, class: 'N', designation: 'C' },
    { name: 'filler4', start: 36, end: 36, class: 'S', designation: 'M' },
    { name: 'unitOfMeasure', start: 37, end: 39, class: 'AN', designation: 'C' }, // Table 1, ADQ-31..32
    { name: 'filler5', start: 40, end: 40, class: 'S', designation: 'M' },
    { name: 'otherUnitOfMeasure', start: 41, end: 65, class: 'AN', designation: 'C' }, // when UOM = OTH
    { name: 'filler6', start: 66, end: 66, class: 'S', designation: 'M' },
    { name: 'rateAddedDate', start: 67, end: 72, class: 'D', designation: 'M' },
    { name: 'filler7', start: 73, end: 73, class: 'S', designation: 'M' },
    { name: 'rateInactivatedDate', start: 74, end: 79, class: 'D', designation: 'C' },
    { name: 'filler8', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Case Events — output RG-Record (ADQ-24). */
export const OUTPUT_RG: RecordDef = {
  id: 'RG',
  name: 'AdCvdCaseEvents',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RG' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'eventEffectiveDate', start: 13, end: 18, class: 'D', designation: 'M' },
    { name: 'event', start: 19, end: 48, class: 'X', designation: 'M' }, // e.g. INITIATION, PRELIM DOC
    { name: 'determination', start: 49, end: 58, class: 'X', designation: 'C' }, // e.g. AFFIRM, NEGATIVE
    { name: 'federalRegisterCitation', start: 59, end: 67, class: 'AN', designation: 'C' }, // e.g. 22FR12345
    { name: 'filler', start: 68, end: 68, class: 'S', designation: 'M' },
    { name: 'eventAddedDate', start: 69, end: 74, class: 'D', designation: 'M' },
    { name: 'eventInactivatedDate', start: 75, end: 80, class: 'D', designation: 'C' },
  ],
};

/** Bond/Cash Details — output RH-Record (ADQ-25). */
export const OUTPUT_RH: RecordDef = {
  id: 'RH',
  name: 'AdCvdBondCashDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RH' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'bondCashEffectiveDate', start: 14, end: 19, class: 'D', designation: 'M' },
    { name: 'filler2', start: 20, end: 20, class: 'S', designation: 'M' },
    { name: 'bondCashIndicator', start: 21, end: 30, class: 'X', designation: 'M' }, // BOND OR CA | CASH ONLY | N/A
    { name: 'filler3', start: 31, end: 31, class: 'S', designation: 'M' },
    { name: 'bondCashIndicatorAddedDate', start: 32, end: 37, class: 'D', designation: 'M' },
    { name: 'filler4', start: 38, end: 38, class: 'S', designation: 'M' },
    { name: 'bondCashIndicatorInactivatedDate', start: 39, end: 44, class: 'D', designation: 'C' },
    { name: 'filler5', start: 45, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Tariff Details — output RI-Record (ADQ-26..27). Up to 3 tariffs each. */
export const OUTPUT_RI: RecordDef = {
  id: 'RI',
  name: 'AdCvdTariffDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RI' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'tariffNumber1', start: 14, end: 23, class: 'AN', designation: 'M' }, // 10AN HTS or 7AN TSUSA + 3S
    { name: 'addedDate1', start: 24, end: 29, class: 'D', designation: 'M' },
    { name: 'inactivatedDate1', start: 30, end: 35, class: 'D', designation: 'C' },
    { name: 'tariffNumber2', start: 36, end: 45, class: 'AN', designation: 'C' },
    { name: 'addedDate2', start: 46, end: 51, class: 'D', designation: 'C' },
    { name: 'inactivatedDate2', start: 52, end: 57, class: 'D', designation: 'C' },
    { name: 'tariffNumber3', start: 58, end: 67, class: 'AN', designation: 'C' },
    { name: 'addedDate3', start: 68, end: 73, class: 'D', designation: 'C' },
    { name: 'inactivatedDate3', start: 74, end: 79, class: 'D', designation: 'C' },
    { name: 'filler2', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Liquidation Suspension Details — output RJ-Record (ADQ-28). */
export const OUTPUT_RJ: RecordDef = {
  id: 'RJ',
  name: 'AdCvdLiquidationSuspensionDetails',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RJ' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'suspensionActionEffectiveDate', start: 14, end: 19, class: 'D', designation: 'M' },
    { name: 'filler2', start: 20, end: 20, class: 'S', designation: 'M' },
    { name: 'suspensionAction', start: 21, end: 25, class: 'AN', designation: 'M' }, // START | STOP
    { name: 'filler3', start: 26, end: 26, class: 'S', designation: 'M' },
    { name: 'suspensionActionAddedDate', start: 27, end: 32, class: 'D', designation: 'M' },
    { name: 'filler4', start: 33, end: 33, class: 'S', designation: 'M' },
    { name: 'suspensionActionInactivatedDate', start: 34, end: 39, class: 'D', designation: 'C' },
    { name: 'filler5', start: 40, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Failed Query Condition — output RX-Record (ADQ-29..30). */
export const OUTPUT_RX: RecordDef = {
  id: 'RX',
  name: 'AdCvdFailedQueryCondition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'RX' },
    { name: 'referenceDataTypeCode', start: 3, end: 5, class: 'AN', designation: 'M' }, // Q1C | Q1E | Q2C
    { name: 'filler', start: 6, end: 6, class: 'S', designation: 'M' },
    { name: 'occurrencePosition', start: 7, end: 12, class: 'N', designation: 'M' },
    { name: 'filler2', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'referenceIdConstant', start: 14, end: 20, class: 'X', designation: 'M' }, // 'REF ID:'
    { name: 'filler3', start: 21, end: 21, class: 'S', designation: 'M' },
    { name: 'referenceDataText', start: 22, end: 34, class: 'X', designation: 'M' }, // case number on Q1E, else spaces
    { name: 'filler4', start: 35, end: 36, class: 'S', designation: 'M' },
    { name: 'conditionCode', start: 37, end: 39, class: 'AN', designation: 'M' }, // Appendix G, AD-CVD tab
    { name: 'filler5', start: 40, end: 40, class: 'S', designation: 'M' },
    { name: 'narrativeText', start: 41, end: 80, class: 'X', designation: 'M' },
  ],
};

for (const def of [
  INPUT_Q1,
  INPUT_Q2,
  OUTPUT_RA,
  OUTPUT_RB,
  OUTPUT_RC,
  OUTPUT_RD,
  OUTPUT_RE,
  OUTPUT_RF,
  OUTPUT_RG,
  OUTPUT_RH,
  OUTPUT_RI,
  OUTPUT_RJ,
  OUTPUT_RX,
]) {
  assertRecordDef(def);
}
