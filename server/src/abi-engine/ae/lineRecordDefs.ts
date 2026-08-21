/**
 * Entry Summary (AE) LINE-ITEM & TOTALS input record definitions — transcribed
 * from the ACE ABI CATAIR "Entry Summary Create/Update" chapter, July 2026
 * (docs/abi-engine/specs/entry-summary/ae-ax-create-update-2026-07.pdf).
 *
 * Covers the Entry Summary LINE ITEM Grouping records (40, 41, 42, 43, 44, 47,
 * SE50–SE56, 50, SE60, SE61, OI, 51, 52, 53, 54, 60, 61, 62, SE62, SE63, 63,
 * CW02) and the Entry Summary TOTALS Grouping records (88, 89, 90).
 * Page references in comments are to the chapter's ESF-n page numbers.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── Entry Summary LINE ITEM Grouping ───────────────────────

/** Line Item Header — input 40-Record (ESF-65 to ESF-70). */
export const INPUT_40: RecordDef = {
  id: '40',
  name: 'LineItemHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '40' },
    { name: 'filler', start: 3, end: 4, class: 'S', designation: 'M' }, // reserved for Line Item Identifier expansion
    { name: 'lineItemIdentifier', start: 5, end: 7, class: 'X', designation: 'M' },
    { name: 'articleSetIndicator', start: 8, end: 8, class: 'AN', designation: 'C' }, // X = set header, V = set component
    { name: 'countryOfOriginCode', start: 9, end: 10, class: 'X', designation: 'M' }, // ISO code or '**' if unknown
    { name: 'countryOfExportCode', start: 11, end: 12, class: 'AN', designation: 'C' },
    { name: 'dateOfExportation', start: 13, end: 18, class: 'D', designation: 'C' },
    { name: 'textileExportDate', start: 19, end: 24, class: 'D', designation: 'C' }, // Date of Exportation (for Textiles)
    // Printed 2AN, but the chapter's own SPI values include 'A+' and 'S+'
    // (GSP-LDC, USMCA TPL — cert scenario 027), so class X in practice.
    { name: 'spiClaimCode', start: 25, end: 26, class: 'X', designation: 'C' }, // Trade Agreement/Special Program Claim Code
    { name: 'chargesAmount', start: 27, end: 36, class: 'SN', designation: 'C' }, // whole U.S. dollars
    { name: 'foreignPortOfLadingCode', start: 37, end: 41, class: 'AN', designation: 'C' },
    { name: 'grossShippingWeight', start: 42, end: 51, class: 'SN', designation: 'C' }, // kilograms
    { name: 'textileCategoryCode', start: 52, end: 54, class: 'N', designation: 'C' }, // Category Code (for Textiles)
    { name: 'productClaimCode', start: 55, end: 55, class: 'AN', designation: 'C' },
    { name: 'relatedPartyIndicator', start: 56, end: 56, class: 'AN', designation: 'C' }, // Y | N
    { name: 'naftaNetCostIndicator', start: 57, end: 57, class: 'AN', designation: 'C' },
    { name: 'feeExemptionCode', start: 58, end: 58, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 59, end: 59, class: 'S', designation: 'M' },
    { name: 'adCaseNonReimbursementStatement', start: 60, end: 60, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 61, end: 80, class: 'S', designation: 'M' },
  ],
};

