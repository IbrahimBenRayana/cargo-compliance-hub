/**
 * ACE Cargo Release (SE/SX) and Status Notification (SO) record
 * definitions — transcribed from the CATAIR "ACE Cargo Release" chapter,
 * July 1, 2025 Version 40 (cited as CR p.N = PDF page, SE-n = chapter
 * page) and the "ACE Cargo Release – SO Status Notification" chapter,
 * September 10, 2025 Revision 36 (SO p.N / SO-n).
 *
 * Input records: SE10, SE11, SE13, SE15, SE16, SE17, SE20, SE30, SE31,
 * SE35, SE36, SE40, SE41, SE50, SE51, SE55, SE56, SE60, SE61, plus the
 * Unified Entry/ISF SF records (UNIFIED_SF10 … UNIFIED_SF36) appended
 * after the last SE60/PG record (CR p.30/SE-28, map CR p.32/SE-30).
 * Output: SE90 (SX response) and SO10…SO72 (SO status notification).
 *
 * Positions are transcribed digit-for-digit from the chapters' Position
 * columns; every printed "Filler" row (including fillers printed with a
 * data class) is an explicit class-'S' mandatory field so each record
 * tiles positions 1-80, per the isf/recordDefs.ts convention.
 *
 * The UNIFIED_SF* records deliberately duplicate (rather than reuse) the
 * standalone isf/ module's SF defs because the Cargo Release chapter's
 * field usage differs:
 *  - UNIFIED_SF10 (CR p.75/SE-73): positions 29-36 are printed "Reserved
 *    8X M Space fill" where the standalone SF10 carries the importer Date
 *    of Birth; the Bond Holder / Bond Activity Code / Bond Type / Country
 *    of Issuance fields are printed M but with the instruction "Space
 *    fill for Unified Entry/ISF filing" (bond data comes from the Entry,
 *    CR p.77 Note 5), so they are transcribed as C here — the codec
 *    would otherwise demand a value that must be spaces; the ISF
 *    Submission Type is fixed at '1' ("Always code 1").
 *  - UNIFIED_SF20 (CR p.78/SE-76): only SBN / V1 / CR qualifiers exist
 *    (no 6B/6C/MB/FN as in the standalone chapter).
 *  - UNIFIED_SF30 (CR p.80/SE-78): Country Code and Date of Birth are
 *    printed M but "Space fill for Unified Entry/ISF filing" (→ C), and
 *    the identifier qualifiers are restricted to EI/ANI/CIN/34 (CN only)
 *    and FR (ST only) — no DUN/DNS/AEF (CR p.81 Note 2).
 *  - UNIFIED_SF35/SF36 (CR p.83-84/SE-81..82): the Address Information
 *    and city/postal fields are still printed 35AN/15AN (the standalone
 *    chapter's revision 1 upgraded them to X) — transcribed verbatim.
 *  - There are no SF13/SF15/SF40/SF50 records in the unified map: bills,
 *    HTS and country of origin are extracted from the Entry data
 *    (CR p.30/SE-28).
 */
import type { RecordDef } from '../records/codec.js';
import { assertRecordDef } from '../records/codec.js';

// ── SE input records ───────────────────────────────────────

/** SE Header — input SE10 (CR p.33-38, SE-31..36). */
export const SE10: RecordDef = {
  id: 'SE10',
  name: 'SeHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE10' },
    { name: 'actionCode', start: 5, end: 5, class: 'A', designation: 'M' }, // A/D/R/U (Note 1, CR p.34)
    { name: 'entryFilerCode', start: 6, end: 8, class: 'AN', designation: 'M' }, // must match B-record filer
    { name: 'filler', start: 9, end: 10, class: 'S', designation: 'M' }, // printed 2X, reserved for expansion
    { name: 'entryNumber', start: 11, end: 18, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 19, end: 19, class: 'S', designation: 'M' }, // printed 1X
    { name: 'entryType', start: 20, end: 21, class: 'AN', designation: 'M' }, // Note 2 (CR p.35)
    { name: 'importerOfRecordType', start: 22, end: 24, class: 'AN', designation: 'C' }, // EI/ANI/34 (Note 3)
    { name: 'importerOfRecord', start: 25, end: 36, class: 'X', designation: 'C' }, // Note 4 formats
    { name: 'modeOfTransportation', start: 37, end: 38, class: 'AN', designation: 'C' }, // Note 5; Note 11
    { name: 'bondType', start: 39, end: 39, class: 'N', designation: 'M' }, // 0/8/9 (Note 6)
    { name: 'estimatedEntryValue', start: 40, end: 49, class: 'N', designation: 'M' }, // whole USD (Note 13 caps)
    { name: 'plannedPortOfEntry', start: 50, end: 54, class: 'AN', designation: 'C' }, // Schedule D (Note 7)
    { name: 'splitShipmentReleaseCode', start: 55, end: 55, class: 'AN', designation: 'O' }, // 1/2 (Note 8)
    { name: 'portOfUnlading', start: 56, end: 60, class: 'AN', designation: 'C' }, // req. for MOT 50/60/70
    { name: 'filler3', start: 61, end: 80, class: 'S', designation: 'M' }, // printed 20X
  ],
};

/** SE Additional Header — input SE11 (CR p.39-43, SE-37..41). */
export const SE11: RecordDef = {
  id: 'SE11',
  name: 'SeAdditionalHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE11' },
    { name: 'entryDateElectionCode', start: 5, end: 5, class: 'X', designation: 'C' }, // W = Weekly (type 06 only)
    { name: 'electedEntryDate', start: 6, end: 11, class: 'N', designation: 'C' }, // MMDDYY (Note 1)
    { name: 'locationOfGoodsFirms', start: 12, end: 15, class: 'AN', designation: 'C' }, // Note 4
    { name: 'electedExamSiteFirms', start: 16, end: 19, class: 'AN', designation: 'O' }, // preferred CES
    { name: 'conveyanceNameOrFtzId', start: 20, end: 39, class: 'X', designation: 'C' }, // FTZ ID for type 06 (Note 6)
    { name: 'voyageFlightTripNumber', start: 40, end: 44, class: 'X', designation: 'C' }, // not for type 06 (Note 7)
    { name: 'generalOrderNumber', start: 45, end: 64, class: 'AN', designation: 'O' },
    { name: 'bondedWarehouseFirms', start: 65, end: 68, class: 'AN', designation: 'C' }, // types 21/22 (Note 2)
    { name: 'originatingWarehouseEntryFilerCode', start: 69, end: 71, class: 'AN', designation: 'C' }, // type 22 (Note 3)
    { name: 'originatingWarehouseEntryNumber', start: 72, end: 79, class: 'AN', designation: 'C' }, // type 22 (Note 3)
    { name: 'immediateDeliveryIndicator', start: 80, end: 80, class: 'X', designation: 'C' }, // Y/N (Notes 8/9)
  ],
};

