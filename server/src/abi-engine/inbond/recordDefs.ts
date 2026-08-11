/**
 * In-Bond (QP/QT, WP/WT, NS) record definitions — transcribed from the
 * CATAIR "In-Bond" chapter, Amendment 51, April 2026 (INB-n page numbers
 * in comments).
 *
 * Unlike ISF (whose records carry a 4-char control identifier), the
 * in-bond transaction records are identified by a bare 2-digit Record
 * Type in positions 1-2 ('10', '30', '95', …); which application a '10'
 * line belongs to (QP10 vs WP10 vs NS10) is determined by the application
 * identifier on the enclosing B record (INB-8/9). The exported const
 * names keep the chapter's QP/WP/QT/WT/NS prefixes for readability.
 *
 * Input records: QP10-QP76 (in-bond create/delete) and WP10/WP20
 * (arrival/export/transfer/diversion events). Output: QT95/WT95
 * accept-reject, NS05-NS60 status notifications, and the EA/EB/EY/EZ
 * control-record/EDI-profile reject records. Positions are transcribed
 * digit-for-digit from the chapter's Position column; every spec "Filler"
 * row (including fillers printed with class A/AN) is an explicit
 * class-'S' mandatory field so each record tiles positions 1-80.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── QP input records (in-bond create / delete) ─────────────

/** In-bond Header — input QP10 (INB-19 to INB-20). */
export const QP10: RecordDef = {
  id: '10',
  name: 'InbondHeader',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '10' },
    { name: 'actionCode', start: 3, end: 3, class: 'A', designation: 'M' }, // A add | B delete in-bond from bill | D delete in-bond from all bills
    { name: 'inBondEntryType', start: 4, end: 5, class: 'N', designation: 'C' }, // 61 IT | 62 T&E | 63 IE (Note 4)
    // Conventional 9-position number, left justified, no specials (INB-19).
    { name: 'inBondNumber', start: 6, end: 17, class: 'AN', designation: 'M' },
    { name: 'inBondCarrierCode', start: 18, end: 21, class: 'AN', designation: 'C' }, // SCAC/ICAO/IATA, or FIRMS for FTZ withdrawals (Note 4)
    { name: 'usPortOfDestination', start: 22, end: 25, class: 'N', designation: 'C' }, // Schedule D (Note 4)
    { name: 'portOfForeignDestination', start: 26, end: 30, class: 'AN', designation: 'C' }, // Schedule K; space/zero for IT 61 (Notes 1, 4)
    // Printed M, but Note 4 (INB-22) exempts action codes B and D; the
    // builder enforces presence (and > 0) for action A.
    { name: 'value', start: 31, end: 38, class: 'N', designation: 'C' }, // whole USD (Note 4)
    { name: 'bondedCarrierId', start: 39, end: 50, class: 'X', designation: 'C' }, // IRS/CBP-assigned/SSN (Notes 2, 4)
    { name: 'ftzWarehouseIndicator', start: 51, end: 51, class: 'A', designation: 'C' }, // Y for FTZ/warehouse withdrawal, else blank (Note 4)
    { name: 'btaFdaIndicator', start: 52, end: 52, class: 'A', designation: 'C' }, // Y | N (Notes 3, 4)
    { name: 'filler', start: 53, end: 80, class: 'S', designation: 'M' }, // printed 28AN "Space fill"
  ],
};

/** Conveyance Information — input QP20 (INB-23 to INB-25). */
export const QP20: RecordDef = {
  id: '20',
  name: 'InbondConveyanceInformation',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '20' },
    { name: 'importingCarrierCode', start: 3, end: 6, class: 'AN', designation: 'M' }, // SCAC/ICAO/IATA or FIRMS (Note 1)
    { name: 'importMotCode', start: 7, end: 8, class: 'N', designation: 'M' }, // printed codes 30 truck, 70 pipeline, 40 air (Note 1); use 30 for FTZ withdrawals
    { name: 'countryCode', start: 9, end: 10, class: 'A', designation: 'C' }, // ISO flag country; not required for Air/FTZ
    { name: 'conveyanceName', start: 11, end: 33, class: 'X', designation: 'C' }, // not required for Air/FTZ
    { name: 'voyageFlightTripNumber', start: 34, end: 38, class: 'X', designation: 'C' }, // NNN/NNNA/NNNN/NNNNA (Note 1)
    { name: 'filler', start: 39, end: 45, class: 'S', designation: 'M' }, // printed 7AN "Space fill"
    { name: 'portOfArrival', start: 46, end: 49, class: 'N', designation: 'M' }, // Schedule D port of unlading (Note 1)
    { name: 'estimatedDateOfArrival', start: 50, end: 55, class: 'N', designation: 'C' }, // MMDDYY (Note 1)
    { name: 'ftzFirmsCode', start: 56, end: 59, class: 'AN', designation: 'C' }, // mandatory when the QP10 FTZ flag is set (Note 2)
    { name: 'filler2', start: 60, end: 80, class: 'S', designation: 'M' }, // printed 21AN "Space fill"
  ],
};

