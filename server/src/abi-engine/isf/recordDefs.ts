/**
 * Importer Security Filing (SF/SN) record definitions — transcribed from the
 * CATAIR "Importer Security Filing" chapter, July 2017 Version 3
 * (docs/abi-engine/specs — ISF-n page numbers in comments), plus the
 * "Importer Security Filing Status Notification" supplement, August 2016
 * Version 1 (SA-n page numbers).
 *
 * Input records: SF10, SF13, SF15, SF20, SF25, SF30, SF31, SF35, SF36,
 * SF40, SF50. Output: SF90 (SN response) and SA10/SA20/SA30/SA50 (SA
 * status-advisory notification, output only). Positions are transcribed
 * digit-for-digit from the chapter's Position column; every spec "Filler"
 * row (including fillers printed with class X) is an explicit class-'S'
 * mandatory field so each record tiles positions 1-80.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── Input records ──────────────────────────────────────────

/** Importer Security Filing Header — input SF10 (ISF-14 to ISF-15). */
export const SF10: RecordDef = {
  id: 'SF10',
  name: 'IsfHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF10' },
    { name: 'isfSubmissionType', start: 5, end: 5, class: 'N', designation: 'M' }, // 1-4 (Note 1, ISF-15)
    { name: 'shipmentTypeCode', start: 6, end: 7, class: 'N', designation: 'M' }, // 01-11 (Note 2, ISF-16)
    { name: 'actionCode', start: 8, end: 8, class: 'A', designation: 'M' }, // A | D | R
    { name: 'actionReasonCode', start: 9, end: 10, class: 'X', designation: 'C' }, // CT | FR | FT | FX (Note 3, ISF-17)
    { name: 'isfImporterNumberQualifier', start: 11, end: 13, class: 'X', designation: 'M' }, // left justified (Note 4, ISF-18)
    { name: 'isfImporterNumber', start: 14, end: 28, class: 'X', designation: 'M' },
    { name: 'dateOfBirth', start: 29, end: 36, class: 'N', designation: 'C' }, // MMDDYYYY
    { name: 'modeOfTransportationCode', start: 37, end: 38, class: 'N', designation: 'O' }, // 10 break bulk | 11 containerized
    { name: 'isfTransactionNumber', start: 39, end: 53, class: 'X', designation: 'C' }, // FFF-NNNNNNNNNNN (Note 5, ISF-19)
    { name: 'scacIdentifier', start: 54, end: 57, class: 'A', designation: 'O' }, // vessel operator SCAC (Note 6)
    { name: 'bondHolder', start: 58, end: 72, class: 'X', designation: 'C' }, // (Note 7, ISF-19)
    { name: 'bondActivityCode', start: 73, end: 74, class: 'AN', designation: 'C' }, // ISF-20
    { name: 'bondType', start: 75, end: 75, class: 'N', designation: 'C' }, // 8 | 9 (ISF-20)
    { name: 'filler', start: 76, end: 78, class: 'S', designation: 'M' }, // printed 3X "Space fill"
    { name: 'countryOfIssuance', start: 79, end: 80, class: 'A', designation: 'C' }, // required when qualifier AEF
  ],
};