/** FTZ Status Information — input 41-Record (ESF-72). */
export const INPUT_41: RecordDef = {
  id: '41',
  name: 'FtzStatusInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '41' },
    { name: 'ftzMerchandiseStatusCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // P | N | D
    { name: 'privilegedFtzMerchandiseFilingDate', start: 4, end: 9, class: 'D', designation: 'C' },
    { name: 'ftzLineItemQuantity', start: 10, end: 19, class: 'N', designation: 'M' }, // whole units, > 0
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Invoice Line Reference Detail — input 42-Record (ESF-74 to ESF-75). */
export const INPUT_42: RecordDef = {
  id: '42',
  name: 'InvoiceLineReferenceDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '42' },
    { name: 'supplierIdCode', start: 3, end: 17, class: 'AN', designation: 'M' },
    { name: 'invoiceNumber', start: 18, end: 34, class: 'X', designation: 'M' }, // alphanumeric and dash only
    { name: 'filler', start: 35, end: 35, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange1Begin', start: 36, end: 39, class: 'SN', designation: 'M' },
    { name: 'filler2', start: 40, end: 40, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange1End', start: 41, end: 44, class: 'SN', designation: 'M' },
    { name: 'filler3', start: 45, end: 45, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange2Begin', start: 46, end: 49, class: 'SN', designation: 'C' },
    { name: 'filler4', start: 50, end: 50, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange2End', start: 51, end: 54, class: 'SN', designation: 'C' },
    { name: 'filler5', start: 55, end: 55, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange3Begin', start: 56, end: 59, class: 'SN', designation: 'C' },
    { name: 'filler6', start: 60, end: 60, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange3End', start: 61, end: 64, class: 'SN', designation: 'C' },
    { name: 'filler7', start: 65, end: 65, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange4Begin', start: 66, end: 69, class: 'SN', designation: 'C' },
    { name: 'filler8', start: 70, end: 70, class: 'S', designation: 'M' },
    { name: 'invoiceLineRange4End', start: 71, end: 74, class: 'SN', designation: 'C' },
    { name: 'filler9', start: 75, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Ruling Detail — input 43-Record (ESF-76). */
export const INPUT_43: RecordDef = {
  id: '43',
  name: 'RulingDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '43' },
    { name: 'rulingTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // C | P | R
    { name: 'filler', start: 4, end: 8, class: 'S', designation: 'M' }, // reserved for Ruling Number expansion
    { name: 'rulingNumber', start: 9, end: 14, class: 'AN', designation: 'C' }, // numeric portion only
    { name: 'filler2', start: 15, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Commercial Description — input 44-Record (ESF-77). */
export const INPUT_44: RecordDef = {
  id: '44',
  name: 'CommercialDescription',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '44' },
    { name: 'commercialDescriptionText', start: 3, end: 72, class: 'X', designation: 'M' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Article Party — input 47-Record (ESF-78 to ESF-79). */
export const INPUT_47: RecordDef = {
  id: '47',
  name: 'ArticleParty',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '47' },
    { name: 'articlePartyTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // M | C | S | E
    // Printed as 15AN (ESF-78), but Usage Note (f) mandates hyphenated
    // IRS/SSN/CBP-assigned formats (NN-NNNNNNNss) for C/S party types —
    // the usage note wins, so class X to admit the hyphen.
    { name: 'articlePartyIdentifier', start: 4, end: 18, class: 'X', designation: 'M' },
    { name: 'filler', start: 19, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Name (line level) — input SE50-Record (ESF-80 to ESF-81). */
export const INPUT_SE50: RecordDef = {
  id: 'SE50',
  name: 'EntityName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE50' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' },
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' },
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'C' },
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'C' },
    { name: 'filler', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity GBI Identifier (line level) — input SE51-Record (ESF-85). */
export const INPUT_SE51: RecordDef = {
  id: 'SE51',
  name: 'EntityGbiIdentifier',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE51' },
    { name: 'gbiIdentifierQualifier', start: 5, end: 8, class: 'A', designation: 'M' }, // LEI | GLN | DUNS | ALTA
    { name: 'identifier', start: 9, end: 43, class: 'AN', designation: 'M' },
    { name: 'filler', start: 44, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity GBI Party Type Description (line level) — input SE52-Record (ESF-86). */
export const INPUT_SE52: RecordDef = {
  id: 'SE52',
  name: 'EntityGbiPartyTypeDescription',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE52' },
    { name: 'sequenceNumber', start: 5, end: 5, class: 'N', designation: 'M' },
    { name: 'description', start: 6, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Entity Address (line level) — input SE55-Record (ESF-87). */
export const INPUT_SE55: RecordDef = {
  id: 'SE55',
  name: 'EntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE55' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' },
    { name: 'addressInformation1', start: 7, end: 41, class: 'X', designation: 'M' },
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    { name: 'addressInformation2', start: 44, end: 78, class: 'X', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Geographic Area (line level) — input SE56-Record (ESF-88). */
export const INPUT_SE56: RecordDef = {
  id: 'SE56',
  name: 'EntityGeographicArea',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE56' },
    { name: 'cityName', start: 5, end: 39, class: 'X', designation: 'M' },
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'C' }, // ISO subdivision code
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' },
    { name: 'postalCode', start: 49, end: 63, class: 'X', designation: 'C' },
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' },
    // Spec layout ends at position 65; trailing filler added to complete the 80-char record.
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Tariff/Value/Quantity Detail — input 50-Record (ESF-89 to ESF-90). */
export const INPUT_50: RecordDef = {
  id: '50',
  name: 'TariffValueQuantityDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '50' },
    { name: 'htsNumber', start: 3, end: 12, class: 'AN', designation: 'M' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' },
    { name: 'dutyAmount', start: 14, end: 23, class: 'SN', designation: 'M' }, // dollars & cents; 2 implied decimals
    { name: 'filler2', start: 24, end: 24, class: 'S', designation: 'M' },
    { name: 'valueOfGoodsAmount', start: 25, end: 34, class: 'SN', designation: 'M' }, // whole U.S. dollars
    { name: 'filler3', start: 35, end: 35, class: 'S', designation: 'M' },
    { name: 'quantity1', start: 36, end: 47, class: 'SN', designation: 'C' }, // 2 implied decimals
    // Printed designation M, relaxed to C: CERT's floor rejects ANY UOM on a
    // zero-reporting-unit tariff (9999.00.84 live evidence, Aug 21 2026 —
    // 'X' → F441, 'NO' → F442; CERT's own HA query returns 0 units for it).
    // Same printed-vs-wire family as the '*F'/'A+'/$-appId relaxations.
    { name: 'uomCode1', start: 48, end: 50, class: 'AN', designation: 'C' },
    { name: 'quantity2', start: 51, end: 62, class: 'SN', designation: 'C' }, // 2 implied decimals
    { name: 'uomCode2', start: 63, end: 65, class: 'AN', designation: 'C' },
    { name: 'quantity3', start: 66, end: 77, class: 'SN', designation: 'C' }, // 2 implied decimals
    { name: 'uomCode3', start: 78, end: 80, class: 'AN', designation: 'C' },
  ],
};

/** Cargo HTS Additional Detail — input SE60-Record (ESF-91). */
export const INPUT_SE60: RecordDef = {
  id: 'SE60',
  name: 'CargoHtsAdditionalDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE60' },
    { name: 'sanctionDisclaimIndicator', start: 5, end: 5, class: 'A', designation: 'C' }, // Y = not subject to sanctions
    { name: 'filler', start: 6, end: 80, class: 'S', designation: 'M' },
  ],
};

/** FTZ Privileged Foreign Status Add'l Detail — input SE61-Record (ESF-92). */
export const INPUT_SE61: RecordDef = {
  id: 'SE61',
  name: 'FtzPrivilegedForeignStatusAdditionalDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE61' },
    { name: 'currentHtsNumberForPfStatusMerchandise', start: 5, end: 14, class: 'AN', designation: 'M' },
    { name: 'filler', start: 15, end: 80, class: 'S', designation: 'M' },
  ],
};

/** PGA Commercial Description — input OI-Record (ESF-93). */
export const INPUT_OI: RecordDef = {
  id: 'OI',
  name: 'PgaCommercialDescription',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'OI' },
    { name: 'filler', start: 3, end: 10, class: 'S', designation: 'M' },
    { name: 'commercialDescriptionText', start: 11, end: 80, class: 'AN', designation: 'M' },
  ],
};

/** Standard Visa Information — input 51-Record (ESF-94). */
export const INPUT_51: RecordDef = {
  id: '51',
  name: 'StandardVisaInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '51' },
    { name: 'standardVisaNumber', start: 3, end: 11, class: 'AN', designation: 'M' },
    { name: 'filler', start: 12, end: 80, class: 'S', designation: 'M' },
  ],
};

/** License/Certificate/Permit Detail — input 52-Record (ESF-95 to ESF-97). */
export const INPUT_52: RecordDef = {
  id: '52',
  name: 'LicenseCertificatePermitDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '52' },
    { name: 'licenseCertificatePermitTypeCode', start: 3, end: 4, class: 'AN', designation: 'M' },
    { name: 'licenseCertificatePermitNumber', start: 5, end: 14, class: 'X', designation: 'M' },
    { name: 'filler', start: 15, end: 24, class: 'S', designation: 'M' }, // reserved for Number expansion
    { name: 'filler2', start: 25, end: 80, class: 'S', designation: 'M' },
  ],
};

/** AD/CVD Case Detail — input 53-Record (ESF-98 to ESF-99). */
export const INPUT_53: RecordDef = {
  id: '53',
  name: 'AdCvdCaseDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '53' },
    { name: 'caseNumber', start: 3, end: 12, class: 'AN', designation: 'M' }, // no hyphens
    { name: 'bondCashClaimCode', start: 13, end: 13, class: 'AN', designation: 'M' }, // B | C
    { name: 'caseDepositRate', start: 14, end: 21, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'caseRateTypeQualifierCode', start: 22, end: 22, class: 'AN', designation: 'M' }, // A | S
    { name: 'filler', start: 23, end: 24, class: 'S', designation: 'M' },
    { name: 'adCvdValueOfGoodsAmount', start: 25, end: 34, class: 'SN', designation: 'C' }, // whole U.S. dollars
    { name: 'adCvdQuantity', start: 35, end: 46, class: 'SN', designation: 'C' }, // 4 implied decimals
    { name: 'adCvdDutyAmount', start: 47, end: 56, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'adCvdNonReimbursementDeclarationId', start: 57, end: 66, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 67, end: 80, class: 'S', designation: 'M' },
  ],
};

/**
 * Importer's Additional Declaration Detail — input 54-Record (ESF-101).
 * Base layout only; the per-declaration-type sub-layouts of positions 5-80
 * (Types 01-12, ESF-102 to ESF-117) are handled elsewhere.
 */
export const INPUT_54: RecordDef = {
  id: '54',
  name: 'ImportersAdditionalDeclarationDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '54' },
    { name: 'declarationTypeCode', start: 3, end: 4, class: 'AN', designation: 'M' }, // 01-12
    { name: 'declarationInformation', start: 5, end: 80, class: 'X', designation: 'M' },
  ],
};

/** IR Tax Information — input 60-Record (ESF-118). */
export const INPUT_60: RecordDef = {
  id: '60',
  name: 'IrTaxInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '60' },
    { name: 'accountingClassCode', start: 3, end: 5, class: 'AN', designation: 'M' }, // AE Table 13
    { name: 'irTaxAmount', start: 6, end: 15, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'filler', start: 16, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Other Revenue Information — input 61-Record (ESF-118). */
export const INPUT_61: RecordDef = {
  id: '61',
  name: 'OtherRevenueInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '61' },
    { name: 'accountingClassCode', start: 3, end: 5, class: 'AN', designation: 'M' }, // AE Table 17
    { name: 'otherRevenueAmount', start: 6, end: 15, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'filler', start: 16, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Line User Fee Detail — input 62-Record (ESF-120). */
export const INPUT_62: RecordDef = {
  id: '62',
  name: 'LineUserFeeDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '62' },
    { name: 'accountingClassCode', start: 3, end: 5, class: 'AN', designation: 'M' }, // AE Table 6
    { name: 'userFeeAmount', start: 6, end: 13, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'filler', start: 14, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Cargo Sanctions Record Identifier Detail — input SE62-Record (ESF-121). */
export const INPUT_SE62: RecordDef = {
  id: 'SE62',
  name: 'CargoSanctionsRecordIdentifierDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE62' },
    { name: 'recordId', start: 5, end: 6, class: 'N', designation: 'M' },
    { name: 'recordType', start: 7, end: 16, class: 'AN', designation: 'M' }, // FSHNG INFO | MINE INFO
    { name: 'fieldName', start: 17, end: 80, class: 'AN', designation: 'M' },
  ],
};

/** Cargo Sanctions Record Detail — input SE63-Record (ESF-124). */
export const INPUT_SE63: RecordDef = {
  id: 'SE63',
  name: 'CargoSanctionsRecordDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE63' },
    { name: 'fieldValue', start: 5, end: 80, class: 'AN', designation: 'M' },
  ],
};

/** PSC Line Reasons — input 63-Record (ESF-125). */
export const INPUT_63: RecordDef = {
  id: '63',
  name: 'PscLineReasons',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '63' },
    { name: 'postSummaryCorrectionLineReasonCode1', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'postSummaryCorrectionLineReasonCode2', start: 6, end: 8, class: 'AN', designation: 'C' },
    { name: 'postSummaryCorrectionLineReasonCode3', start: 9, end: 11, class: 'AN', designation: 'C' },
    { name: 'postSummaryCorrectionLineReasonCode4', start: 12, end: 14, class: 'AN', designation: 'C' },
    { name: 'postSummaryCorrectionLineReasonCode5', start: 15, end: 17, class: 'AN', designation: 'C' },
    { name: 'filler', start: 18, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Census Warning Condition Override Information — input CW02-Record (ESF-126). */
export const INPUT_CW02: RecordDef = {
  id: 'CW02',
  name: 'CensusWarningConditionOverrideInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'CW02' },
    { name: 'filler', start: 5, end: 9, class: 'S', designation: 'M' },
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

// ── Entry Summary TOTALS Grouping ──────────────────────────

/** AD/CVD Duty Totals — input 88-Record (ESF-128). */
export const INPUT_88: RecordDef = {
  id: '88',
  name: 'AdCvdDutyTotals',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '88' },
    { name: 'totalBondedAdDutyAmount', start: 3, end: 13, class: 'SN', designation: 'C' }, // 2 implied decimals
    { name: 'filler', start: 14, end: 14, class: 'S', designation: 'M' },
    { name: 'totalCashDepositAdDutyAmount', start: 15, end: 25, class: 'SN', designation: 'C' },
    { name: 'filler2', start: 26, end: 26, class: 'S', designation: 'M' },
    { name: 'totalBondedCvDutyAmount', start: 27, end: 37, class: 'SN', designation: 'C' },
    { name: 'filler3', start: 38, end: 38, class: 'S', designation: 'M' },
    { name: 'totalCashDepositCvDutyAmount', start: 39, end: 49, class: 'SN', designation: 'C' },
    { name: 'filler4', start: 50, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Fee Total Detail — input 89-Record (ESF-129). */
export const INPUT_89: RecordDef = {
  id: '89',
  name: 'FeeTotalDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '89' },
    { name: 'accountingClassCode1', start: 3, end: 5, class: 'N', designation: 'M' }, // spec class 3N
    { name: 'totalFeeAmount1', start: 6, end: 16, class: 'SN', designation: 'M' }, // 2 implied decimals
    { name: 'accountingClassCode2', start: 17, end: 19, class: 'AN', designation: 'C' },
    { name: 'totalFeeAmount2', start: 20, end: 30, class: 'SN', designation: 'C' },
    { name: 'accountingClassCode3', start: 31, end: 33, class: 'AN', designation: 'C' },
    { name: 'totalFeeAmount3', start: 34, end: 44, class: 'SN', designation: 'C' },
    { name: 'accountingClassCode4', start: 45, end: 47, class: 'AN', designation: 'C' },
    { name: 'totalFeeAmount4', start: 48, end: 58, class: 'SN', designation: 'C' },
    { name: 'accountingClassCode5', start: 59, end: 61, class: 'AN', designation: 'C' },
    { name: 'totalFeeAmount5', start: 62, end: 72, class: 'SN', designation: 'C' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Grand Totals — input 90-Record (ESF-131). */
export const INPUT_90: RecordDef = {
  id: '90',
  name: 'GrandTotals',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '90' },
    { name: 'grandTotalDutyAmount', start: 3, end: 13, class: 'SN', designation: 'C' }, // 2 implied decimals
    { name: 'filler', start: 14, end: 14, class: 'S', designation: 'M' },
    { name: 'grandTotalUserFeeAmount', start: 15, end: 25, class: 'SN', designation: 'C' },
    { name: 'filler2', start: 26, end: 26, class: 'S', designation: 'M' },
    { name: 'grandTotalIrTaxAmount', start: 27, end: 37, class: 'SN', designation: 'C' },
    { name: 'filler3', start: 38, end: 38, class: 'S', designation: 'M' },
    { name: 'grandTotalAdDutyAmount', start: 39, end: 49, class: 'SN', designation: 'C' },
    { name: 'filler4', start: 50, end: 50, class: 'S', designation: 'M' },
    { name: 'grandTotalCvDutyAmount', start: 51, end: 61, class: 'SN', designation: 'C' },
    { name: 'filler5', start: 62, end: 62, class: 'S', designation: 'M' },
    { name: 'grandTotalOtherRevenueAmount', start: 63, end: 73, class: 'SN', designation: 'C' },
    { name: 'filler6', start: 74, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [
  INPUT_40,
  INPUT_41,
  INPUT_42,
  INPUT_43,
  INPUT_44,
  INPUT_47,
  INPUT_SE50,
  INPUT_SE51,
  INPUT_SE52,
  INPUT_SE55,
  INPUT_SE56,
  INPUT_50,
  INPUT_SE60,
  INPUT_SE61,
  INPUT_OI,
  INPUT_51,
  INPUT_52,
  INPUT_53,
  INPUT_54,
  INPUT_60,
  INPUT_61,
  INPUT_62,
  INPUT_SE62,
  INPUT_SE63,
  INPUT_63,
  INPUT_CW02,
  INPUT_88,
  INPUT_89,
  INPUT_90,
]) {
  assertRecordDef(def);
}