/** Bill of Lading Header — input QP30 (INB-26 to INB-28). */
export const QP30: RecordDef = {
  id: '30',
  name: 'InbondBillOfLadingHeader',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '30' },
    { name: 'actionCode', start: 3, end: 3, class: 'A', designation: 'M' }, // A add bill data | D delete in-bond from bill
    { name: 'filler', start: 4, end: 4, class: 'S', designation: 'M' }, // printed 1A "Space fill"
    { name: 'sequenceNumber', start: 5, end: 8, class: 'AN', designation: 'O' }, // echoed in the QT 30 record
    { name: 'billIssuerCode', start: 9, end: 12, class: 'AN', designation: 'M' }, // SCAC or 3-char AWB prefix; FIRMS for FTZ (Note 1)
    { name: 'billNumber', start: 13, end: 24, class: 'AN', designation: 'M' }, // simple/regular/master bill; 8-digit AWB serial for Air (Note 1)
    { name: 'houseBillIssuerCode', start: 25, end: 28, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'houseBillNumber', start: 29, end: 40, class: 'AN', designation: 'C' }, // Air only (Note 1)
    { name: 'subHouseBillIssuerCode', start: 41, end: 44, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'subHouseBillNumber', start: 45, end: 56, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'previousInBondNumber', start: 57, end: 68, class: 'AN', designation: 'C' }, // blank for FTZ withdrawals (Note 2)
    { name: 'inBondQuantity', start: 69, end: 78, class: 'N', designation: 'C' }, // partial quantity when attaching to an existing bill; space fill for Air (Note 2)
    { name: 'filler2', start: 79, end: 80, class: 'S', designation: 'M' }, // printed 2AN "Space fill"
  ],
};

/** Secondary Notify Parties — input QP32 (INB-29). */
export const QP32: RecordDef = {
  id: '32',
  name: 'InbondSecondaryNotifyParties',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '32' },
    // SCAC (left justified) or ABI filer NNNNXXXNN; CATAIR filers must
    // nominate themselves to receive NS status notifications (Note 1).
    { name: 'snpCode1', start: 3, end: 11, class: 'AN', designation: 'M' },
    { name: 'snpCode2', start: 12, end: 20, class: 'AN', designation: 'O' },
    { name: 'snpCode3', start: 21, end: 29, class: 'AN', designation: 'O' },
    { name: 'snpCode4', start: 30, end: 38, class: 'AN', designation: 'O' },
    { name: 'filler', start: 39, end: 80, class: 'S', designation: 'M' }, // printed 42AN "Space fill"
  ],
};

/** Reference Identifier — input QP33 (INB-30 to INB-31). */
export const QP33: RecordDef = {
  id: '33',
  name: 'InbondReferenceIdentifier',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '33' },
    { name: 'qualifier', start: 3, end: 5, class: 'AN', designation: 'M' }, // Note 1 table (INB-30..31)
    { name: 'referenceIdentifier', start: 6, end: 35, class: 'AN', designation: 'M' }, // FEN pedimento is 15N left justified (Note 2)
    { name: 'filler', start: 36, end: 80, class: 'S', designation: 'M' }, // printed 45AN "Space fill"
  ],
};

/** Bill of Lading Details — input QP40 (INB-32 to INB-34). QP-Long only. */
export const QP40: RecordDef = {
  id: '40',
  name: 'InbondBillOfLadingDetails',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '40' },
    { name: 'foreignPortOfLading', start: 3, end: 7, class: 'N', designation: 'M' }, // Schedule K; '99999' only when the FTZ flag is set (Note 1)
    { name: 'manifestQuantity', start: 8, end: 17, class: 'N', designation: 'M' }, // > 0; must equal the sum of all QP71 piece counts (INB-48)
    { name: 'manifestUnits', start: 18, end: 22, class: 'X', designation: 'M' }, // ACE Ocean Appendix N
    { name: 'weight', start: 23, end: 32, class: 'N', designation: 'M' }, // gross weight, > 0
    { name: 'weightUnit', start: 33, end: 34, class: 'A', designation: 'M' }, // WEIGHT_UNITS
    { name: 'volume', start: 35, end: 44, class: 'N', designation: 'O' }, // no decimals
    { name: 'volumeUnit', start: 45, end: 46, class: 'A', designation: 'C' }, // VOLUME_UNITS; required when volume provided
    { name: 'placeOfPreReceipt', start: 47, end: 63, class: 'X', designation: 'O' }, // required for paperless manifest participants
    { name: 'filler', start: 64, end: 80, class: 'S', designation: 'M' }, // printed 17AN "Space fill"
  ],
};

