/**
 * PGA Message Set input record definitions — transcribed from the ACE ABI
 * CATAIR "Participating Government Agencies Message Set" chapter, July 01,
 * 2026, Pub # 0875-0419 (docs/abi-engine/specs/pga/pga-message-set-2026-07.pdf).
 * Page references in comments are to that chapter's printed page numbers.
 *
 * The message set is submitted as part of another transmission (AE Entry
 * Summary after the 50-record, SE after the 60-record — p.13). Records
 * covered here: OI, PG01, PG02, PG06, PG07, PG08, PG10, PG19, PG20, PG21,
 * PG22, PG23, PG25, PG26, PG30, PG35, PG50, PG51, PG55, PG60, PG00.
 * (PG04/PG05/PG13/PG14/PG17/PG18/PG24/PG27–PG29/PG31–PG34 are not yet
 * transcribed — none are needed for the FDA minimal sets.)
 *
 * Data element classes (chapter p.14): the PGA chapter defines only A, AN,
 * N and X. Formatting rules: A/AN/X are left justified and space filled;
 * N is right justified and ZERO-filled. The shared codec pads N fields with
 * spaces, so builders must supply numeric values already zero-filled to the
 * field width (e.g. PG26 quantity '000000027734'). Per p.14, UNUSED numeric
 * fields must be space filled, not zero filled — which is exactly what the
 * codec does when a value is omitted.
 *
 * The chapter prints the record tag as two data elements — Control
 * Identifier (positions 1-2, 'PG'; 'OI' for the OI record) and Record Type
 * (positions 3-4) — declared as separate constant fields. Per house
 * convention every spec "Filler … Space fill" row is an explicit class-'S'
 * mandatory field so each record tiles positions 1-80.
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── OI: PGA line item description ──────────────────────────

/**
 * PGA line item description — input OI-Record (p.16). Mandatory; precedes
 * the PGA Message Set records. Only one OI record is allowed per HTS code.
 */
export const INPUT_OI: RecordDef = {
  id: 'OI',
  name: 'PgaLineItemDescription',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'OI' },
    { name: 'filler', start: 3, end: 10, class: 'S', designation: 'M' },
    // A clear description of the commercial line item in English.
    { name: 'commercialDescription', start: 11, end: 80, class: 'X', designation: 'M' },
  ],
};

// ── PG01: PGA line header ──────────────────────────────────

/**
 * PGA line number / agency / product id / intended use / disclaimer —
 * input PG01-Record (p.17-20).
 *
 * PGA Line Number: begins at 001 within a CBP line for a given Agency Code
 * and increments on subsequent PG01 records for that same agency; it
 * restarts at 001 when the Agency Code changes (p.13, p.65).
 */
export const INPUT_PG01: RecordDef = {
  id: 'PG01',
  name: 'PgaLineHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '01' },
    { name: 'pgaLineNumber', start: 5, end: 7, class: 'N', designation: 'M' }, // 001, zero-filled (p.17)
    { name: 'governmentAgencyCode', start: 8, end: 10, class: 'AN', designation: 'M' }, // Appendix V
    { name: 'governmentAgencyProgramCode', start: 11, end: 13, class: 'X', designation: 'M' }, // Appendix PGA
    { name: 'governmentAgencyProcessingCode', start: 14, end: 16, class: 'AN', designation: 'C' }, // Appendix PGA
    { name: 'electronicImageSubmitted', start: 17, end: 17, class: 'A', designation: 'C' },
    { name: 'confidentialInformationIndicator', start: 18, end: 18, class: 'A', designation: 'C' }, // Y only
    { name: 'globallyUniqueProductIdQualifier', start: 19, end: 22, class: 'AN', designation: 'C' }, // GTIN/UPC etc.
    { name: 'globallyUniqueProductIdCode', start: 23, end: 41, class: 'X', designation: 'C' },
    { name: 'intendedUseCode', start: 42, end: 57, class: 'X', designation: 'C' }, // Appendix R
    { name: 'intendedUseDescription', start: 58, end: 78, class: 'X', designation: 'C' }, // free text if 980.000
    { name: 'correctionIndicator', start: 79, end: 79, class: 'X', designation: 'C' }, // PGA Data Corrections spec
    { name: 'disclaimer', start: 80, end: 80, class: 'A', designation: 'C' }, // A-G, see DISCLAIMER_CODES (p.19)
  ],
};

