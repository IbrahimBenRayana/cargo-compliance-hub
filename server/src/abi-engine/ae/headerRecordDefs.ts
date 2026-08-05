/**
 * Entry Summary (AE) HEADER-level input record definitions — transcribed from
 * the ACE ABI CATAIR "Entry Summary Create/Update" chapter, July 2026
 * (docs/abi-engine/specs/entry-summary/ae-ax-create-update-2026-07.pdf).
 *
 * Covers the Entry Summary HEADER Grouping input records: 10, 11, 20, SE13,
 * 21, 22, 23, SE16, SE17, 30, 31, 32, 33, 34, 35, 36, SE20, SE30, SE31,
 * SE32, SE35, and SE36. Page references in comments are to the chapter's
 * ESF-n page numbers. Positions are transcribed digit-for-digit from the
 * spec's Position column; every spec "Filler" row (including reserved
 * expansion fillers and fillers printed with class X) is an explicit
 * class-'S' mandatory field so each record tiles positions 1-80.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

/** Entry Summary Header Control — input 10-Record (ESF-26 to ESF-34). */
export const INPUT_10: RecordDef = {
  id: '10',
  name: 'EntrySummaryHeaderControl',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '10' },
    { name: 'actionRequestCode', start: 3, end: 3, class: 'A', designation: 'M' }, // A | R | D
    { name: 'entryFilerCode', start: 4, end: 6, class: 'AN', designation: 'M' },
    { name: 'filler', start: 7, end: 8, class: 'S', designation: 'M' }, // reserved: filer/entry number expansion
    { name: 'entryNumber', start: 9, end: 16, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 17, end: 17, class: 'S', designation: 'M' },
    { name: 'districtPortOfEntry', start: 18, end: 21, class: 'AN', designation: 'M' },
    { name: 'brokerReferenceNumber', start: 22, end: 30, class: 'X', designation: 'C' },
    { name: 'filler3', start: 31, end: 33, class: 'S', designation: 'M' }, // reserved: broker ref expansion
    { name: 'entryTypeCode', start: 34, end: 35, class: 'AN', designation: 'M' },
    { name: 'motCode', start: 36, end: 37, class: 'AN', designation: 'C' },
    { name: 'bondWaiverIndicator', start: 38, end: 38, class: 'AN', designation: 'C' }, // '0' = waived
    { name: 'electronicSignature', start: 39, end: 39, class: 'AN', designation: 'C' }, // 'X'; mandatory on A/R
    { name: 'cargoReleaseCertificationRequestIndicator', start: 40, end: 40, class: 'AN', designation: 'C' }, // 'A'
    { name: 'electronicInvoiceIndicator', start: 41, end: 41, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'consolidatedSummaryIndicator', start: 42, end: 42, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'shipmentUsageTypeCode', start: 43, end: 43, class: 'AN', designation: 'C' }, // P | X
    { name: 'liveEntryIndicator', start: 44, end: 44, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'deferredTaxPaymentCode', start: 45, end: 45, class: 'AN', designation: 'C' }, // 1 | 2
    { name: 'tradeAgreementReconciliationIndicator', start: 46, end: 46, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'reconciliationIssueCode', start: 47, end: 49, class: 'AN', designation: 'C' }, // 001-007
    { name: 'filler4', start: 50, end: 50, class: 'S', designation: 'M' },
    { name: 'paymentTypeCode', start: 51, end: 51, class: 'AN', designation: 'C' }, // 1,2,3,5,6,7,8
    { name: 'preliminaryStatementPrintDate', start: 52, end: 57, class: 'D', designation: 'C' }, // 6D or 6S
    { name: 'periodicStatementMonth', start: 58, end: 59, class: 'AN', designation: 'C' }, // MM
    { name: 'statementClientBranchIdentifier', start: 60, end: 61, class: 'AN', designation: 'C' },
    { name: 'bondWaiverReasonCode', start: 62, end: 64, class: 'AN', designation: 'C' },
    { name: 'postSummaryCorrectionIndicator', start: 65, end: 65, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'acceleratedLiquidationRequestIndicator', start: 66, end: 66, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'knownImporterIndicator', start: 67, end: 67, class: 'AN', designation: 'O' }, // 'Y'
    { name: 'pgaDataIncludedIndicator', start: 68, end: 68, class: 'AN', designation: 'C' }, // Y | F
    { name: 'tibDeclarationIndicator', start: 69, end: 69, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'consolidatedExpressInformalIndicator', start: 70, end: 70, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'filler5', start: 71, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Header Content — input 11-Record (ESF-36 to ESF-37). */
export const INPUT_11: RecordDef = {
  id: '11',
  name: 'EntrySummaryHeaderContent',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '11' },
    { name: 'importerOfRecordNumber', start: 3, end: 14, class: 'X', designation: 'M' },
    { name: 'consigneeNumber', start: 15, end: 26, class: 'X', designation: 'C' },
    { name: 'designatedNotifyPartyNumber', start: 27, end: 38, class: 'X', designation: 'C' }, // 4811 party
    { name: 'filler', start: 39, end: 41, class: 'S', designation: 'M' },
    { name: 'estimatedEntryDate', start: 42, end: 47, class: 'D', designation: 'C' }, // 6D or 6S
    { name: 'dateOfImportation', start: 48, end: 53, class: 'D', designation: 'C' }, // 6D or 6S
    { name: 'filler2', start: 54, end: 60, class: 'S', designation: 'M' }, // former 7-char FTZ id position
    { name: 'usStateOfDestinationCode', start: 61, end: 62, class: 'AN', designation: 'C' },
    { name: 'foreignTradeZoneIdentifier', start: 63, end: 71, class: 'AN', designation: 'C' }, // 9AN, see Note 3
    { name: 'filler3', start: 72, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Cargo Reference Information — input 20-Record (ESF-39 to ESF-40). */
export const INPUT_20: RecordDef = {
  id: '20',
  name: 'CargoReferenceInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '20' },
    { name: 'carrierCode', start: 3, end: 6, class: 'AN', designation: 'C' }, // SCAC or IATA
    { name: 'districtPortOfUnlading', start: 7, end: 10, class: 'AN', designation: 'C' },
    { name: 'estimatedDateOfArrival', start: 11, end: 16, class: 'D', designation: 'C' }, // 6D or 6S
    { name: 'locationOfGoodsCode', start: 17, end: 20, class: 'AN', designation: 'C' }, // FIRMS code
    { name: 'conveyanceName', start: 21, end: 40, class: 'X', designation: 'C' },
    { name: 'vesselCode', start: 41, end: 47, class: 'AN', designation: 'C' }, // Lloyd's code
    { name: 'designatedExamPortCode', start: 48, end: 51, class: 'AN', designation: 'C' },
    { name: 'inBondInTransitDate', start: 52, end: 57, class: 'D', designation: 'C' }, // 6D or 6S
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Correction Request Contact Detail — input SE13-Record (ESF-41). */
export const INPUT_SE13: RecordDef = {
  id: 'SE13',
  name: 'CorrectionRequestContactDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE13' },
    { name: 'contactName', start: 5, end: 44, class: 'AN', designation: 'M' },
    { name: 'contactPhone', start: 45, end: 59, class: 'AN', designation: 'M' },
    { name: 'disIndicator', start: 60, end: 60, class: 'N', designation: 'O' }, // '1' = DIS submission made
    { name: 'filler', start: 61, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Identifying Trip Information — input 21-Record (ESF-42). */
export const INPUT_21: RecordDef = {
  id: '21',
  name: 'IdentifyingTripInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '21' },
    { name: 'tripIdentifier', start: 3, end: 7, class: 'X', designation: 'M' },
    { name: 'filler', start: 8, end: 80, class: 'S', designation: 'M' }, // reserved: trip id expansion
  ],
};

/** Cargo Manifest Detail — input 22-Record (ESF-43). */
export const INPUT_22: RecordDef = {
  id: '22',
  name: 'CargoManifestDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '22' },
    { name: 'manifestedQuantity', start: 3, end: 10, class: 'SN', designation: 'M' }, // 8(S)N
    { name: 'manifestedQuantityUnitOfMeasureCode', start: 11, end: 15, class: 'X', designation: 'M' }, // left justify
    { name: 'filler', start: 16, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Bill of Lading/In-Bond Detail — input 23-Record (ESF-44). */
export const INPUT_23: RecordDef = {
  id: '23',
  name: 'BillOfLadingInBondDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '23' },
    { name: 'manifestComponentTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // I | M | H | S
    { name: 'manifestComponentIssuerCode', start: 4, end: 7, class: 'AN', designation: 'C' },
    { name: 'manifestComponentIdentifier', start: 8, end: 19, class: 'AN', designation: 'M' },
    { name: 'filler', start: 20, end: 57, class: 'S', designation: 'M' }, // reserved: identifier expansion
    { name: 'filler2', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Conveyance Detail — input SE16-Record (ESF-46). */
export const INPUT_SE16: RecordDef = {
  id: 'SE16',
  name: 'ConveyanceDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE16' },
    { name: 'carrierCode', start: 5, end: 8, class: 'AN', designation: 'M' },
    { name: 'voyageFlightTripManifestNumber', start: 9, end: 13, class: 'X', designation: 'M' },
    { name: 'dateOfArrival', start: 14, end: 19, class: 'N', designation: 'M' }, // 6N, MMDDYY
    { name: 'quantity', start: 20, end: 27, class: 'N', designation: 'M' }, // 8N
    { name: 'unitOfMeasure', start: 28, end: 32, class: 'X', designation: 'O' },
    { name: 'conveyanceName', start: 33, end: 52, class: 'X', designation: 'C' },
    { name: 'filler', start: 53, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Equipment Detail — input SE17-Record (ESF-47). */
export const INPUT_SE17: RecordDef = {
  id: 'SE17',
  name: 'EquipmentDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE17' },
    { name: 'equipmentNumber', start: 5, end: 24, class: 'AN', designation: 'M' },
    { name: 'filler', start: 25, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Warehouse Withdrawal Information — input 30-Record (ESF-48). */
export const INPUT_30: RecordDef = {
  id: '30',
  name: 'WarehouseWithdrawalInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '30' },
    { name: 'associatedWarehouseEntryFilerCode', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'filler', start: 6, end: 7, class: 'S', designation: 'M' },
    { name: 'associatedWarehouseEntryNumber', start: 8, end: 15, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 16, end: 16, class: 'S', designation: 'M' },
    { name: 'associatedWarehouseEntryDistrictPortCode', start: 17, end: 20, class: 'AN', designation: 'M' },
    { name: 'finalWarehouseWithdrawalIndicator', start: 21, end: 21, class: 'AN', designation: 'C' }, // 'Y'
    { name: 'filler3', start: 22, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Bond Detail — input 31-Record (ESF-49 to ESF-50). */
export const INPUT_31: RecordDef = {
  id: '31',
  name: 'BondDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '31' },
    { name: 'bondTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // 8 = continuous, 9 = STB
    { name: 'bondDesignationTypeCode', start: 4, end: 4, class: 'AN', designation: 'M' }, // B | A | U | E
    { name: 'continuousBondIndicator', start: 5, end: 5, class: 'AN', designation: 'C' }, // Y | S
    { name: 'suretyCompanyCode', start: 6, end: 8, class: 'AN', designation: 'M' },
    { name: 'singleTransactionBondAmount', start: 9, end: 18, class: 'SN', designation: 'C' }, // 10(S)N or 10S
    { name: 'singleTransactionBondProducerAccountNumber', start: 19, end: 28, class: 'AN', designation: 'O' },
    { name: 'filler', start: 29, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Release Detail — input 32-Record (ESF-51). Six filer/number pairs. */
export const INPUT_32: RecordDef = {
  id: '32',
  name: 'ReleaseDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '32' },
    { name: 'releaseEntryFilerCode1', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'filler', start: 6, end: 7, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber1', start: 8, end: 15, class: 'AN', designation: 'M' },
    { name: 'releaseEntryFilerCode2', start: 16, end: 18, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 19, end: 20, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber2', start: 21, end: 28, class: 'AN', designation: 'C' }, // 8AN or 8S
    { name: 'releaseEntryFilerCode3', start: 29, end: 31, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 32, end: 33, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber3', start: 34, end: 41, class: 'AN', designation: 'C' },
    { name: 'releaseEntryFilerCode4', start: 42, end: 44, class: 'AN', designation: 'C' },
    { name: 'filler4', start: 45, end: 46, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber4', start: 47, end: 54, class: 'AN', designation: 'C' },
    { name: 'releaseEntryFilerCode5', start: 55, end: 57, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 58, end: 59, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber5', start: 60, end: 67, class: 'AN', designation: 'C' },
    { name: 'releaseEntryFilerCode6', start: 68, end: 70, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 71, end: 72, class: 'S', designation: 'M' },
    { name: 'releaseEntryNumber6', start: 73, end: 80, class: 'AN', designation: 'C' },
  ],
};

/** Missing Document Information — input 33-Record (ESF-52). */
export const INPUT_33: RecordDef = {
  id: '33',
  name: 'MissingDocumentInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '33' },
    { name: 'missingDocumentCode1', start: 3, end: 4, class: 'AN', designation: 'M' },
    { name: 'missingDocumentCode2', start: 5, end: 6, class: 'AN', designation: 'C' },
    { name: 'filler', start: 7, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Header Fees — input 34-Record (ESF-53). */
export const INPUT_34: RecordDef = {
  id: '34',
  name: 'EntrySummaryHeaderFees',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '34' },
    { name: 'accountingClassCode1', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'headerFeeAmount1', start: 6, end: 13, class: 'SN', designation: 'M' }, // 8(S)N, 2 implied decimals
    { name: 'accountingClassCode2', start: 14, end: 16, class: 'AN', designation: 'C' },
    { name: 'headerFeeAmount2', start: 17, end: 24, class: 'SN', designation: 'C' }, // 8(S)N or 8S
    { name: 'filler', start: 25, end: 80, class: 'S', designation: 'M' },
  ],
};

/** PSC Header Reasons — input 35-Record (ESF-54). */
export const INPUT_35: RecordDef = {
  id: '35',
  name: 'PscHeaderReasons',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '35' },
    { name: 'pscHeaderReasonCode1', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'pscHeaderReasonCode2', start: 6, end: 8, class: 'AN', designation: 'C' },
    { name: 'pscHeaderReasonCode3', start: 9, end: 11, class: 'AN', designation: 'C' },
    { name: 'pscHeaderReasonCode4', start: 12, end: 14, class: 'AN', designation: 'C' },
    { name: 'pscHeaderReasonCode5', start: 15, end: 17, class: 'AN', designation: 'C' },
    { name: 'filler', start: 18, end: 80, class: 'S', designation: 'M' },
  ],
};

/** PSC Filing Explanation — input 36-Record (ESF-55). */
export const INPUT_36: RecordDef = {
  id: '36',
  name: 'PscFilingExplanation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '36' },
    { name: 'pscFilingExplanationText', start: 3, end: 77, class: 'X', designation: 'M' }, // left justify
    { name: 'filler', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Cargo Release Reference Data — input SE20-Record (ESF-56). */
export const INPUT_SE20: RecordDef = {
  id: 'SE20',
  name: 'CargoReleaseReferenceData',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE20' },
    { name: 'referenceIdentifierQualifier', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'referenceIdentifier', start: 8, end: 57, class: 'X', designation: 'M' },
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Name — input SE30-Record (ESF-59). */
export const INPUT_SE30: RecordDef = {
  id: 'SE30',
  name: 'EntityName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE30' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // 3A
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' },
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'C' },
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'C' },
    { name: 'filler', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity GBI Identifier — input SE31-Record (ESF-61). */
export const INPUT_SE31: RecordDef = {
  id: 'SE31',
  name: 'EntityGbiIdentifier',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE31' },
    { name: 'gbiIdentifierQualifier', start: 5, end: 8, class: 'A', designation: 'M' }, // LEI | GLN | DUNS | ALTA
    { name: 'identifier', start: 9, end: 43, class: 'AN', designation: 'M' }, // 35AN (rev. 109 expansion)
    { name: 'filler', start: 44, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity GBI Party Type Description — input SE32-Record (ESF-62). */
export const INPUT_SE32: RecordDef = {
  id: 'SE32',
  name: 'EntityGbiPartyTypeDescription',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE32' },
    { name: 'sequenceNumber', start: 5, end: 5, class: 'N', designation: 'M' },
    { name: 'description', start: 6, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Entity Address — input SE35-Record (ESF-63). Two qualifier/info pairs. */
export const INPUT_SE35: RecordDef = {
  id: 'SE35',
  name: 'EntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE35' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' },
    { name: 'addressInformation1', start: 7, end: 41, class: 'X', designation: 'M' },
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    { name: 'addressInformation2', start: 44, end: 78, class: 'X', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Geographic Area — input SE36-Record (ESF-64). */
export const INPUT_SE36: RecordDef = {
  id: 'SE36',
  name: 'EntityGeographicArea',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE36' },
    { name: 'cityName', start: 5, end: 39, class: 'X', designation: 'M' },
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'C' }, // ISO subdivision
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' },
    { name: 'postalCode', start: 49, end: 63, class: 'X', designation: 'C' },
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' }, // ISO country
    // The spec's SE36 table ends at position 65; trailing filler added so the
    // record tiles the full 80-character CATAIR record length.
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [
  INPUT_10,
  INPUT_11,
  INPUT_20,
  INPUT_SE13,
  INPUT_21,
  INPUT_22,
  INPUT_23,
  INPUT_SE16,
  INPUT_SE17,
  INPUT_30,
  INPUT_31,
  INPUT_32,
  INPUT_33,
  INPUT_34,
  INPUT_35,
  INPUT_36,
  INPUT_SE20,
  INPUT_SE30,
  INPUT_SE31,
  INPUT_SE32,
  INPUT_SE35,
  INPUT_SE36,
]) {
  assertRecordDef(def);
}