/** Foreign Shipper Name/Address — input QP50 (INB-35). QP-Long only. */
export const QP50: RecordDef = {
  id: '50',
  name: 'InbondForeignShipperNameAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '50' },
    { name: 'name', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine1', start: 38, end: 72, class: 'X', designation: 'M' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' }, // printed 8AN "Space fill"
  ],
};

/** Foreign Shipper Address lines 2-3 — input QP51 (INB-36). */
export const QP51: RecordDef = {
  id: '51',
  name: 'InbondForeignShipperAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '51' },
    { name: 'addressLine2', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine3', start: 38, end: 72, class: 'X', designation: 'O' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Foreign Shipper Telephone/Telex — input QP52 (INB-37). */
export const QP52: RecordDef = {
  id: '52',
  name: 'InbondForeignShipperTelephone',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '52' },
    { name: 'telephoneOrTelex', start: 3, end: 37, class: 'X', designation: 'M' }, // 'TELEX ' prefix for telex numbers
    { name: 'filler', start: 38, end: 80, class: 'S', designation: 'M' }, // printed 43AN "Space fill"
  ],
};

/** Consignee Name/Address — input QP55 (INB-38). QP-Long only. */
export const QP55: RecordDef = {
  id: '55',
  name: 'InbondConsigneeNameAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '55' },
    { name: 'name', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine1', start: 38, end: 72, class: 'X', designation: 'M' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Consignee Address lines 2-3 — input QP56 (INB-39). */
export const QP56: RecordDef = {
  id: '56',
  name: 'InbondConsigneeAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '56' },
    { name: 'addressLine2', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine3', start: 38, end: 72, class: 'X', designation: 'O' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Consignee Telephone/Telex — input QP57 (INB-40). */
export const QP57: RecordDef = {
  id: '57',
  name: 'InbondConsigneeTelephone',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '57' },
    { name: 'telephoneOrTelex', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'filler', start: 38, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Notify Party Name/Address — input QP60 (INB-41). QP-Long only. */
export const QP60: RecordDef = {
  id: '60',
  name: 'InbondNotifyPartyNameAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '60' },
    { name: 'name', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine1', start: 38, end: 72, class: 'X', designation: 'M' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Notify Party Address lines 2-3 — input QP61 (INB-42). */
export const QP61: RecordDef = {
  id: '61',
  name: 'InbondNotifyPartyAddress',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '61' },
    { name: 'addressLine2', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'addressLine3', start: 38, end: 72, class: 'X', designation: 'O' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Notify Party Telephone/Telex — input QP62 (INB-43). */
export const QP62: RecordDef = {
  id: '62',
  name: 'InbondNotifyPartyTelephone',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '62' },
    { name: 'telephoneOrTelex', start: 3, end: 37, class: 'X', designation: 'M' },
    { name: 'filler', start: 38, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Bill of Lading Container — input QP65 (INB-44). QP-Long only. */
export const QP65: RecordDef = {
  id: '65',
  name: 'InbondBillOfLadingContainer',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '65' },
    { name: 'containerNumber', start: 3, end: 16, class: 'AN', designation: 'M' }, // 'NC' for non-containerized freight
    { name: 'sealNumber1', start: 17, end: 31, class: 'AN', designation: 'C' },
    { name: 'sealNumber2', start: 32, end: 46, class: 'AN', designation: 'C' },
    { name: 'containerDescriptionCode', start: 47, end: 48, class: 'AN', designation: 'C' }, // ACE Ocean Appendix I
    { name: 'filler', start: 49, end: 80, class: 'S', designation: 'M' }, // printed 32AN "Space fill"
  ],
};

/** Harmonized Nomenclature — input QP70 (INB-45 to INB-46). QP-Long only. */
export const QP70: RecordDef = {
  id: '70',
  name: 'InbondHarmonizedNomenclature',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '70' },
    // 10N but explicitly LEFT justified per the spec ("Left justify the
    // number and fill any remaining positions with spaces", INB-45);
    // minimum 6 positions. Mandatory for entry types 62/63 (INB-45).
    { name: 'harmonizedNumber', start: 3, end: 12, class: 'N', designation: 'M', justify: 'left' },
    { name: 'filler', start: 13, end: 13, class: 'S', designation: 'M' }, // printed 1AN "Space fill"
    { name: 'value', start: 14, end: 21, class: 'N', designation: 'M' }, // whole USD, > 0
    { name: 'weight', start: 22, end: 31, class: 'N', designation: 'M' }, // net weight, > 0, no decimals
    { name: 'weightUnit', start: 32, end: 33, class: 'A', designation: 'M' }, // WEIGHT_UNITS (INB-46)
    { name: 'filler2', start: 34, end: 80, class: 'S', designation: 'M' }, // printed 47AN "Space fill"
  ],
};

/** Bill Cargo Description — input QP71 (INB-47 to INB-48). QP-Long only. */
export const QP71: RecordDef = {
  id: '71',
  name: 'InbondBillCargoDescription',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '71' },
    // Mandatory for the first of multiple 71 records; the sum across all
    // 71 records must equal the QP40 manifest quantity (Note 1, INB-48).
    { name: 'pieceCount', start: 3, end: 12, class: 'N', designation: 'C' },
    { name: 'description', start: 13, end: 57, class: 'X', designation: 'M' },
    { name: 'manifestUnitCode', start: 58, end: 60, class: 'AN', designation: 'O' }, // ACE Ocean Appendix N
    { name: 'filler', start: 61, end: 80, class: 'S', designation: 'M' }, // printed 20AN "Space fill"
  ],
};

/** Marks and Numbers — input QP72 (INB-49). QP-Long only. */
export const QP72: RecordDef = {
  id: '72',
  name: 'InbondMarksAndNumbers',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '72' },
    { name: 'marksAndNumbers', start: 3, end: 47, class: 'X', designation: 'M' },
    { name: 'filler', start: 48, end: 80, class: 'S', designation: 'M' }, // printed 33AN "Space fill"
  ],
};

/** Hazardous Material — input QP75 (INB-50 to INB-51). QP-Long only. */
export const QP75: RecordDef = {
  id: '75',
  name: 'InbondHazardousMaterial',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '75' },
    { name: 'hazmatCode', start: 3, end: 12, class: 'X', designation: 'M' }, // UN/NA-prefixed id (Note 1)
    { name: 'hazmatClass', start: 13, end: 16, class: 'X', designation: 'O' }, // IMDG class/division
    { name: 'hazmatCodeQualifier', start: 17, end: 17, class: 'X', designation: 'O' }, // HAZMAT_QUALIFIERS (Note 2)
    { name: 'hazmatDescription', start: 18, end: 47, class: 'AN', designation: 'O' }, // proper shipping name
    { name: 'hazmatContact', start: 48, end: 71, class: 'AN', designation: 'O' },
    { name: 'flashpointTemperature', start: 72, end: 74, class: 'N', designation: 'O' }, // whole number, no decimals
    { name: 'flashpointUom', start: 75, end: 76, class: 'X', designation: 'O' }, // always CE = degrees Celsius
    { name: 'negativeIndicator', start: 77, end: 77, class: 'A', designation: 'O' }, // N when the flashpoint is below 0
    { name: 'filler', start: 78, end: 80, class: 'S', designation: 'M' }, // printed 3AN "Space fill"
  ],
};