/**
 * PG01 position-80 Disclaimer codes (p.19-20). A code indicating the reason
 * data is not being provided. Per Note 1 (p.20) these codes are generally
 * NOT allowed if the HTS tariff is flagged as 'Must Be' provided (agency
 * exceptions apply). Code E is FWS-only; F is FDA-only (Entry Type 21);
 * G is USDA APHIS Lacey-only.
 */
export const DISCLAIMER_CODES = {
  A: 'Product is not regulated by this agency',
  B: 'Data is not required per agency guidance',
  C: 'Data filed through other agency means',
  D: 'Data filed through paper',
  E:
    'Product does not contain fish or wildlife, including live, dead, parts or products thereof, ' +
    'except as specifically exempted from declaration requirements under 50 CFR Part 14 (FWS only)',
  F:
    'Product is manufactured in any state of the US, the District of Columbia, or Puerto Rico and ' +
    'sourced directly to the warehouse without ever leaving the US (FDA only, Entry Type 21)',
  G:
    'Weight of plant material in the individual product unit is no more than 5 percent of the total ' +
    'weight of the individual product unit, and the total weight of the plant material in an entry of ' +
    'products in the same 10-digit HTS provision does not exceed 2.9 kilograms (USDA APHIS Lacey only)',
} as const;

// ── PG02: product / component indicator ────────────────────

/**
 * Product/component item type + non-globally-unique product codes — input
 * PG02-Record (p.21-22). If a disclaimer is provided in the PG01 record,
 * then only the OI and PG01 records are required to be submitted (p.21);
 * otherwise a PG02 is expected. There can only be one PG02 'P' associated
 * with a PGA line number (p.21). Multiple product codes of the SAME
 * qualifier at the product level force a new PGA line; different qualifiers
 * describing a single product share one PG02 (p.21).
 *
 * FDA note (Supplemental Guide v2.6): for FDA filings the Product Code
 * Qualifier is always 'FDP' and the FDA Product Code must be exactly
 * 7 characters; only one FDA product code is allowed per line. For program
 * FOO with processing code CCW, Industry Code (positions 1-2 of the product
 * code) must be 52 with Class Code A, B, E or Y.
 */
export const INPUT_PG02: RecordDef = {
  id: 'PG02',
  name: 'PgaProductComponent',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '02' },
    { name: 'itemType', start: 5, end: 5, class: 'A', designation: 'M' }, // P = Product, C = Component
    { name: 'productCodeQualifier1', start: 6, end: 9, class: 'AN', designation: 'C' }, // Appendix PGA
    { name: 'productCodeNumber1', start: 10, end: 28, class: 'X', designation: 'C' },
    { name: 'productCodeQualifier2', start: 29, end: 32, class: 'AN', designation: 'C' },
    { name: 'productCodeNumber2', start: 33, end: 51, class: 'X', designation: 'C' },
    { name: 'productCodeQualifier3', start: 52, end: 55, class: 'AN', designation: 'C' },
    { name: 'productCodeNumber3', start: 56, end: 74, class: 'X', designation: 'C' },
    { name: 'filler', start: 75, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG06: source (origin) / processing ─────────────────────

/**
 * Source type, country, geographic location and processing — input
 * PG06-Record (p.25-27). May be used with PG05 to relate genus/species and
 * country of origin; for the Lacey Act a PG05/PG06 pair is required per
 * Country of Harvest.
 *
 * FDA note (Supplemental Guide v2.6): mandatory for food lines — Source
 * Type Code 262 (Place of growth) for natural-state food/feed, otherwise
 * 39 (Country of Production); 294 flags a country that previously refused
 * the line items.
 */
export const INPUT_PG06: RecordDef = {
  id: 'PG06',
  name: 'PgaSourceCountry',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '06' },
    { name: 'sourceTypeCode', start: 5, end: 7, class: 'AN', designation: 'M' }, // e.g. HRV for Lacey (p.26)
    // ISO country; XZ if 5+ possible Lacey harvest countries; ZZ for high-seas landings (p.26).
    { name: 'countryCode', start: 8, end: 9, class: 'X', designation: 'C' },
    { name: 'geographicLocation', start: 10, end: 29, class: 'X', designation: 'C' },
    { name: 'processingStartDate', start: 30, end: 37, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'processingEndDate', start: 38, end: 45, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'processingTypeCode', start: 46, end: 50, class: 'AN', designation: 'C' },
    { name: 'processingDescription', start: 51, end: 80, class: 'X', designation: 'C' }, // mandatory for type 017
  ],
};