/** Contact / Correction / Cancellation — input SE13 (CR p.44-45, SE-42..43). */
export const SE13: RecordDef = {
  id: 'SE13',
  name: 'SeContactCorrectionCancellation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE13' },
    { name: 'contactName', start: 5, end: 44, class: 'AN', designation: 'M' },
    { name: 'contactPhone', start: 45, end: 59, class: 'AN', designation: 'M' },
    // Printed class 2A, but every valid code (01-12, Note 1) is numeric —
    // transcribed as AN so the codec accepts the chapter's own values.
    { name: 'reasonCode', start: 60, end: 61, class: 'AN', designation: 'C' },
    { name: 'multipleCargoDispositionsIndicator', start: 62, end: 62, class: 'N', designation: 'O' }, // 1 = multiple
    { name: 'disIndicator', start: 63, end: 63, class: 'N', designation: 'O' }, // 1 = DIS submission (Note 2)
    { name: 'splitShipmentIndicator', start: 64, end: 64, class: 'N', designation: 'O' }, // 1 = split (Note 3)
    { name: 'filler', start: 65, end: 80, class: 'S', designation: 'M' }, // printed 16X
  ],
};

/** Bill of Lading information — input SE15 (CR p.46-52, SE-44..50). */
export const SE15: RecordDef = {
  id: 'SE15',
  name: 'SeBillOfLading',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE15' },
    { name: 'billTypeIndicator', start: 5, end: 5, class: 'A', designation: 'M' }, // R/M/H/T/I
    { name: 'billIssuerCode', start: 6, end: 9, class: 'AN', designation: 'C' }, // space for in-bond/air/32-34/50/60
    { name: 'billOfLadingNumber', start: 10, end: 59, class: 'X', designation: 'M' }, // no specials (desc.)
    { name: 'quantity', start: 60, end: 67, class: 'N', designation: 'C' }, // smallest exterior unit (Note 2)
    { name: 'filler', start: 68, end: 72, class: 'S', designation: 'M' }, // printed 5X
    { name: 'nonAmsIndicator', start: 73, end: 73, class: 'X', designation: 'M' }, // default N (Note 5)
    { name: 'filler2', start: 74, end: 80, class: 'S', designation: 'M' }, // printed 7X
  ],
};

/** Conveyance information — input SE16 (CR p.53-54, SE-51..52). */
export const SE16: RecordDef = {
  id: 'SE16',
  name: 'SeConveyance',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE16' },
    { name: 'carrierCode', start: 5, end: 8, class: 'AN', designation: 'M' },
    { name: 'voyageFlightTripNumber', start: 9, end: 13, class: 'X', designation: 'M' },
    { name: 'dateOfArrival', start: 14, end: 19, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'quantity', start: 20, end: 27, class: 'N', designation: 'M' }, // per split part (Note 1)
    { name: 'unitOfMeasure', start: 28, end: 32, class: 'X', designation: 'O' },
    { name: 'conveyanceName', start: 33, end: 52, class: 'X', designation: 'C' }, // pipeline name for MOT 70
    { name: 'filler', start: 53, end: 80, class: 'S', designation: 'M' }, // printed 28X
  ],
};

/** Equipment information — input SE17 (CR p.55, SE-53). */
export const SE17: RecordDef = {
  id: 'SE17',
  name: 'SeEquipment',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE17' },
    { name: 'equipmentNumber', start: 5, end: 24, class: 'AN', designation: 'M' }, // SCAC prefix + serial + check digit
    { name: 'filler', start: 25, end: 80, class: 'S', designation: 'M' }, // printed 56X
  ],
};

/** Reference information — input SE20 (CR p.56-57, SE-54..55). */
export const SE20: RecordDef = {
  id: 'SE20',
  name: 'SeReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE20' },
    { name: 'referenceIdentifierQualifier', start: 5, end: 7, class: 'AN', designation: 'M' }, // Note 1
    { name: 'referenceIdentifier', start: 8, end: 57, class: 'X', designation: 'M' }, // left justified (AMT rule)
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' }, // printed 23X
  ],
};

/** Header Entity Name and Type — input SE30 (CR p.58-60, SE-56..58). */
export const SE30: RecordDef = {
  id: 'SE30',
  name: 'SeHeaderEntity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE30' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // Note 1
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' },
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'C' }, // Note 3
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'C' },
    { name: 'filler', start: 66, end: 80, class: 'S', designation: 'M' }, // printed 15X
  ],
};

/** Header Entity GBI Identifier — input SE31 (CR p.61, SE-59; GBI Test only). */
export const SE31: RecordDef = {
  id: 'SE31',
  name: 'SeHeaderEntityGbi',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE31' },
    { name: 'gbiIdentifierQualifier', start: 5, end: 8, class: 'A', designation: 'M' }, // LEI/GLN/DUNS
    { name: 'gbiIdentifier', start: 9, end: 28, class: 'AN', designation: 'M' },
    { name: 'filler', start: 29, end: 80, class: 'S', designation: 'M' }, // printed 52X
  ],
};

/** Header Entity Street Address — input SE35 (CR p.62, SE-60). */
export const SE35: RecordDef = {
  id: 'SE35',
  name: 'SeHeaderEntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE35' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' }, // Note 1
    { name: 'addressInformation1', start: 7, end: 41, class: 'X', designation: 'M' },
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    { name: 'addressInformation2', start: 44, end: 78, class: 'X', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' }, // printed 2X
  ],
};

/** Header Entity City and Country — input SE36 (CR p.63, SE-61). */
export const SE36: RecordDef = {
  id: 'SE36',
  name: 'SeHeaderEntityGeo',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE36' },
    { name: 'cityName', start: 5, end: 39, class: 'X', designation: 'M' },
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'O' }, // ISO subdivision (opt. rev 35)
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' }, // printed 6X
    { name: 'postalCode', start: 49, end: 63, class: 'X', designation: 'C' },
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' }, // ISO country
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' }, // printed 15X
  ],
};

/** Line Item — input SE40 (CR p.64, SE-62). Once per SE Line Grouping. */
export const SE40: RecordDef = {
  id: 'SE40',
  name: 'SeLineItem',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE40' },
    { name: 'lineItemIdentifier', start: 5, end: 7, class: 'N', designation: 'M' }, // 001, incremented
    { name: 'countryOfOrigin', start: 8, end: 9, class: 'A', designation: 'M' }, // ISO
    { name: 'filler', start: 10, end: 10, class: 'S', designation: 'M' }, // printed 1AN "Space fill"
    { name: 'commercialInvoiceDescription', start: 11, end: 80, class: 'X', designation: 'O' },
  ],
};

/** FTZ Status & Unit Quantity — input SE41 (CR p.65-66, SE-63..64). Type 06 only, mandatory per line. */
export const SE41: RecordDef = {
  id: 'SE41',
  name: 'SeFtzStatus',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE41' },
    { name: 'zoneStatus', start: 5, end: 5, class: 'A', designation: 'M' }, // P/N (D/Z not on type 06 consumption)
    { name: 'privilegedFilingDate', start: 6, end: 11, class: 'N', designation: 'C' }, // MMDDYY; PF + inactive HTS only (Note 2)
    { name: 'ftzLineItemQuantity', start: 12, end: 19, class: 'N', designation: 'M' }, // whole number > 0
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' }, // printed 61X
  ],
};