/** Hazardous Material free-form continuation — input QP76 (INB-52). */
export const QP76: RecordDef = {
  id: '76',
  name: 'InbondHazardousMaterialContinuation',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '76' },
    { name: 'hazmatDescription', start: 3, end: 31, class: 'X', designation: 'C' }, // material name / instructions / phone
    { name: 'hazmatClassification', start: 32, end: 61, class: 'X', designation: 'C' }, // free-form classification / label requirements
    { name: 'filler', start: 62, end: 80, class: 'S', designation: 'M' }, // printed 19AN "Space fill"
  ],
};

// ── QT / WT output records ─────────────────────────────────

/** Error/Warning or Accept/Reject Message — output QT95 (INB-53). */
export const QT95: RecordDef = {
  id: '95',
  name: 'InbondAcceptReject',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '95' },
    { name: 'narrativeMessageTypeCode', start: 3, end: 4, class: 'N', designation: 'M' }, // NARRATIVE_MESSAGE_TYPES
    { name: 'narrativeMessageId', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'filler', start: 8, end: 8, class: 'S', designation: 'M' }, // printed 1AN "Space fill"
    { name: 'narrativeMessage', start: 9, end: 47, class: 'X', designation: 'M' },
    { name: 'filler2', start: 48, end: 80, class: 'S', designation: 'M' }, // printed 33AN "Space fill"
  ],
};