// ── PG07 / PG08: trade name, model, item identity ──────────

/** Trade/brand name, model, manufacture date, item identity — input PG07-Record (p.28). */
export const INPUT_PG07: RecordDef = {
  id: 'PG07',
  name: 'PgaItemIdentity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '07' },
    { name: 'tradeNameBrandName', start: 5, end: 39, class: 'X', designation: 'C' },
    { name: 'model', start: 40, end: 54, class: 'X', designation: 'C' },
    // MMCCYY; for century+year only, zero-fill positions 55-56 (p.28).
    { name: 'manufactureMonthYear', start: 55, end: 60, class: 'N', designation: 'C' },
    { name: 'itemIdentityNumberQualifier', start: 61, end: 63, class: 'AN', designation: 'C' }, // VIN, serial…
    { name: 'itemIdentityNumber', start: 64, end: 80, class: 'X', designation: 'C' },
  ],
};

/**
 * Additional item identity numbers — input PG08-Record (p.29). Must be used
 * in conjunction with the PG07; may be repeated. All numbers must be of the
 * type designated by the Item Identity Number Qualifier on the PG07.
 */
export const INPUT_PG08: RecordDef = {
  id: 'PG08',
  name: 'PgaItemIdentityNumbers',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '08' },
    { name: 'itemIdentityNumber1', start: 5, end: 21, class: 'X', designation: 'C' },
    { name: 'itemIdentityNumber2', start: 22, end: 38, class: 'X', designation: 'C' },
    { name: 'itemIdentityNumber3', start: 39, end: 55, class: 'X', designation: 'C' },
    { name: 'itemIdentityNumber4', start: 56, end: 72, class: 'X', designation: 'C' },
    { name: 'filler', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG10: additional product characteristics ───────────────

/**
 * Additional product/component characteristics — input PG10-Record (p.30).
 * Repeatable.
 *
 * FDA note (Supplemental Guide v2.6): FDA uses the Commodity Characteristic
 * Description (positions 24-80) for the common/market/usual product name or
 * free-form invoice description — not the product code description.
 */
export const INPUT_PG10: RecordDef = {
  id: 'PG10',
  name: 'PgaCommodityCharacteristics',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '10' },
    { name: 'categoryTypeCode', start: 5, end: 10, class: 'AN', designation: 'C' },
    { name: 'categoryCode', start: 11, end: 15, class: 'AN', designation: 'C' },
    { name: 'commodityQualifierCode', start: 16, end: 19, class: 'X', designation: 'C' },
    { name: 'commodityCharacteristicQualifier', start: 20, end: 23, class: 'AN', designation: 'C' },
    { name: 'commodityCharacteristicDescription', start: 24, end: 80, class: 'X', designation: 'C' },
  ],
};

// ── PG19 / PG20 / PG21: entity trios ───────────────────────