/** Shipment Information — input SF13 (ISF-21 to ISF-22). Required for Shipment Type 11. */
export const SF13: RecordDef = {
  id: 'SF13',
  name: 'IsfShipmentInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF13' },
    { name: 'shipmentSubType', start: 5, end: 6, class: 'AN', designation: 'M' }, // 01 | 02 | 03 (Note 1, ISF-21)
    // 11N fields; the chapter's formatting rules say N = right justify and
    // zero-fill (ISF-5), so the builder zero-pads these to full width.
    { name: 'estimatedValue', start: 7, end: 17, class: 'N', designation: 'M' }, // whole USD, > 0
    { name: 'estimatedQuantity', start: 18, end: 28, class: 'N', designation: 'M' }, // smallest external packaging unit, > 0
    { name: 'unitOfMeasure', start: 29, end: 31, class: 'AN', designation: 'M' }, // Appendix B; PCS acceptable
    { name: 'estimatedWeight', start: 32, end: 42, class: 'N', designation: 'M' }, // whole kilos or pounds, > 0
    { name: 'weightQualifier', start: 43, end: 43, class: 'A', designation: 'M' }, // K = kilos, L = pounds
    { name: 'filler', start: 44, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Shipment Reference (bill of lading) Identifier — input SF15 (ISF-23 to ISF-24). */
export const SF15: RecordDef = {
  id: 'SF15',
  name: 'IsfShipmentReferenceIdentifier',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF15' },
    { name: 'codeQualifier', start: 5, end: 6, class: 'A', designation: 'M' }, // OB regular | BM house (Note 1, ISF-23)
    // SCAC of the bill issuer concatenated with the bill number; no spaces,
    // hyphens, slashes or other special characters (ISF-23).
    { name: 'shipmentReferenceIdentifier', start: 7, end: 56, class: 'AN', designation: 'M' },
    { name: 'filler', start: 57, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Reference Identifier — input SF20 (ISF-25 to ISF-26). */
export const SF20: RecordDef = {
  id: 'SF20',
  name: 'IsfReferenceIdentifier',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF20' },
    { name: 'referenceIdentifierQualifier', start: 5, end: 7, class: 'AN', designation: 'M' }, // Note 1, ISF-25
    { name: 'referenceIdentifier', start: 8, end: 57, class: 'X', designation: 'M' }, // 50X — FN uses "Last, First, M Initial"
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Container/Equipment — input SF25 (ISF-27). */
export const SF25: RecordDef = {
  id: 'SF25',
  name: 'IsfContainerEquipment',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF25' },
    { name: 'equipmentDescriptionCode', start: 5, end: 6, class: 'X', designation: 'M' }, // Appendix B
    { name: 'equipmentInitial', start: 7, end: 10, class: 'A', designation: 'M' }, // alpha prefix
    { name: 'equipmentNumber', start: 11, end: 25, class: 'N', designation: 'M' }, // 15N; builder zero-pads (N rule, ISF-5)
    { name: 'equipmentNumberCheckDigit', start: 26, end: 26, class: 'N', designation: 'C' },
    { name: 'equipmentSizeTypeCode', start: 27, end: 30, class: 'AN', designation: 'O' }, // Appendix B
    { name: 'filler', start: 31, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Name and Type — input SF30 (ISF-28 to ISF-31). */
export const SF30: RecordDef = {
  id: 'SF30',
  name: 'IsfEntityNameAndType',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF30' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // Note 1, ISF-29
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' }, // blank when an identifier is used
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'C' }, // Note 2, ISF-29..31
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'C' }, // mandatory for CN/IM
    { name: 'countryCode', start: 66, end: 67, class: 'AN', designation: 'C' }, // passport country of issuance
    // Printed "MMDDYYY" in the description is a chapter typo; Note 3
    // (ISF-31) gives the valid format as MMDDYYYY, matching the 8-char width.
    { name: 'dateOfBirth', start: 68, end: 75, class: 'X', designation: 'C' },
    { name: 'filler', start: 76, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Secondary Name — input SF31 (ISF-32). */
export const SF31: RecordDef = {
  id: 'SF31',
  name: 'IsfEntitySecondaryName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF31' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // secondary-name type (Note 1, ISF-32)
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'M' },
    { name: 'filler', start: 43, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Address — input SF35 (ISF-33 to ISF-34). Two qualifier+information pairs. */
export const SF35: RecordDef = {
  id: 'SF35',
  name: 'IsfEntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF35' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' }, // Note 1, ISF-33..34
    { name: 'addressInformation1', start: 7, end: 41, class: 'X', designation: 'M' }, // 35X (revision 1, ISF-13)
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    // The second pair's information column is still printed 35AN (revision 1
    // changed only positions 7-41 to X) — transcribed verbatim.
    { name: 'addressInformation2', start: 44, end: 78, class: 'AN', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entity Geographic Area — input SF36 (ISF-35). */
export const SF36: RecordDef = {
  id: 'SF36',
  name: 'IsfEntityGeographicArea',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF36' },
    { name: 'cityName', start: 5, end: 39, class: 'AN', designation: 'M' },
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'C' }, // ISO subdivision
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' },
    { name: 'postalCode', start: 49, end: 63, class: 'AN', designation: 'C' },
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' }, // ISO country
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Harmonized Tariff Schedule — input SF40 (ISF-36). */
export const SF40: RecordDef = {
  id: 'SF40',
  name: 'IsfHarmonizedTariffSchedule',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF40' },
    // 10N but explicitly LEFT justified per the spec ("Left justify the
    // number", ISF-36); only the first 6 digits are mandatory.
    { name: 'harmonizedNumber', start: 5, end: 14, class: 'N', designation: 'M', justify: 'left' },
    { name: 'countryOfOrigin', start: 15, end: 16, class: 'AN', designation: 'C' }, // not required for ISF-5 (FROB/IE/TE)
    { name: 'filler', start: 17, end: 80, class: 'S', designation: 'M' },
  ],
};

/** FROB Shipment Information — input SF50 (ISF-37 to ISF-38). ISF-5 only. */
export const SF50: RecordDef = {
  id: 'SF50',
  name: 'IsfFrobShipmentInformation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF50' },
    { name: 'portOfUnladingQualifier', start: 5, end: 7, class: 'X', designation: 'M' }, // K | UN (Note 1, ISF-37..38)
    { name: 'foreignPortOfUnlading', start: 8, end: 22, class: 'AN', designation: 'M' },
    { name: 'placeOfDeliveryQualifier', start: 23, end: 25, class: 'X', designation: 'M' }, // K | UN
    { name: 'placeOfDelivery', start: 26, end: 40, class: 'AN', designation: 'M' },
    { name: 'filler', start: 41, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Output records (SN response) ───────────────────────────

/** Error or Accept/Reject Message — output SF90 (ISF-39). */
export const SF90: RecordDef = {
  id: 'SF90',
  name: 'IsfErrorOrAcceptReject',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF90' },
    { name: 'messageTypeCode', start: 5, end: 6, class: 'AN', designation: 'M' }, // 01/02/03 message-level; 11/13 record-level
    { name: 'errorCode', start: 7, end: 9, class: 'AN', designation: 'C' }, // record-level errors only
    { name: 'narrativeMessageText', start: 10, end: 49, class: 'X', designation: 'M' },
    { name: 'filler', start: 50, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Status Advisory records (SA notification, output only) ─

/** ISF processing-results transaction number — output SA10 (SA-5). */
export const SA10: RecordDef = {
  id: 'SA10',
  name: 'IsfStatusAdvisoryHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'SA' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '10' },
    { name: 'isfTransactionNumber', start: 5, end: 19, class: 'X', designation: 'C' }, // FFF-NNNNNNNNNNN (Note 1, SA-5)
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Status-advisory reference — output SA20 (SA-6). */
export const SA20: RecordDef = {
  id: 'SA20',
  name: 'IsfStatusAdvisoryReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SA20' },
    { name: 'codeQualifier', start: 5, end: 7, class: 'AN', designation: 'M' }, // CR only (Note 1, SA-6)
    { name: 'referenceData', start: 8, end: 57, class: 'AN', designation: 'M' },
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Status-advisory bill number, SA30-SA50 loop header — output SA30 (SA-7). */
export const SA30: RecordDef = {
  id: 'SA30',
  name: 'IsfStatusAdvisoryBill',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'SA' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '30' },
    // Layout (SA-7): 16AN = 4-char SCAC + 12-char sequence. The printed
    // examples (SA-9) instead show a 2-char bill-type token (HB/OB) BEFORE
    // the SCAC, e.g. 'SA30HBSC999999999999'. The parser detects the
    // optional leading token; see responseParser.ts.
    { name: 'billNumber', start: 5, end: 20, class: 'AN', designation: 'C' },
    { name: 'filler', start: 21, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Status-advisory disposition, SA30-SA50 loop trailer — output SA50 (SA-8). */
export const SA50: RecordDef = {
  id: 'SA50',
  name: 'IsfStatusAdvisoryDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'SA' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '50' },
    { name: 'dispositionCode', start: 5, end: 6, class: 'AN', designation: 'M' }, // Appendix N (Note 1, SA-8)
    // Printed 40A, but the SA-9 examples contain spaces and parentheses
    // ('NO BILL MATCH (NOT ON FILE)'), so class X in practice.
    { name: 'remarks', start: 7, end: 46, class: 'X', designation: 'M' },
    { name: 'filler', start: 47, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [SF10, SF13, SF15, SF20, SF25, SF30, SF31, SF35, SF36, SF40, SF50, SF90, SA10, SA20, SA30, SA50]) {
  assertRecordDef(def);
}

// ── Code tables ────────────────────────────────────────────

/** ISF Submission Type codes — SF10 Note 1 (ISF-15). */
export const SUBMISSION_TYPES: Record<string, string> = {
  '1': 'Importer Security Filing 10 (ISF-10) submission',
  '2': 'Importer Security Filing 5 (ISF-5) submission',
  '3': 'ISF-5 submission type is being changed to an ISF-10',
  '4': 'ISF-10 submission type is being changed to an ISF-5',
};

/** Shipment Type codes — SF10 Note 2 (ISF-16). 01 must be used for ISF-5. */
export const SHIPMENT_TYPES: Record<string, string> = {
  '01': 'Standard or regular filings',
  '02': 'To Order Shipments',
  '03': 'Household Goods / Personal Effects (HHG / PE)',
  '04': 'Military, Government',
  '05': 'Diplomatic Shipment',
  '06': 'Carnet',
  '07': 'US Goods Returned',
  '08': 'FTZ Shipments',
  '09': 'International Mail Shipments',
  '10': 'Outer Continental Shelf Shipments',
  '11': 'Informal',
};

/** Action Reason codes — SF10 Note 3 (ISF-17). Mandatory when action is A or R. */
export const ACTION_REASON_CODES: Record<string, string> = {
  CT: 'Complete Transaction',
  FR: 'Flexible Range',
  FT: 'Flexible Timing',
  FX: 'Flexible Range and Flexible Timing',
};

/** ISF Importer Number qualifiers — SF10 Note 4 (ISF-18). */
export const IMPORTER_NUMBER_QUALIFIERS: Record<string, string> = {
  EI: 'Employer Identification Number (IRS #)',
  ANI: 'CBP-assigned Number',
  '34': 'Social Security Number',
  AEF: 'Passport Number', // only when Shipment Type is 03, 05 or 06
  '2': 'Standard Carrier Alpha Code (SCAC)', // ISF-5 submission types only
};

/** Bond Activity codes — SF10 Note 7 (ISF-20). */
export const BOND_ACTIVITY_CODES: Record<string, string> = {
  '01': 'Importer or Broker',
  '02': 'Custodian of Bonded Merchandise',
  '03': 'International Carrier',
  '04': 'Foreign Trade Zone Operator',
  '16': 'ISF Bond',
};

/** Bond Types — SF10 Note 7 (ISF-20). */
export const BOND_TYPES: Record<string, string> = {
  '8': 'Continuous',
  '9': 'Single Transaction', // only with Bond Activity Code 16 + SF20 V1 and SBN
};

/** Entity codes — SF30 Note 1 (ISF-29). */
export const ENTITY_CODES: Record<string, string> = {
  MF: 'Manufacturer/Supplier',
  SE: 'Selling Party',
  BY: 'Buying Party',
  ST: 'Ship To Party',
  LG: 'Scheduled Container Stuffing Location',
  CS: 'Consolidator',
  BKP: 'Booking Party',
  CN: 'Consignee',
  IM: 'Importer of Record',
};

/** SF31 secondary-name type codes — SF31 Note 1 (ISF-32). */
export const ENTITY_SECONDARY_NAME_CODES: Record<string, string> = {
  ALA: 'Alternative Addressee',
  DH: 'Doing Business As',
  DV: 'Division',
  NU: 'Formerly Known As',
  NV: 'Formerly Doing Business As',
  XD: 'Alias (Other Names Used)',
};

/**
 * Entity Identifier qualifiers with their per-entity restrictions — SF30
 * Note 2 (ISF-29 to ISF-31). AEF additionally requires Shipment Type 03,
 * 05 or 06 in the SF10 record.
 */
export const ENTITY_IDENTIFIER_QUALIFIERS: Record<
  string,
  { description: string; format: string; allowedEntities: readonly string[] }
> = {
  EI: {
    description: 'Employer Identification Number (IRS #)',
    format: 'NN-NNNNNNNXX',
    allowedEntities: ['SE', 'BY', 'CN', 'IM'],
  },
  ANI: {
    description: 'CBP-assigned Number',
    format: 'YYDDPP-NNNNN',
    allowedEntities: ['SE', 'BY', 'CN', 'IM'],
  },
  CIN: {
    description: 'CBP encrypted Consignee ID',
    format: '-CCCCCCCCCCC',
    allowedEntities: ['SE', 'BY', 'CN', 'IM'],
  },
  '34': {
    description: 'Social Security Number',
    format: 'NNN-NN-NNNN',
    allowedEntities: ['SE', 'BY', 'CN', 'IM'],
  },
  DUN: {
    description: 'DUNS Number',
    format: 'NNNNNNNNN',
    allowedEntities: ['MF', 'SE', 'BY', 'ST', 'LG', 'CS', 'BKP'],
  },
  DNS: {
    description: 'DUNS+4 Number',
    format: 'NNNNNNNNNNNNN',
    allowedEntities: ['MF', 'SE', 'BY', 'ST', 'LG', 'CS', 'BKP'],
  },
  FR: {
    description: 'Facility Information Resource Management System (FIRMS) Code',
    format: 'ANNN',
    allowedEntities: ['ST'],
  },
  AEF: {
    description: 'Passport Number',
    format: 'XXXXXXXXXXXXXXX',
    allowedEntities: ['CN', 'IM'], // only when Shipment Type is 03, 05 or 06
  },
};

/** SF35 Address Component qualifiers — SF35 Note 1 (ISF-33 to ISF-34). */
export const ADDRESS_COMPONENT_QUALIFIERS: Record<string, string> = {
  '01': 'Street Number',
  '02': 'Street Name',
  '05': 'P.O. Box Number',
  '12': 'Building Name',
  '13': 'Apartment Number',
  '14': 'Suite Number',
  '15': 'Unstructured Street Address',
  '28': 'Association Name',
  '30': 'Pier',
  '31': 'Wing',
  '32': 'Floor Number',
  '35': 'Room',
  '37': 'Unit',
  '57': 'Cross Street',
  AK: 'Building Number',
};

/** SF20 Reference Identifier qualifiers — SF20 Note 1 (ISF-25 to ISF-26). */
export const REFERENCE_IDENTIFIER_QUALIFIERS: Record<string, string> = {
  '6B': 'US CBP Entry Number', // normalized FFFNNNNNNNN
  '6C': 'Carnet issuing Country Code and Carnet Number', // required when Shipment Type 06
  MB: 'Master Bill of Lading Number', // SCAC + bill number concatenated
  SBN: 'Bond Reference Number', // NOT the bond number; required with bond type 9 / activity 16
  V1: 'Surety Code', // required with bond type 9 / activity 16
  CR: 'User-defined Reference Number', // echoed in SN and SA
  FN: 'Full Name of ISF Filer', // "Last, First, M Initial"
};

/** SF90 message types (ISF-39). 01/02/03 are message-level, 11/13 record-level. */
export const SF90_MESSAGE_TYPES: Record<string, string> = {
  '01': 'Message Rejected',
  '02': 'Message Accepted',
  '03': 'Message Accepted with Warning(s)',
  '11': 'Record Rejected',
  '13': 'Record Accepted with Warning',
};

/**
 * Status-advisory disposition codes (Appendix N; categories per SA-3).
 * S2-S5: bill NUMBER not on file in AMS; S6/SA/SB/SC: bill TYPE in the ISF
 * differs from AMS. Messages are generated at filing and 5/20/30 days after
 * the original file date; S2's pairing with "immediately after filing" is
 * explicit in SA50 Note 1 (SA-8) — the remaining interval pairings follow
 * the listed order and are confirmed for S5 by the SA-9 examples.
 */
export const SA_DISPOSITION_CODES: Record<string, string> = {
  S1: 'Bill on file — AMS bill of lading matched to the ISF',
  S2: 'No bill match (not on file) — at time of ISF filing',
  S3: 'No bill match (not on file) — 5 days after original file date',
  S4: 'No bill match (not on file) — 20 days after original file date',
  S5: 'No bill match (not on file) — 30 days after original file date',
  S6: 'Bill type mismatch with AMS — at time of ISF filing',
  SA: 'Bill type mismatch with AMS — 5 days after original file date',
  SB: 'Bill type mismatch with AMS — 20 days after original file date',
  SC: 'Bill type mismatch with AMS — 30 days after original file date',
  S7: 'Duplicate ISF filed by another filer for the same bill and ISF importer',
};