/** Error/Warning or Accept/Reject Message — output WT95 (INB-59). Same layout as QT95. */
export const WT95: RecordDef = {
  id: '95',
  name: 'InbondEventAcceptReject',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '95' },
    { name: 'narrativeMessageTypeCode', start: 3, end: 4, class: 'N', designation: 'M' },
    { name: 'narrativeMessageId', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'filler', start: 8, end: 8, class: 'S', designation: 'M' },
    { name: 'narrativeMessage', start: 9, end: 47, class: 'X', designation: 'M' },
    { name: 'filler2', start: 48, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── WP input records (arrival / export / transfer / diversion) ─

/** In-bond Event Header — input WP10 (INB-54 to INB-56). */
export const WP10: RecordDef = {
  id: '10',
  name: 'InbondEventHeader',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '10' },
    { name: 'actionCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // WP_ACTION_CODES (Note 1)
    // Conventional 9-digit (MOD-7 check digit, Note 2) or 'V' paperless
    // number; mandatory for action codes 1, 3, 5, 7, A and Z.
    { name: 'inBondNumber', start: 4, end: 15, class: 'AN', designation: 'C' },
    { name: 'billIssuerCode', start: 16, end: 19, class: 'AN', designation: 'C' }, // mandatory for 2, 3, 6, 7; 3-char AWB prefix for Air
    { name: 'billNumber', start: 20, end: 31, class: 'AN', designation: 'C' }, // mandatory for 2, 3, 6, 7; 8-digit AWB serial for Air
    { name: 'houseBillIssuerCode', start: 32, end: 35, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'houseBillNumber', start: 36, end: 47, class: 'AN', designation: 'C' }, // Air only
    { name: 'firmsCode', start: 48, end: 51, class: 'AN', designation: 'C' }, // mandatory for 1/2/3; not required for Air arrival
    { name: 'filler', start: 52, end: 63, class: 'S', designation: 'M' }, // printed 12AN "Space fill"
    { name: 'containerNumber', start: 64, end: 77, class: 'AN', designation: 'C' }, // mandatory for 3 and 7; not required for Air
    { name: 'filler2', start: 78, end: 80, class: 'S', designation: 'M' }, // printed 3AN "Space fill"
  ],
};

/** In-bond Event Detail — input WP20 (INB-57 to INB-58). */
export const WP20: RecordDef = {
  id: '20',
  name: 'InbondEventDetail',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '20' },
    { name: 'date', start: 3, end: 8, class: 'N', designation: 'M' }, // YYMMDD (arrival/export/transfer date)
    { name: 'time', start: 9, end: 14, class: 'N', designation: 'M' }, // HHMMSS, 24-hour clock
    { name: 'portOfArrival', start: 15, end: 18, class: 'N', designation: 'C' }, // mandatory for 1/2/3/Z; the NEW destination for Z
    { name: 'inBondCarrierCode', start: 19, end: 22, class: 'X', designation: 'C' }, // SCAC assuming liability; mandatory for A
    { name: 'bondedCarrierId', start: 23, end: 34, class: 'X', designation: 'C' }, // mandatory for A or Z; embedded hyphens included (Note 1)
    { name: 'cityName', start: 35, end: 53, class: 'AN', designation: 'C' }, // mandatory for A
    { name: 'stateCode', start: 54, end: 55, class: 'A', designation: 'C' }, // mandatory when a city name is supplied
    { name: 'exportMotCode', start: 56, end: 57, class: 'N', designation: 'O' }, // only 10/11 vessel; optional for 5/6/7 (Note 2)
    { name: 'exportConveyanceName', start: 58, end: 80, class: 'AN', designation: 'O' }, // both-or-neither with exportMotCode (Note 2)
  ],
};

// ── NS output records (status notification) ────────────────

/** Status Notification Header, conveyance form — output NS05 (INB-60). */
export const NS05: RecordDef = {
  id: '05',
  name: 'InbondStatusConveyanceHeader',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'AN', designation: 'M', constant: '05' }, // printed 2AN
    { name: 'conveyanceName', start: 3, end: 25, class: 'AN', designation: 'M' },
    { name: 'voyageTripNumber', start: 26, end: 30, class: 'N', designation: 'M' },
    { name: 'districtPort', start: 31, end: 34, class: 'N', designation: 'M' }, // Schedule D district/port of arrival
    { name: 'estimatedDateOfArrival', start: 35, end: 40, class: 'N', designation: 'M' }, // YYMMDD
    { name: 'estimatedTimeOfArrival', start: 41, end: 46, class: 'N', designation: 'C' }, // HHMMSS, Eastern time
    { name: 'filler', start: 47, end: 80, class: 'S', designation: 'M' }, // printed 34AN "Space fill"
  ],
};