/**
 * Entity role, identification, name, address 1 — input PG19-Record (p.35).
 * Repeatable for multiple entities. Per the parent-child model (p.63-64),
 * each entity's PG19 is immediately followed by its PG20/PG21 records so
 * ACE can associate each 19-20-21 as one set — never all 19s then all 20s.
 * If providing a CBP-assigned number for a location, a FIRMS code goes in
 * the entity number field. For FDA actual manufacturer numbers see CSMS
 * 00-0824 (p.35).
 *
 * FDA note (Supplemental Guide v2.6): entity roles MF (manufacturer), DEQ
 * (shipper), FD1 (FDA importer of record) and DP (delivered-to party) are
 * mandatory on every FDA line — each role at most once per PGA line. Entity
 * Identification Code 16 = DUNS (9N) and 47 = FEI (1-10N); if either the
 * code or the number is sent, both must be.
 */
export const INPUT_PG19: RecordDef = {
  id: 'PG19',
  name: 'PgaEntity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '19' },
    { name: 'entityRoleCode', start: 5, end: 7, class: 'AN', designation: 'M' }, // Appendix PGA
    { name: 'entityIdentificationCode', start: 8, end: 10, class: 'AN', designation: 'C' }, // DUNS/FEI/MID…
    { name: 'entityNumber', start: 11, end: 25, class: 'X', designation: 'C' },
    { name: 'entityName', start: 26, end: 57, class: 'X', designation: 'C' },
    { name: 'entityAddress1', start: 58, end: 80, class: 'X', designation: 'C' },
  ],
};

/** Entity address continuation — input PG20-Record (p.36). Used with PG19; repeats with it. */
export const INPUT_PG20: RecordDef = {
  id: 'PG20',
  name: 'PgaEntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '20' },
    { name: 'entityAddress2', start: 5, end: 36, class: 'X', designation: 'C' },
    { name: 'entityApartmentSuiteNumber', start: 37, end: 41, class: 'X', designation: 'C' },
    { name: 'entityCity', start: 42, end: 62, class: 'X', designation: 'C' },
    { name: 'entityStateProvince', start: 63, end: 65, class: 'AN', designation: 'C' }, // Appendix B
    { name: 'entityCountry', start: 66, end: 67, class: 'A', designation: 'C' }, // ISO, Appendix B
    { name: 'entityZipPostalCode', start: 68, end: 76, class: 'X', designation: 'C' },
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' },
  ],
};

/**
 * Individual (point of contact) — input PG21-Record (p.37). Relates to the
 * entity in the preceding PG19/PG22 record or the inspection location in a
 * preceding PG30; follows each entity it belongs to and may repeat.
 *
 * FDA note (Supplemental Guide v2.6): at least one PG21 with qualifier FD1
 * is required per FDA line (with the preceding PG19/PG20 FD1 records); a
 * PK (filer/broker) contact is strongly encouraged, at most one per line.
 */
export const INPUT_PG21: RecordDef = {
  id: 'PG21',
  name: 'PgaIndividual',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '21' },
    { name: 'individualQualifier', start: 5, end: 7, class: 'AN', designation: 'C' }, // PG19 role codes
    { name: 'individualName', start: 8, end: 30, class: 'X', designation: 'C' },
    { name: 'individualTelephoneNumber', start: 31, end: 45, class: 'X', designation: 'C' },
    { name: 'individualEmailOrFax', start: 46, end: 80, class: 'X', designation: 'C' },
  ],
};

// ── PG22: substantiating documents / conformance ───────────

/**
 * Importers substantiating documents, document identifiers, conformance
 * declarations, declaration certifications — input PG22-Record (p.38).
 * Repeatable. If the Entity Role Code is used, PG19/PG20/PG21 must be
 * completed with name, address and contact information as required.
 */