/** Line Entity Name and Type — input SE50 (CR p.67-69, SE-65..67). */
export const SE50: RecordDef = {
  id: 'SE50',
  name: 'SeLineEntity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE50' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // Note 1 (no BKP at line level)
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' },
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'O' }, // Note 3
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'O' },
    { name: 'filler', start: 66, end: 80, class: 'S', designation: 'M' }, // printed 15X
  ],
};

/** Line Entity GBI Identifier — input SE51 (CR p.70, SE-68; GBI Test only). */
export const SE51: RecordDef = {
  id: 'SE51',
  name: 'SeLineEntityGbi',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE51' },
    { name: 'gbiIdentifierQualifier', start: 5, end: 8, class: 'A', designation: 'M' }, // LEI/GLN/DUNS
    { name: 'gbiIdentifier', start: 9, end: 28, class: 'AN', designation: 'M' },
    { name: 'filler', start: 29, end: 80, class: 'S', designation: 'M' }, // printed 52X
  ],
};

/** Line Entity Street Address — input SE55 (CR p.71, SE-69). */
export const SE55: RecordDef = {
  id: 'SE55',
  name: 'SeLineEntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE55' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' },
    { name: 'addressInformation1', start: 7, end: 41, class: 'X', designation: 'M' },
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    { name: 'addressInformation2', start: 44, end: 78, class: 'X', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' }, // printed 2X
  ],
};

/** Line Entity City and Country — input SE56 (CR p.72, SE-70). */
export const SE56: RecordDef = {
  id: 'SE56',
  name: 'SeLineEntityGeo',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE56' },
    { name: 'cityName', start: 5, end: 39, class: 'X', designation: 'M' },
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'O' },
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' }, // printed 6X
    { name: 'postalCode', start: 49, end: 63, class: 'X', designation: 'C' },
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' },
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' }, // printed 15X
  ],
};

/** Harmonized Tariff Schedule — input SE60 (CR p.73, SE-71). Max 32 per line since v40. */
export const SE60: RecordDef = {
  id: 'SE60',
  name: 'SeHts',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE60' },
    { name: 'htsNumber', start: 5, end: 14, class: 'AN', designation: 'M' }, // Notes 1 (TIB pairs) / 2 (ch.99 order)
    { name: 'lineItemValue', start: 15, end: 24, class: 'N', designation: 'C' }, // whole USD (Note 3)
    { name: 'filler', start: 25, end: 80, class: 'S', designation: 'M' }, // printed 56X
  ],
};

/** FTZ Privileged Foreign Status Add'l Detail — input SE61 (CR p.74, SE-72). */
export const SE61: RecordDef = {
  id: 'SE61',
  name: 'SeFtzPfDetail',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE61' },
    { name: 'currentHtsNumber', start: 5, end: 14, class: 'AN', designation: 'M' }, // current HTS for PGA flagging
    { name: 'filler', start: 15, end: 80, class: 'S', designation: 'M' }, // printed 66X
  ],
};

// ── Unified Entry/ISF SF records (CR p.30/32, SE-28/30) ────

/** Unified ISF Header — input SF10 (CR p.75-77, SE-73..75). */
export const UNIFIED_SF10: RecordDef = {
  id: 'SF10',
  name: 'UnifiedSfHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF10' },
    { name: 'isfSubmissionType', start: 5, end: 5, class: 'N', designation: 'M', constant: '1' }, // "Always code 1"
    { name: 'shipmentTypeCode', start: 6, end: 7, class: 'N', designation: 'M' }, // Note 2 (01/02/04/07/09/10)
    { name: 'actionCode', start: 8, end: 8, class: 'A', designation: 'M' }, // A/D/R (Note 3)
    { name: 'actionReasonCode', start: 9, end: 10, class: 'X', designation: 'C' }, // CT for A/R (Note 3)
    { name: 'isfImporterNumberQualifier', start: 11, end: 13, class: 'X', designation: 'M' }, // EI/ANI/34 (Note 4)
    { name: 'isfImporterNumber', start: 14, end: 28, class: 'X', designation: 'M' }, // must equal SE10 IOR (Note 4)
    { name: 'filler', start: 29, end: 36, class: 'S', designation: 'M' }, // printed "Reserved 8X M Space fill"
    { name: 'modeOfTransportationCode', start: 37, end: 38, class: 'N', designation: 'O' }, // 10/11
    { name: 'isfTransactionNumber', start: 39, end: 53, class: 'X', designation: 'C' }, // space filled on Add
    { name: 'scacIdentifier', start: 54, end: 57, class: 'A', designation: 'O' },
    // The next four are printed M with "Space fill for Unified Entry/ISF
    // filing" (bond data comes from the Entry, CR p.77 Note 5) → C here.
    { name: 'bondHolder', start: 58, end: 72, class: 'X', designation: 'C' },
    { name: 'bondActivityCode', start: 73, end: 74, class: 'AN', designation: 'C' },
    { name: 'bondType', start: 75, end: 75, class: 'N', designation: 'C' },
    { name: 'filler2', start: 76, end: 78, class: 'S', designation: 'M' }, // printed 3X
    { name: 'countryOfIssuance', start: 79, end: 80, class: 'A', designation: 'C' }, // printed M, space fill unified
  ],
};

/** Unified ISF Reference — input SF20 (CR p.78, SE-76). SBN/V1/CR only. */
export const UNIFIED_SF20: RecordDef = {
  id: 'SF20',
  name: 'UnifiedSfReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF20' },
    { name: 'referenceIdentifierQualifier', start: 5, end: 7, class: 'AN', designation: 'M' }, // Note 1
    { name: 'referenceIdentifier', start: 8, end: 57, class: 'X', designation: 'M' }, // printed 50x, no specials
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' }, // printed 23X
  ],
};

/** Unified ISF Container — input SF25 (CR p.79, SE-77). */
export const UNIFIED_SF25: RecordDef = {
  id: 'SF25',
  name: 'UnifiedSfContainer',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF25' },
    { name: 'equipmentDescriptionCode', start: 5, end: 6, class: 'X', designation: 'M' },
    { name: 'equipmentInitial', start: 7, end: 10, class: 'A', designation: 'M' },
    { name: 'equipmentNumber', start: 11, end: 25, class: 'N', designation: 'M' }, // 15N; builder zero-pads
    { name: 'equipmentNumberCheckDigit', start: 26, end: 26, class: 'N', designation: 'C' },
    { name: 'equipmentSizeTypeCode', start: 27, end: 30, class: 'AN', designation: 'O' },
    { name: 'filler', start: 31, end: 80, class: 'S', designation: 'M' }, // printed 50X
  ],
};