/** Status Notification Header, in-bond form — output NS10 (INB-61 to INB-63). */
export const NS10: RecordDef = {
  id: '10',
  name: 'InbondStatusInbondHeader',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '10' },
    { name: 'inBondEntryType', start: 3, end: 4, class: 'N', designation: 'M' }, // 61/62/63
    { name: 'inBondNumber', start: 5, end: 16, class: 'AN', designation: 'M' }, // conventional 9N, left justified (Note 2)
    { name: 'usPortOfDestination', start: 17, end: 20, class: 'N', designation: 'M' },
    { name: 'foreignDestination', start: 21, end: 25, class: 'N', designation: 'C' }, // Schedule K; space fill for IT 61 (Note 1)
    { name: 'filler', start: 26, end: 80, class: 'S', designation: 'M' }, // printed 55AN "Space fill"
  ],
};

/** Status Notification Detail — output NS30 (INB-64 to INB-65). */
export const NS30: RecordDef = {
  id: '30',
  name: 'InbondStatusDetail',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '30' },
    { name: 'dispositionCode', start: 3, end: 4, class: 'AN', designation: 'M' }, // ACE Ocean Appendix D / Air Appendix A
    { name: 'billIssuerCode', start: 5, end: 8, class: 'AN', designation: 'M' }, // SCAC (or FIRMS for FTZ withdrawals)
    { name: 'billNumber', start: 9, end: 20, class: 'AN', designation: 'M' },
    { name: 'houseBillIssuerCode', start: 21, end: 24, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'houseBillNumber', start: 25, end: 36, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'subHouseBillIssuerCode', start: 37, end: 40, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'subHouseBillNumber', start: 41, end: 52, class: 'AN', designation: 'C' }, // reserved for future use — space fill
    { name: 'quantity', start: 53, end: 62, class: 'N', designation: 'M' }, // pieces affected by the disposition
    { name: 'negativeIndicator', start: 63, end: 63, class: 'A', designation: 'C' }, // N with disposition 1A/1B/1C
    { name: 'actionDate', start: 64, end: 69, class: 'N', designation: 'M' }, // YYMMDD
    { name: 'actionTime', start: 70, end: 73, class: 'N', designation: 'M' }, // HHMM, Eastern time
    { name: 'inBondCarrierCode', start: 74, end: 77, class: 'X', designation: 'M' },
    { name: 'filler', start: 78, end: 80, class: 'S', designation: 'M' }, // printed 3AN "Space fill"
  ],
};

/** Status Notification Detail continuation — output NS40 (INB-66). */
export const NS40: RecordDef = {
  id: '40',
  name: 'InbondStatusDetailContinuation',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '40' },
    { name: 'entryType', start: 3, end: 4, class: 'N', designation: 'C' }, // ACE Ocean Appendix B
    { name: 'entryNumber', start: 5, end: 19, class: 'AN', designation: 'C' },
    { name: 'districtPortOfTransaction', start: 20, end: 23, class: 'N', designation: 'M' },
    { name: 'firmsCode', start: 24, end: 27, class: 'AN', designation: 'C' },
    // When populated the notification is container-level; when blank it
    // applies to the entire bill of lading (Note 1, INB-66).
    { name: 'containerNumber', start: 28, end: 41, class: 'AN', designation: 'C' },
    { name: 'filler', start: 42, end: 80, class: 'S', designation: 'M' }, // printed 39AN "Space fill"
  ],
};

/** Status Notification Remarks — output NS50 (INB-67). Max 2 per NS30. */
export const NS50: RecordDef = {
  id: '50',
  name: 'InbondStatusRemarks',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '50' },
    { name: 'remarks', start: 3, end: 47, class: 'X', designation: 'M' },
    { name: 'filler', start: 48, end: 80, class: 'S', designation: 'M' }, // printed 33AN "Space fill"
  ],
};

/** Status Notification Container — output NS60 (INB-68). Max 999 per NS30. */
export const NS60: RecordDef = {
  id: '60',
  name: 'InbondStatusContainer',
  fields: [
    { name: 'recordType', start: 1, end: 2, class: 'N', designation: 'M', constant: '60' },
    { name: 'actionIndicator', start: 3, end: 3, class: 'N', designation: 'C' }, // 1 = container-level action; blank otherwise
    { name: 'containerNumber', start: 4, end: 17, class: 'AN', designation: 'C' },
    { name: 'sealNumber1', start: 18, end: 32, class: 'AN', designation: 'C' },
    { name: 'sealNumber2', start: 33, end: 47, class: 'AN', designation: 'C' },
    { name: 'filler', start: 48, end: 80, class: 'S', designation: 'M' }, // printed 33AN "Space fill"
  ],
};

// ── EA/EB/EY/EZ control-record & EDI-profile rejects (INB-69..72) ─