export const INPUT_PG22: RecordDef = {
  id: 'PG22',
  name: 'PgaConformanceDeclaration',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '22' },
    { name: 'importersSubstantiatingDocument', start: 5, end: 5, class: 'A', designation: 'C' }, // Y only
    { name: 'documentIdentifier', start: 6, end: 12, class: 'AN', designation: 'C' }, // Appendix PGA
    { name: 'conformanceDeclaration', start: 13, end: 17, class: 'X', designation: 'C' }, // form box, e.g. 2B
    { name: 'entityRoleCode', start: 18, end: 20, class: 'AN', designation: 'C' }, // PG19 role codes
    { name: 'declarationCode', start: 21, end: 24, class: 'AN', designation: 'C' }, // Appendix PGA
    { name: 'declarationCertification', start: 25, end: 25, class: 'A', designation: 'C' }, // Y only
    { name: 'dateOfSignature', start: 26, end: 33, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'invoiceNumber', start: 34, end: 50, class: 'X', designation: 'C' },
    { name: 'complianceDescription', start: 51, end: 80, class: 'X', designation: 'C' },
  ],
};

// ── PG23: FDA affirmation of compliance ────────────────────

/**
 * FDA Affirmation of Compliance — input PG23-Record (p.39). Typically only
 * used by FDA; repeatable.
 */
export const INPUT_PG23: RecordDef = {
  id: 'PG23',
  name: 'PgaAffirmationOfCompliance',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '23' },
    { name: 'affirmationOfComplianceCode', start: 5, end: 9, class: 'X', designation: 'M' }, // Appendix PGA
    { name: 'affirmationOfComplianceDescription', start: 10, end: 79, class: 'X', designation: 'C' },
    { name: 'filler', start: 80, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG25: temperature / lot / value ────────────────────────

/**
 * Temperature, lot number, production date range, PGA line/unit value —
 * input PG25-Record (p.41; TOC p.40-41 area). Repeatable for multiple lot
 * number qualifiers and lot numbers. Use PG25 for processing performed in
 * lots; PG06 otherwise (p.64).
 */
export const INPUT_PG25: RecordDef = {
  id: 'PG25',
  name: 'PgaTemperatureLotValue',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '25' },
    // A=Ambient F=Frozen R=Refrigerated/Chilled D=Dry Ice H=Fresh U=Uncontrolled P=Flashpoint
    { name: 'temperatureQualifier', start: 5, end: 5, class: 'A', designation: 'C' },
    { name: 'degreeType', start: 6, end: 6, class: 'A', designation: 'C' }, // F | C | K
    { name: 'negativeNumber', start: 7, end: 7, class: 'A', designation: 'C' }, // X if negative
    { name: 'actualTemperature', start: 8, end: 13, class: 'N', designation: 'C' }, // 2 implied decimals
    { name: 'temperatureRecordingLocation', start: 14, end: 14, class: 'A', designation: 'C' }, // A/B/C
    { name: 'lotNumberQualifier', start: 15, end: 15, class: 'AN', designation: 'C' }, // 1=Mfr 2=Seller 3=Grower 4=Producer
    { name: 'lotNumber', start: 16, end: 40, class: 'X', designation: 'C' },
    { name: 'lotProductionStartDate', start: 41, end: 48, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'lotProductionEndDate', start: 49, end: 56, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'pgaLineValue', start: 57, end: 68, class: 'N', designation: 'C' }, // whole dollars
    { name: 'pgaUnitValue', start: 69, end: 80, class: 'N', designation: 'C' }, // 2 implied decimals
  ],
};

// ── PG26: packaging / quantity ─────────────────────────────

/**
 * Packaging qualifier, quantity, unit of measure — input PG26-Record
 * (p.42). Repeatable up to SIX times: the first record describes the
 * outermost (largest, level 1) container, subsequent records the next
 * smallest, and the LAST quantity record must describe the actual amount of
 * the product in the smallest container (the base quantity).
 *
 * FDA note (Supplemental Guide v2.6): two implied decimal places on the
 * quantity for all packaging levels (4 pieces = 000000000400); the same
 * unit of measure cannot repeat among a line's PG26 records; the last unit
 * transmitted must be a base unit, and only one base unit is allowed.
 */