/** Unified ISF Entity Name and Type — input SF30 (CR p.80-81, SE-78..79). */
export const UNIFIED_SF30: RecordDef = {
  id: 'SF30',
  name: 'UnifiedSfEntity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF30' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // Note 1 (no IM: CBP creates it)
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'C' }, // blank when identifier used
    { name: 'entityIdentifierQualifier', start: 43, end: 45, class: 'X', designation: 'C' }, // Note 2
    { name: 'entityIdentifier', start: 46, end: 65, class: 'X', designation: 'C' },
    // Printed M with "Space fill for Unified Entry/ISF filing" → C.
    { name: 'countryCode', start: 66, end: 67, class: 'AN', designation: 'C' },
    { name: 'dateOfBirth', start: 68, end: 75, class: 'X', designation: 'C' },
    { name: 'filler', start: 76, end: 80, class: 'S', designation: 'M' }, // printed 5X
  ],
};

/** Unified ISF Entity Secondary Name — input SF31 (CR p.82, SE-80). */
export const UNIFIED_SF31: RecordDef = {
  id: 'SF31',
  name: 'UnifiedSfEntitySecondaryName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF31' },
    { name: 'entityCode', start: 5, end: 7, class: 'A', designation: 'M' }, // ALA/DH/DV/NU/NV/XD (Note 1)
    { name: 'entityName', start: 8, end: 42, class: 'X', designation: 'M' },
    { name: 'filler', start: 43, end: 80, class: 'S', designation: 'M' }, // printed 38X
  ],
};

/** Unified ISF Entity Address — input SF35 (CR p.83, SE-81). Info fields printed 35AN. */
export const UNIFIED_SF35: RecordDef = {
  id: 'SF35',
  name: 'UnifiedSfEntityAddress',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF35' },
    { name: 'addressComponentQualifier1', start: 5, end: 6, class: 'AN', designation: 'M' }, // Note 1
    { name: 'addressInformation1', start: 7, end: 41, class: 'AN', designation: 'M' }, // 35AN verbatim (see header)
    { name: 'addressComponentQualifier2', start: 42, end: 43, class: 'AN', designation: 'O' },
    { name: 'addressInformation2', start: 44, end: 78, class: 'AN', designation: 'O' },
    { name: 'filler', start: 79, end: 80, class: 'S', designation: 'M' }, // printed 2X
  ],
};

/** Unified ISF Entity Geographic Area — input SF36 (CR p.84, SE-82). */
export const UNIFIED_SF36: RecordDef = {
  id: 'SF36',
  name: 'UnifiedSfEntityGeo',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SF36' },
    { name: 'cityName', start: 5, end: 39, class: 'AN', designation: 'M' }, // 35AN verbatim
    { name: 'countrySubEntityCode', start: 40, end: 42, class: 'AN', designation: 'C' },
    { name: 'filler', start: 43, end: 48, class: 'S', designation: 'M' }, // printed 6X
    { name: 'postalCode', start: 49, end: 63, class: 'AN', designation: 'C' }, // 15AN verbatim
    { name: 'countryCode', start: 64, end: 65, class: 'A', designation: 'M' },
    { name: 'filler2', start: 66, end: 80, class: 'S', designation: 'M' }, // printed 15X
  ],
};

// ── SX output record ───────────────────────────────────────

/** Error / Disposition — output SE90 (CR p.85, SE-83). */
export const SE90: RecordDef = {
  id: 'SE90',
  name: 'SeErrorOrDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SE90' },
    { name: 'messageTypeCode', start: 5, end: 6, class: 'AN', designation: 'M' }, // 01-04 message-level; 11/13 record-level
    { name: 'messageIdentifierCode', start: 7, end: 9, class: 'AN', designation: 'C' }, // Cargo Release Condition Codes
    { name: 'narrativeMessageText', start: 10, end: 49, class: 'X', designation: 'M' },
    { name: 'filler', start: 50, end: 80, class: 'S', designation: 'M' }, // printed 31X
  ],
};

// ── SO status-notification records (output only) ───────────

/** ACE Cargo Release Status Header — output SO10 (SO p.21-22, SO-31..32). */
export const SO10: RecordDef = {
  id: 'SO10',
  name: 'SoStatusHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO10' },
    { name: 'districtPortOfEntry', start: 5, end: 8, class: 'N', designation: 'C' },
    { name: 'entryFilerCode', start: 9, end: 11, class: 'AN', designation: 'M' },
    { name: 'filler', start: 12, end: 13, class: 'S', designation: 'M' }, // printed 2X
    { name: 'entryNumber', start: 14, end: 21, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 22, end: 22, class: 'S', designation: 'M' }, // printed 1X
    { name: 'entryTypeCode', start: 23, end: 24, class: 'N', designation: 'M' },
    { name: 'importerOfRecordNumber', start: 25, end: 36, class: 'X', designation: 'M' }, // Note 1
    { name: 'carrierCode', start: 37, end: 40, class: 'AN', designation: 'C' },
    { name: 'vesselName', start: 41, end: 60, class: 'AN', designation: 'C' },
    { name: 'voyageFlightTripNumber', start: 61, end: 65, class: 'X', designation: 'C' }, // Note 2
    { name: 'estimatedDateOfArrival', start: 66, end: 71, class: 'N', designation: 'C' }, // MMDDYY
    { name: 'splitShipmentReleaseCode', start: 72, end: 72, class: 'AN', designation: 'O' },
    { name: 'correctionResponseIndicator', start: 73, end: 73, class: 'X', designation: 'C' }, // 'P' = PGA CA response
    { name: 'filler3', start: 74, end: 80, class: 'S', designation: 'M' }, // printed 7X
  ],
};

/** Reference Information — output SO20 (SO p.23-24, SO-33..34). */
export const SO20: RecordDef = {
  id: 'SO20',
  name: 'SoReference',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO20' },
    { name: 'referenceIdentifierQualifier', start: 5, end: 7, class: 'AN', designation: 'M' }, // CR/RSN/CMT/RRN
    { name: 'referenceIdentifier', start: 8, end: 57, class: 'X', designation: 'M' },
    { name: 'filler', start: 58, end: 80, class: 'S', designation: 'M' }, // printed 23X
  ],
};

/** Line Item Information — output SO30 (SO p.25, SO-35). */
export const SO30: RecordDef = {
  id: 'SO30',
  name: 'SoLineItem',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO30' },
    { name: 'lineItemIdentifier', start: 5, end: 7, class: 'N', designation: 'M' }, // echoes input SE40
    { name: 'countryOfOrigin', start: 8, end: 9, class: 'A', designation: 'M' },
    { name: 'htsNumber', start: 10, end: 19, class: 'AN', designation: 'M' },
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' }, // printed 61X
  ],
};

/** Bill of Lading Information — output SO40 (SO p.26, SO-36). Max use 2 (M+H). */
export const SO40: RecordDef = {
  id: 'SO40',
  name: 'SoBillOfLading',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO40' },
    { name: 'billTypeIndicator', start: 5, end: 5, class: 'A', designation: 'M' }, // R/M/H/S(future)/T
    { name: 'billIssuerCode', start: 6, end: 9, class: 'AN', designation: 'C' }, // space for Air
    { name: 'billOfLadingNumber', start: 10, end: 59, class: 'X', designation: 'M' },
    { name: 'quantity', start: 60, end: 67, class: 'N', designation: 'C' }, // Note 1 (split = boarded qty)
    { name: 'unitOfMeasure', start: 68, end: 72, class: 'X', designation: 'C' },
    { name: 'manifestedQuantity', start: 73, end: 80, class: 'X', designation: 'C' }, // printed 8X
  ],
};