function structureRejectDef(letter: 'A' | 'B' | 'Y' | 'Z', name: string): RecordDef {
  return {
    id: `E${letter}`,
    name,
    fields: [
      { name: 'controlIdentifier', start: 1, end: 1, class: 'A', designation: 'M', constant: 'E' },
      { name: 'inputRecordId', start: 2, end: 2, class: 'A', designation: 'M', constant: letter },
      { name: 'narrativeMessage', start: 3, end: 42, class: 'X', designation: 'M' },
      { name: 'filler', start: 43, end: 80, class: 'S', designation: 'M' }, // printed 38AN "Space fill"
    ],
  };
}

/** Transaction control header reject — output EA (INB-69). */
export const EA = structureRejectDef('A', 'InbondTransactionControlHeaderReject');
/** Block control header reject — output EB (INB-70). */
export const EB = structureRejectDef('B', 'InbondBlockControlHeaderReject');
/** Block control trailer reject — output EY (INB-71). */
export const EY = structureRejectDef('Y', 'InbondBlockControlTrailerReject');
/** Transaction control trailer reject — output EZ (INB-72). */
export const EZ = structureRejectDef('Z', 'InbondTransactionControlTrailerReject');

for (const def of [
  QP10, QP20, QP30, QP32, QP33, QP40, QP50, QP51, QP52, QP55, QP56, QP57,
  QP60, QP61, QP62, QP65, QP70, QP71, QP72, QP75, QP76, QT95,
  WP10, WP20, WT95, NS05, NS10, NS30, NS40, NS50, NS60, EA, EB, EY, EZ,
]) {
  assertRecordDef(def);
}

// ── Code tables ────────────────────────────────────────────

/**
 * In-bond entry types — QP10 (INB-19) / NS10 (INB-61), with the per-type
 * event lifecycle from WP10 Note 1 (INB-56): "Type IT '61' in-bond needs
 * only to be arrived. Type T&E '62' must first be arrived, and then must
 * be exported. Type IE '63' in-bond needs only to be exported."
 */
export const IN_BOND_ENTRY_TYPES: Record<string, string> = {
  '61': 'Immediate Transportation (IT) — arrive only',
  '62': 'Transportation and Exportation (T&E) — arrive, then export',
  '63': 'Immediate Exportation (IE) — export only',
};

/** QP10 action codes (INB-19). */
export const QP10_ACTION_CODES: Record<string, string> = {
  A: 'Add in-bond',
  B: 'Delete in-bond from bill',
  D: 'Delete in-bond from all associated bills',
};

/** QP30 action codes (INB-26). */
export const QP30_ACTION_CODES: Record<string, string> = {
  A: 'Add bill data',
  D: 'Delete in-bond from bill',
};

/** WP10 action codes — WP10 Note 1 (INB-55..56). */
export const WP_ACTION_CODES: Record<string, string> = {
  '1': 'Arrive entire in-bond at destination',
  '2': 'Arrive bill of lading at destination',
  '3': 'Arrive container/equipment at destination (containerized only; not used for Air)',
  '5': 'Export entire in-bond from destination',
  '6': 'Export bill of lading from destination port',
  '7': 'Export container/equipment from destination port (containerized only; not used for Air)',
  A: 'Transfer of in-bond liability for entire in-bond (not used for Air)',
  Z: 'Diversion request',
};

/** QP33 reference identifier qualifiers — QP33 Note 1 (INB-30..31). */
export const QP33_REFERENCE_QUALIFIERS: Record<string, string> = {
  '2K': 'Food and Drug Administration (FDA) Product Type',
  BL: 'Government Bill of Lading',
  BM: 'Bill of Lading Number',
  BN: 'Booking Number',
  CG: "Consignee's Order Number",
  CN: "Carrier's Reference Number (PRO/Invoice)",
  CO: 'Customer Order Number',
  CR: 'Customer Reference Number',
  CSK: 'Schedule K',
  CUB: 'USCBP Bill of Lading Number',
  CX: 'Consignment Classification ID',
  ED: 'Export Declaration',
  FEN: 'Foreign Entry Number (Pedimento)', // 15N yyppbbbbddddddd, left justified (Note 2)
  FN: "Forwarder's/Agent's Reference Number",
  FP: 'Forestry Permit Number',
  GB: 'Grain Block Number',
  GR: 'Grain Order Reference Number',
  HS: 'Harmonized Code System', // non-IE/T&E shipments, or shipper HS > 6 digits
  IN: "Consignee's Invoice Number",
  LT: 'Lot Number',
  MA: 'Ship Notice/Manifest Number (Automotive ASN Number)',
  MB: 'Master Bill of Lading',
  OM: 'Ocean Manifest',
  OW: 'Service Order Number',
  PK: 'Packing List Number',
  PN: 'Permit Number',
  PO: 'Purchase Order Number',
  RC: 'Rail Routing Code (Automotive Manufacturers and Brokers)',
  S7: 'Stack Train Identification',
  SI: "Shipper's Identifying Number for Shipment (SID)",
  SO: "Shipper's Order (Invoice Number)",
  ST: 'Store Number',
  SW: "Seller's Sale Number",
  UT: 'Unit Train',
  VA: 'Vessel Agent Number',
  WU: 'Vessel',
  WY: 'Waybill Number',
  XC: 'Cargo Control Number',
  XP: 'Previous Cargo Control Number',
  ZE: 'Coal Authority Number',
  ZZ: 'Mutually Defined',
};