export const INPUT_PG26: RecordDef = {
  id: 'PG26',
  name: 'PgaPackaging',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '26' },
    { name: 'packagingQualifier', start: 5, end: 5, class: 'N', designation: 'M' }, // 1 (outermost) … 6 (innermost)
    { name: 'quantity', start: 6, end: 17, class: 'N', designation: 'C' }, // 2 implied decimals, zero-filled
    { name: 'unitOfMeasure', start: 18, end: 22, class: 'X', designation: 'C' }, // Appendix PGA / Appendix B
    { name: 'packageIdentifier', start: 23, end: 47, class: 'X', designation: 'C' }, // marks & numbers, not lot
    { name: 'packagingMethod', start: 48, end: 50, class: 'AN', designation: 'C' }, // Appendix B shipping units
    { name: 'packageMaterial', start: 51, end: 65, class: 'X', designation: 'C' },
    { name: 'packageFiller', start: 66, end: 80, class: 'X', designation: 'C' }, // hay, paper, plastic…
  ],
};

// ── PG30: inspection / anticipated arrival ─────────────────

/**
 * Inspection / laboratory testing / anticipated arrival — input PG30-Record
 * (p.48-49). Used for agencies such as FDA Prior Notice (status A =
 * anticipated arrival). If requesting an inspection, PG21 individual
 * information may be required; if a lab test was previously performed,
 * PG19/PG20/PG21 may be required — those records then FOLLOW the PG30
 * (p.64). May be repeated if more space is needed for the location.
 */
export const INPUT_PG30: RecordDef = {
  id: 'PG30',
  name: 'PgaInspectionArrival',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '30' },
    // R=Request S=Scheduled P=Previously performed L=Lab testing performed
    // N=No lab testing performed A=Anticipated arrival I=Product location F=From FTZ (FDA Type 21)
    { name: 'inspectionLaboratoryTestingStatus', start: 5, end: 5, class: 'A', designation: 'M' },
    { name: 'inspectionOrArrivalDate', start: 6, end: 13, class: 'N', designation: 'C' }, // MMDDCCYY
    { name: 'inspectionOrArrivalTime', start: 14, end: 17, class: 'N', designation: 'C' }, // HHMM, 0001-2400
    { name: 'inspectionOrArrivalLocationCode', start: 18, end: 21, class: 'AN', designation: 'C' }, // FIRMS/port…
    { name: 'inspectionOrArrivalLocation', start: 22, end: 71, class: 'X', designation: 'C' },
    { name: 'filler', start: 72, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG35: DOT conformance bond ─────────────────────────────

/** DOT/NHTSA conformance bond — input PG35-Record (p.54). */
export const INPUT_PG35: RecordDef = {
  id: 'PG35',
  name: 'PgaDotConformanceBond',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '35' },
    { name: 'dotSuretyCode', start: 5, end: 7, class: 'AN', designation: 'C' },
    { name: 'dotBondSerialNumber', start: 8, end: 37, class: 'X', designation: 'C' },
    { name: 'dotBondQualifier', start: 38, end: 38, class: 'N', designation: 'C' }, // 1=Single 2=Continuous
    { name: 'dotBondAmount', start: 39, end: 46, class: 'N', designation: 'C' }, // whole US dollars
    { name: 'filler', start: 47, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG50 / PG51: grouping ──────────────────────────────────

/**
 * Start of a grouping — input PG50-Record (p.55). PG02, PG04, PG13 and
 * PG14 can be parents of a group; a group is associated with its closest
 * parent. If a PG50 is used, a PG51 must also be transmitted (p.66); only
 * one level of grouping is allowed (p.67).
 */
export const INPUT_PG50: RecordDef = {
  id: 'PG50',
  name: 'PgaGroupStart',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '50' },
    { name: 'filler', start: 5, end: 80, class: 'S', designation: 'M' },
  ],
};