/** In-bond Information — output SO42 (SO p.27, SO-37). */
export const SO42: RecordDef = {
  id: 'SO42',
  name: 'SoInBond',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO42' },
    { name: 'inBondNumber', start: 5, end: 16, class: 'AN', designation: 'M' },
    { name: 'inBondEntryType', start: 17, end: 18, class: 'N', designation: 'M' },
    { name: 'portOfInBondDeparture', start: 19, end: 22, class: 'N', designation: 'M' }, // Schedule D
    { name: 'portOfInBondArrival', start: 23, end: 26, class: 'N', designation: 'M' }, // Schedule D
    { name: 'inBondCreateDate', start: 27, end: 32, class: 'N', designation: 'M' }, // MMDDYY (rev 23 rename)
    { name: 'dateOfInBondArrival', start: 33, end: 38, class: 'N', designation: 'C' }, // MMDDYY
    { name: 'inBondQuantity', start: 39, end: 46, class: 'N', designation: 'C' }, // < full bill qty only
    { name: 'filler', start: 47, end: 80, class: 'S', designation: 'M' }, // printed 34X
  ],
};

/** Bill Match Disposition — output SO50 (SO p.28-29, SO-38..39). Once per SO40 bill. */
export const SO50: RecordDef = {
  id: 'SO50',
  name: 'SoBillMatchDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO50' },
    { name: 'dispositionDate', start: 5, end: 10, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'dispositionTime', start: 11, end: 14, class: 'N', designation: 'M' }, // HHMM
    { name: 'dispositionCode', start: 15, end: 16, class: 'AN', designation: 'M' }, // Note 1
    { name: 'narrativeMessage', start: 17, end: 56, class: 'X', designation: 'M' },
    { name: 'splitIndicator', start: 57, end: 57, class: 'A', designation: 'M' }, // Y/N
    { name: 'carrierCode', start: 58, end: 61, class: 'AN', designation: 'C' }, // split/partial only (Note 2)
    { name: 'voyageFlightTripNumber', start: 62, end: 66, class: 'X', designation: 'C' },
    { name: 'dateOfArrival', start: 67, end: 72, class: 'N', designation: 'C' }, // MMDDYY
    { name: 'districtPortOfArrival', start: 73, end: 76, class: 'N', designation: 'C' },
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' }, // printed 4X
  ],
};

/** Cargo Release Processing Disposition — output SO60 (SO p.30-32, SO-40..42). */
export const SO60: RecordDef = {
  id: 'SO60',
  name: 'SoReleaseDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO60' },
    { name: 'dispositionActionDate', start: 5, end: 10, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'dispositionActionTime', start: 11, end: 14, class: 'N', designation: 'M' }, // HHMM
    { name: 'dispositionActionCode', start: 15, end: 16, class: 'AN', designation: 'M' }, // Note 1
    { name: 'narrativeMessage', start: 17, end: 56, class: 'X', designation: 'M' },
    { name: 'releaseDate', start: 57, end: 62, class: 'N', designation: 'C' }, // only on codes 22/98
    { name: 'releaseOriginCode', start: 63, end: 64, class: 'N', designation: 'C' }, // only on 22/98 (Note 2)
    { name: 'documentType', start: 65, end: 70, class: 'AN', designation: 'C' }, // DIS guide (Note 3)
    { name: 'filler', start: 71, end: 80, class: 'S', designation: 'M' }, // printed 10AN "Space fill"
  ],
};

/**
 * PGA Processing Disposition — output SO70 (SO p.33-35, SO-43..45).
 *
 * The printed rev-36 layout carries the PGA Processing Group Version 04
 * sizes for the line-range fields (Beginning/Ending CBP Line 3N,
 * Beginning/Ending Tariff Position 2N — SO p.35 Note 7). Records whose
 * version field (pos 79-80) is space/01/02/03 use the pre-04 sizes
 * (CBP Line 4N, Tariff Position 1N) at the same overall span 57-72 —
 * see SO70_PRE04 and the version-aware parsing in responseParser.ts.
 */
export const SO70: RecordDef = {
  id: 'SO70',
  name: 'SoPgaDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO70' },
    { name: 'governmentAgencyCode', start: 5, end: 7, class: 'AN', designation: 'M' }, // Appendix V
    { name: 'governmentAgencyProgramCode', start: 8, end: 10, class: 'AN', designation: 'C' }, // Appendix PGA
    { name: 'statusActionDate', start: 11, end: 16, class: 'N', designation: 'C' }, // MMDDYY
    { name: 'statusActionTime', start: 17, end: 20, class: 'N', designation: 'C' }, // HHMM (Note 8: use latest)
    { name: 'entryLevelStatusCode', start: 21, end: 22, class: 'AN', designation: 'C' }, // Note 1
    { name: 'entryLevelStatusMessage', start: 23, end: 50, class: 'X', designation: 'C' }, // 28X
    { name: 'entryLineLevelStatusCode', start: 51, end: 52, class: 'AN', designation: 'C' }, // FUTURE USE
    { name: 'lineLevelStatusCode', start: 53, end: 54, class: 'AN', designation: 'C' }, // Note 2
    { name: 'statusReasonCode', start: 55, end: 56, class: 'AN', designation: 'C' }, // Note 3
    { name: 'beginningCbpLine', start: 57, end: 59, class: 'N', designation: 'C' },
    { name: 'beginningTariffPosition', start: 60, end: 61, class: 'N', designation: 'C' }, // Note 4
    { name: 'beginningPgaLine', start: 62, end: 64, class: 'N', designation: 'C' }, // '000' possible (Note 9)
    { name: 'endingCbpLine', start: 65, end: 67, class: 'N', designation: 'C' },
    // The Ending Tariff Position row's designation column is blank in the
    // print — transcribed as C to match its Beginning counterpart.
    { name: 'endingTariffPosition', start: 68, end: 69, class: 'N', designation: 'C' },
    { name: 'endingPgaLine', start: 70, end: 72, class: 'N', designation: 'C' },
    { name: 'documentTypeCode', start: 73, end: 77, class: 'AN', designation: 'C' }, // Note 5
    { name: 'pgaEntryHoldType', start: 78, end: 78, class: 'X', designation: 'C' }, // 1/2 (Note 6)
    { name: 'pgaProcessingGroupVersion', start: 79, end: 80, class: 'N', designation: 'C' }, // Note 7
  ],
};

/**
 * SO70 with the pre-version-04 line-range field sizes (Beginning/Ending
 * CBP Line 4N, Beginning/Ending Tariff Position 1N — SO p.35 Note 7 and
 * the rev-11/rev-36 change log). Used to parse records whose PGA
 * Processing Group Version is space/01/02/03, including the chapter's own
 * printed Note-8 examples (SO p.35).
 */