/** Weight unit codes — QP40 (INB-32) / QP70 (INB-46). */
export const WEIGHT_UNITS: Record<string, string> = {
  LB: 'Pounds',
  KG: 'Kilograms',
  LT: 'Long Ton',
  ST: 'Short Ton',
  ET: 'Metric Ton',
  MT: 'Measurement Ton',
};

/** Volume unit codes — QP40 (INB-33). */
export const VOLUME_UNITS: Record<string, string> = {
  BB: 'Barge',
  CC: 'Cubic Centimeters',
  DD: 'Cord',
  CF: 'Cubic Feet',
  CM: 'Cubic Meters',
  FF: '100 Board Feet',
  GG: 'Gallons',
  HH: 'Hundreds of Measurement Tons',
  LL: 'Load',
  MM: 'Cubic Decimeters',
  NN: 'Cubic Inches',
  RR: 'Car',
  SS: 'Measurement Ton',
  TT: 'Container',
  UU: 'Volumetric Unit',
  VV: 'Liter',
};

/** QT95/WT95 narrative message types (INB-53 / INB-59). */
export const NARRATIVE_MESSAGE_TYPES: Record<string, string> = {
  '01': 'Data Rejection (Error)',
  '02': 'Data Acceptance',
  '03': 'Data Acceptance with Warning',
};

/** Hazardous material code qualifiers — QP75 Note 2 (INB-51). */
export const HAZMAT_QUALIFIERS: Record<string, string> = {
  '4': '46 Level DOT Code',
  '6': 'Airline Tariff 6D',
  '9': 'Title 49 Code of Federal Regulations',
  A: 'International Civil Aviation',
  D: 'Hazardous Materials ID DOT',
  E: 'Endorsement',
  F: 'Air Force Regulation 71-4',
  I: 'International Maritime Organization (IMO) Code',
  R: 'Bureau of Explosives 600-A (rail)',
  U: 'United Nations',
};

/**
 * Canada/Mexico inland lading codes — used when cargo was laden on the
 * importing railroad or truck at an inland location and the shipment is
 * destined for a non-seaport location in Canada or Mexico; in-bond only
 * (QP10 Note 1 INB-21, QP40 Note 1 INB-34, NS10 Note 1 INB-62). Spellings
 * ('Navarit') are the chapter's.
 */
export const INLAND_LADING_CODES: Record<string, string> = {
  // Canadian provinces
  '80101': 'Alberta',
  '80102': 'Manitoba',
  '80103': 'Saskatchewan',
  '80104': 'Northwest Territories',
  '80105': 'Yukon',
  '80106': 'British Columbia',
  '80107': 'Ontario',
  '80108': 'Quebec',
  '80109': 'Nova Scotia',
  '80110': 'New Brunswick',
  '80111': 'Prince Edward Island',
  '80112': 'Newfoundland',
  '80113': 'Nunavut',
  // Mexican states
  '97101': 'Aguascalientes',
  '97102': 'Baja California Norte',
  '97103': 'Baja California Sur',
  '97104': 'Chihuahua',
  '97105': 'Colima',
  '97106': 'Campeche',
  '97107': 'Coahuila',
  '97108': 'Chiapas',
  '97109': 'Distrito Federal',
  '97110': 'Durango',
  '97111': 'Guerrero',
  '97112': 'Guanajuato',
  '97113': 'Hidalgo',
  '97114': 'Jalisco',
  '97115': 'Michoacan',
  '97116': 'Morelos',
  '97117': 'Mexico',
  '97118': 'Navarit',
  '97119': 'Nuevo Leon',
  '97120': 'Oaxaca',
  '97121': 'Puebla',
  '97122': 'Quintana Roo',
  '97123': 'Queretaro',
  '97124': 'Sinaloa',
  '97125': 'San Luis Potosi',
  '97126': 'Sonora',
  '97127': 'Tabasco',
  '97128': 'Tlaxcala',
  '97129': 'Tamaulipas',
  '97130': 'Veracruz',
  '97131': 'Yucatan',
  '97132': 'Zacatecas',
};