/** End of a grouping — input PG51-Record (p.56). */
export const INPUT_PG51: RecordDef = {
  id: 'PG51',
  name: 'PgaGroupEnd',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '51' },
    { name: 'filler', start: 5, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG55: additional entity roles ──────────────────────────

/**
 * Additional roles performed by an entity or individual — input PG55-Record
 * (p.57). Follows the PG19/PG20 records (entity roles) or the PG21 record
 * (individual roles) — p.37. Role codes are the PG19 Entity Role Codes.
 */
export const INPUT_PG55: RecordDef = {
  id: 'PG55',
  name: 'PgaAdditionalEntityRoles',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '55' },
    { name: 'entityRoleCode1', start: 5, end: 7, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode2', start: 8, end: 10, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode3', start: 11, end: 13, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode4', start: 14, end: 16, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode5', start: 17, end: 19, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode6', start: 20, end: 22, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode7', start: 23, end: 25, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode8', start: 26, end: 28, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode9', start: 29, end: 31, class: 'AN', designation: 'C' },
    { name: 'entityRoleCode10', start: 32, end: 34, class: 'AN', designation: 'C' },
    { name: 'filler', start: 35, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── PG60: additional reference information ─────────────────

/**
 * Additional reference information — input PG60-Record (p.58). Provides
 * overflow/additional data for the PG record immediately preceding it; can
 * follow a PG07, PG19, PG20 or PG21. Valid qualifier codes (p.58): AD1,
 * AD2, AD3, AD4, AD5, ECI, ENA, TEL, EMA, CIT, INA, TBN, PMN, CP1, CP2,
 * CP3, CP4, LAT, LON.
 */
export const INPUT_PG60: RecordDef = {
  id: 'PG60',
  name: 'PgaAdditionalReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '60' },
    { name: 'additionalInformationQualifierCode', start: 5, end: 7, class: 'AN', designation: 'M' },
    { name: 'additionalInformation', start: 8, end: 80, class: 'X', designation: 'M' },
  ],
};

// ── PG00: substitution grouping ────────────────────────────

/**
 * Data substitution grouping — input PG00-Record (p.59). S = start of a
 * substitution group, E = end, R = replace this record with the group
 * indicated by the Substitution Number. Numbers run 0001-9999, unique and
 * sequential per transaction (p.70).
 *
 * The layout table prints the Substitution Number as status M, but its own
 * description says it is "mandatory when using the S or R substitution
 * indicator", and the chapter's worked example (p.69) transmits "PG00E"
 * with no number — so it is declared conditional here and the builder-level
 * rule (required for S/R) governs.
 */
export const INPUT_PG00: RecordDef = {
  id: 'PG00',
  name: 'PgaSubstitution',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'A', designation: 'M', constant: 'PG' },
    { name: 'recordType', start: 3, end: 4, class: 'N', designation: 'M', constant: '00' },
    { name: 'substitutionIndicator', start: 5, end: 5, class: 'X', designation: 'M' }, // S | E | R
    { name: 'substitutionNumber', start: 6, end: 9, class: 'AN', designation: 'C' }, // 0001-9999
    { name: 'filler', start: 10, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [
  INPUT_OI,
  INPUT_PG01,
  INPUT_PG02,
  INPUT_PG06,
  INPUT_PG07,
  INPUT_PG08,
  INPUT_PG10,
  INPUT_PG19,
  INPUT_PG20,
  INPUT_PG21,
  INPUT_PG22,
  INPUT_PG23,
  INPUT_PG25,
  INPUT_PG26,
  INPUT_PG30,
  INPUT_PG35,
  INPUT_PG50,
  INPUT_PG51,
  INPUT_PG55,
  INPUT_PG60,
  INPUT_PG00,
]) {
  assertRecordDef(def);
}