export const SO70_PRE04: RecordDef = {
  id: 'SO70',
  name: 'SoPgaDispositionLegacy',
  fields: [
    ...SO70.fields.slice(0, 10),
    { name: 'beginningCbpLine', start: 57, end: 60, class: 'N', designation: 'C' },
    { name: 'beginningTariffPosition', start: 61, end: 61, class: 'N', designation: 'C' },
    { name: 'beginningPgaLine', start: 62, end: 64, class: 'N', designation: 'C' },
    { name: 'endingCbpLine', start: 65, end: 68, class: 'N', designation: 'C' },
    { name: 'endingTariffPosition', start: 69, end: 69, class: 'N', designation: 'C' },
    { name: 'endingPgaLine', start: 70, end: 72, class: 'N', designation: 'C' },
    ...SO70.fields.slice(16),
  ],
};

/** Additional PGA Processing Disposition — output SO71 (SO p.36-37, SO-46..47). */
export const SO71: RecordDef = {
  id: 'SO71',
  name: 'SoPgaAdditional',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO71' },
    { name: 'referenceQualifier1', start: 5, end: 6, class: 'AN', designation: 'C' }, // Note 1
    { name: 'referenceNumber1', start: 7, end: 18, class: 'X', designation: 'C' }, // e.g. FDA PN confirmation (Note 2)
    { name: 'receiptDate', start: 19, end: 24, class: 'N', designation: 'C' }, // MMDDYY (Note 3)
    { name: 'receiptTime', start: 25, end: 30, class: 'N', designation: 'C' }, // HHMMSS (Note 3)
    // Ten PGA Line Sub Reason Code slots (Note 4).
    { name: 'subReasonCode1', start: 31, end: 33, class: 'AN', designation: 'C' },
    { name: 'subReasonCode2', start: 34, end: 36, class: 'AN', designation: 'C' },
    { name: 'subReasonCode3', start: 37, end: 39, class: 'AN', designation: 'C' },
    { name: 'subReasonCode4', start: 40, end: 42, class: 'AN', designation: 'C' },
    { name: 'subReasonCode5', start: 43, end: 45, class: 'AN', designation: 'C' },
    { name: 'subReasonCode6', start: 46, end: 48, class: 'AN', designation: 'C' },
    { name: 'subReasonCode7', start: 49, end: 51, class: 'AN', designation: 'C' },
    { name: 'subReasonCode8', start: 52, end: 54, class: 'AN', designation: 'C' },
    { name: 'subReasonCode9', start: 55, end: 57, class: 'AN', designation: 'C' },
    { name: 'subReasonCode10', start: 58, end: 60, class: 'AN', designation: 'C' },
    // Second reference pair, added in PGA Processing Group version 03 for
    // identifiers longer than 12X (e.g. FWS eDEC — SO p.35 Note 7).
    { name: 'referenceQualifier2', start: 61, end: 62, class: 'AN', designation: 'C' },
    { name: 'referenceNumber2', start: 63, end: 80, class: 'X', designation: 'C' },
  ],
};

/** Comments to Trade from PGA — output SO72 (SO p.38, SO-48). */
export const SO72: RecordDef = {
  id: 'SO72',
  name: 'SoPgaComments',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO72' },
    { name: 'commentsToTrade', start: 5, end: 80, class: 'X', designation: 'M' }, // 76X
  ],
};

for (const def of [
  SE10, SE11, SE13, SE15, SE16, SE17, SE20, SE30, SE31, SE35, SE36,
  SE40, SE41, SE50, SE51, SE55, SE56, SE60, SE61,
  UNIFIED_SF10, UNIFIED_SF20, UNIFIED_SF25, UNIFIED_SF30, UNIFIED_SF31, UNIFIED_SF35, UNIFIED_SF36,
  SE90,
  SO10, SO20, SO30, SO40, SO42, SO50, SO60, SO70, SO70_PRE04, SO71, SO72,
]) {
  assertRecordDef(def);
}

// ── Code tables ────────────────────────────────────────────

/** SE10 Action Codes — Note 1 (CR p.34, SE-32). */
export const SE_ACTION_CODES: Record<string, string> = {
  A: 'Add',
  D: 'Cancel',
  R: 'Replace',
  U: 'Update', // only SE10/SE11/SE13/SE15/SE16/SE17/SE20 may be reported (CR p.35)
};

/** Valid Entry Type codes — SE10 Note 2 (CR p.35, SE-33). */
export const SE_ENTRY_TYPES: Record<string, string> = {
  '01': 'Consumption – Free and Dutiable',
  '02': 'Consumption – Quota/Visa',
  '03': 'Consumption – Antidumping/Countervailing Duty',
  '06': 'Consumption – Foreign Trade Zone (FTZ)',
  '07': 'Consumption – AD/CVD & Quota/Visa Combination',
  '11': 'Informal – Free and Dutiable',
  '12': 'Informal – Quota/Visa (other than textiles)',
  '21': 'Warehouse',
  '22': 'Re-Warehouse',
  '23': 'Temporary Importation Bond (TIB)',
  '52': 'Government Dutiable',
  '86': 'Section 321',
};

/** Importer of Record Type qualifiers — SE10 Note 3 (CR p.35, SE-33). */
export const SE_IMPORTER_OF_RECORD_TYPES: Record<string, string> = {
  EI: 'Employer Identification Number (IRS #)',
  ANI: 'CBP-assigned Number',
  '34': 'Social Security Number',
};

/** Mode of Transportation codes — SE10 Note 5 (CR p.36, SE-34). */
export const SE_MOT_CODES: Record<string, string> = {
  '10': 'Vessel, Non-container',
  '11': 'Vessel, Container',
  '12': 'Border Water-borne (only Mexico and Canada)',
  '20': 'Rail, Non-container',
  '21': 'Rail, Container',
  '30': 'Truck, Non-container',
  '31': 'Truck, Container',
  '32': 'Auto',
  '33': 'Pedestrian',
  '34': 'Road, other. Includes foot and animal-borne.',
  '40': 'Air, Non-container',
  '41': 'Air, Container',
  '50': 'Mail',
  '60': 'Passenger, Hand Carried',
  '70': 'Fixed Transport Installations. Includes pipeline and powerhouse.',
};

/** Bond Type codes — SE10 Note 6 (CR p.36, SE-34). Type 9 requires SE20 V1 + AMT. */
export const BOND_TYPES: Record<string, string> = {
  '0': 'No bond required',
  '8': 'Continuous bond',
  '9': 'Single transaction bond',
};

/** Split Shipment Release codes — SE10 Note 8 (CR p.37, SE-35). */
export const SPLIT_SHIPMENT_RELEASE_CODES: Record<string, string> = {
  '1': 'Hold All – release entry when all cargo qualifies for release',
  '2': 'Incremental release under Immediate Delivery (special permit)',
};

/** SE13 Cancellation request reason codes — Note 1 (CR p.44, SE-42). */
export const CANCELLATION_REASON_CODES: Record<string, string> = {
  '01': 'Clerical error',
  '02': 'Entry replaced by CBPF 7512 (replacement In-Bond Number required in SE20 record)',
  '03': 'Merchandise cleared under another entry (replacement Entry Number required in SE20 record)',
  '04': 'Entry replaced by FTZ Admission (replacement FTZ Admission Number required in SE20 record)',
  '05': 'Merchandise cleared under informal entry',
  '06': 'Merchandise seized',
  '07': 'Merchandise destroyed',
  '08': 'Non-arrival',
  '09': 'Shipment refused by importer',
  '10': 'Shipment not authorized for import',
  '11': 'System error',
  '12': 'No Foreign status goods removed from FTZ (Entry Type 06 Weekly ONLY)',
};

/** SE15 Bill Type Indicators (CR p.46, SE-44). */
export const BILL_TYPE_INDICATORS: Record<string, string> = {
  R: 'Regular / Simple Bill of Lading (Rail/Truck/Pipeline/Mail/Hand-Carried/MOT 32-34)',
  M: 'Master Bill of Lading',
  H: 'House Bill of Lading',
  T: 'Express Carrier Tracking Number (air only; never Non-AMS; not for type 86)',
  I: 'In-bond number (no quantity; Non-AMS N; follow with R or M+H)',
};

/**
 * SE20 Reference Identifier Qualifier codes with per-qualifier rules —
 * Note 1 (CR p.56-57, SE-54..55).
 */
export const SE20_REFERENCE_QUALIFIERS: Record<string, { description: string; format: string; rule: string }> = {
  CR: {
    description: 'Filer-defined Reference Number',
    format: '9X',
    rule: 'Optional; returned in the SO response messages.',
  },
  EN: {
    description: 'Replacement Entry Number',
    format: '11AN (FFFNNNNNNNN, no hyphens)',
    rule: 'Required with cancellation reason code 03 (merchandise cleared under another entry).',
  },
  IB: {
    description: 'Replacement In-bond Number',
    format: '11AN (NNNNNNNNN | NNNNNNNNNNN | XXXNNNNNNNN)',
    rule: 'Required with cancellation reason code 02 (entry replaced by CBPF 7512).',
  },
  FTZ: {
    description: 'Replacement FTZ Admission Number',
    format: '19AN',
    rule: 'Required with cancellation reason code 04 (entry replaced by FTZ Admission).',
  },
  DIS: {
    description: 'Filer-defined DIS Reference Number',
    format: '50X',
    rule: "Required when the SE13 DIS indicator is '1'; unique per entry number.",
  },
  V1: {
    description: 'Surety Code',
    format: '3AN',
    rule: 'Required for Bond Type 9.',
  },
  AMT: {
    description: 'Bond amount',
    format: '10N',
    rule: 'Required for Bond Type 9. Left-justified, numeric only, no leading zeroes, no commas or decimals, greater than zero (e.g. SE20AMT90000).',
  },
  EXP: {
    description: 'Express Consignment Shipment',
    format: "'Y'",
    rule: 'Always Y; only for entry processing in an established express consignment CBP sub-port.',
  },
  KII: {
    description: 'Known Importer Indicator',
    format: "'Y'",
    rule: 'Always Y; indicates the SE10 Importer of Record is a Known Importer (CSMS #15-000275).',
  },
  RRN: {
    description: 'Rail Reference Number',
    format: '50X',
    rule: 'Optional rail-carrier-assigned number; returned in the SO response messages.',
  },
  PER: {
    description: 'Perishable Goods Indicator',
    format: "'Y'",
    rule: 'Always Y; optional, no effect on system processing.',
  },
  CES: {
    description: 'Consolidated Entry Summary Number',
    format: '11AN',
    rule: 'Optional; indicates an associated Consolidated Entry Summary is on file.',
  },
  EDA: {
    description: 'Estimated Date of Arrival',
    format: '6N (MMDDYY)',
    rule: 'Required for Type 86 entries.',
  },
};

/** SE30/SE50 Entity Codes — Note 1 (CR p.59/68, SE-57/66). BKP is header-level only. */
export const SE_ENTITY_CODES: Record<string, string> = {
  MF: 'Manufacturer/Supplier',
  SE: 'Selling Party',
  BY: 'Buying Party',
  ST: 'Ship To Party',
  LG: 'Scheduled Container Stuffing Location',
  CS: 'Consolidator',
  CN: 'Consignee',
  BKP: 'Booking Party',
  // Additional Global Business Identifier (GBI) Test Entity Codes
  SH: 'Shipper (GBI Test)',
  EX: 'Exporter (GBI Test)',
  DR: 'Distributor (GBI Test)',
  PK: 'Packager (GBI Test)',
};

/** SE30/SE50 Entity Identifier Qualifiers — Note 3 (CR p.60/69). BY/ST/CN only. */
export const SE_ENTITY_IDENTIFIER_QUALIFIERS: Record<string, { description: string; format: string }> = {
  EI: { description: 'Employer Identification Number (IRS #)', format: 'NN-NNNNNNNXX' },
  ANI: { description: 'CBP-assigned Number', format: 'YYDDPP-NNNNN' },
  '34': { description: 'Social Security Number', format: 'NNN-NN-NNNN' },
};

/** SE31/SE51 GBI Identifier Qualifiers — Note 1 (CR p.61/70). */
export const GBI_IDENTIFIER_QUALIFIERS: Record<string, string> = {
  LEI: 'GLEIF',
  GLN: 'GS1',
  DUNS: 'Dun & Bradstreet',
};

/** SE35/SE55 Address Component Qualifiers — Note 1 (CR p.62/71). */
export const SE_ADDRESS_COMPONENT_QUALIFIERS: Record<string, string> = {
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

/** SE41 Zone Status codes (CR p.65, SE-63). D/Z not usable on type 06 consumption entries. */
export const FTZ_ZONE_STATUS_CODES: Record<string, string> = {
  P: 'Privileged Foreign',
  N: 'Non-privileged Foreign',
  D: 'Domestic (not used on type 06 consumption entries)',
  Z: 'Zone restricted (not used on type 06 consumption entries)',
};

/** Unified ISF SF10 Shipment Type codes — Note 2 (CR p.76, SE-74). */
export const UNIFIED_ISF_SHIPMENT_TYPES: Record<string, string> = {
  '01': 'Standard or regular filings',
  '02': 'To Order Shipments',
  '04': 'Military, Government',
  '07': 'US Goods Returned',
  '09': 'International Mail Shipments',
  '10': 'Outer Continental Shelf Shipments',
};

/** Unified ISF SF20 Reference Qualifiers — Note 1 (CR p.78, SE-76). */
export const UNIFIED_SF20_REFERENCE_QUALIFIERS: Record<string, string> = {
  SBN: 'Bond Reference Number (NOT the bond number); required with bond activity 16 + type 9',
  V1: 'Surety Code; required with bond activity 16 + type 9',
  CR: 'User-defined Reference Number; returned in SN and SA',
};

/** SE90 message types (CR p.85, SE-83). 01-04 message-level, 11/13 record-level. */
export const SE90_MESSAGE_TYPES: Record<string, string> = {
  '01': 'Message Rejected',
  '02': 'Message Accepted',
  '03': 'Message Accepted with Warning(s)',
  '04': 'Message Referred to Human Review',
  '11': 'Record Rejected',
  '13': 'Record Accepted with a Warning',
};

/** SO20 Reference Identifier Qualifiers — Note 1 (SO p.23, SO-33). */
export const SO20_REFERENCE_QUALIFIERS: Record<string, string> = {
  CR: 'Filer-defined Reference Number (echoed from the SE input)',
  RSN: 'Reason Code provided by CBP for the rejection of a correction / cancellation request',
  CMT: 'Comments provided by CBP for the rejection of a correction / cancellation request',
  RRN: 'Rail Reference Number (echoed from the SE input)',
};

/** SO20 RSN Reason Codes — Note 2 (SO p.24, SO-34). */
export const SO20_RSN_REASON_CODES: Record<string, string> = {
  '1': 'Provided replacement entry is in cancelled status.',
  '2': 'Provided replacement entry is in open status.',
  '3': 'Provided replacement in-bond is in deleted status.',
  '4': 'Requested document is not in DIS.',
  '5': 'Additional information required via DIS.',
  '6': 'Unable to verify CBP disposition for full bill quantity on original entry.',
  '7': 'Provided replacement FTZ Admission is in deleted status.',
  '8': 'Provided replacement FTZ Admission is in open status.',
  '9': 'Original entry is on hold. Hold must be resolved prior to correction request.',
  '10': 'Original entry is on hold. Hold must be resolved prior to cancellation request.',
  '11': 'Original entry is on PGA hold. Hold must be resolved by PGA prior to correction request.',
  '12': 'Original entry is on PGA hold. Hold must be resolved by PGA prior to cancellation request.',
  '13': 'Other (See comments).',
  '14': 'Original entry and replacement entry must contain identical bill number.',
  '15': 'Original entry and replacement in-bond must contain identical bill number.',
  '16': 'Provided replacement entry is not on file.',
  '17': 'Provided replacement FTZ Admission is not on file.',
};

/** SO50 Bill Match Disposition codes — Note 1 (SO p.29, SO-39). */
export const SO50_DISPOSITION_CODES: Record<string, string> = {
  '91': 'NO BILL MATCH',
  '92': 'ACAS BILL ON FILE',
  '93': 'BILL ON FILE',
  '94': 'BILL DEPARTED',
  '95': 'BILL ARRIVED',
  '51': 'MANIFEST HOLD CBP',
  '52': 'MANIFEST HOLD AGRICULTURE',
  '53': 'CBP HOLD',
  '54': 'CBP MANIFEST HOLD REMOVED',
  '55': 'AGRICULTURE MANIFEST HOLD REMOVED',
  '56': 'CBP HOLD REMOVED',
  '57': 'SPLIT BILL DOES NOT QUALIFY FOR RELEASE',
  '58': 'QTY IS MORE THAN MANIFESTED BILL QTY',
  '59': 'INBOND DOES NOT MATCH OR NOT ON FILE',
  '61': 'BILL DELETED',
  '62': 'BILL DELETED AFTER ARRIVAL',
  '63': 'INBOND DELETED AFTER ARRIVAL AND RELEASE',
  '74': 'BOL TYPE INELIGIBLE FOR ENTRY PROCESSING',
};

/**
 * SO60 Cargo Release Processing Disposition codes — Note 1 (SO p.30-31,
 * SO-40..41). Codes marked * are reserved for future use in the chapter.
 * Release Date / Release Origin Code are only returned with 22 and 98.
 */
export const SO60_DISPOSITION_CODES: Record<string, string> = {
  '03': 'PENDING INTENSIVE EXAM',
  '04': 'ENTRY DETAINED',
  '21': 'ENTRY DELETED BY CBP', // *future use
  '22': 'RELEASE DATE UPDATE',
  '23': 'ENTRY CANCELLED',
  '24': 'ENTRY CANCELLATION UNSET', // *future use
  '25': 'ENTRY WILL BE CANCELLED IN 7 DAYS',
  '26': 'NO BILL MATCH AFTER 30 DAYS',
  '28': 'NO BILL MATCH AFTER 60 DAYS',
  '29': 'NOT RELEASED',
  '30': 'DE MINIMIS MAY BE MET USE ALT ENTRY TYPE',
  '31': 'CST APPROVAL REQUIRED', // *future use (Commodity Specialist Team)
  '33': 'ET86 INELIGIBLE COUNTRY; CANNOT RELEASE',
  '34': 'ENTRY RELEASE WITHHELD - DE MINIMIS MET',
  '70': 'QUOTA PENDING',
  '71': 'QUOTA REJECTED',
  '72': 'QUOTA RESERVED',
  '73': 'QUOTA ACCEPTED',
  '74': 'BOL TYPE INELIGIBLE FOR ENTRY PROCESSING',
  '75': 'POE REQD, NO AUTO DERIVE POSSIBLE',
  '76': 'ACTIVE ENTRY SUMMARY NOT FOUND',
  '79': 'ENTRY NOT PERMITTED AT REPORTED PORT',
  '80': 'IN-BOND NUMBER NOT ON FILE',
  '81': 'IN-BOND PORT DISCREPANCY',
  '82': 'SPLIT SHIPMENT RELEASE CODE REQUIRED',
  '83': 'SPLIT SHIPMENT RELEASE PENDING', // Hold All: released when full bill qty departs
  '84': 'DOC REQUIRED FOR CORRECTION REQUEST',
  '85': 'DOC REQUIRED FOR CANCELLATION REQUEST',
  '86': 'CORRECTION REQUEST REJECTED',
  '87': 'CANCELLATION REQUEST REJECTED',
  '88': 'ENTRY REPLACED',
  '89': 'ENTRY SUMMARY PORT DISCREPANCY',
  '90': 'UNDER CBP REVIEW',
  '96': 'DOCUMENT REQUIRED',
  '97': 'ADMISSIBLE',
  '98': 'RELEASED',
  '99': 'RELEASE SUSPENDED',
  '01': 'ONEUSG',
};

/** SO60 Release Origin codes — Note 2 (SO p.32, SO-42). */
export const RELEASE_ORIGIN_CODES: Record<string, string> = {
  '1': 'Selectivity Processing Date',
  '2': 'Estimated Date of Arrival',
  '3': 'Actual Arrival Date',
  '4': 'Paperless Master In-Bond Arrival Date',
  '5': 'Intensive Exam Completed',
  '6': 'Override to General Exam',
  '7': 'CBP Manifest Hold Removed',
  '8': 'Other Agency Review Completed',
  '9': 'Release Date Update',
  '99': 'Release Date Removed',
};

/** SO70 PGA Entry Hold Types — Note 6 (SO p.34, SO-44). */
export const PGA_ENTRY_HOLD_TYPES: Record<string, string> = {
  '1': 'Intensive or document required set by CBP on behalf of the agency listed in positions 5-7',
  '2': 'Intensive or document required set directly by agency listed in positions 5-7',
};
