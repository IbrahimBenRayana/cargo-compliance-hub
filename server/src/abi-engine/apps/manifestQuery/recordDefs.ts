/**
 * Cargo Manifest/In-bond/Entry Status Query (CQ/C1) record definitions —
 * transcribed from the ACE ABI CATAIR chapter of that name, revision 21,
 * September 9, 2025
 * (docs/abi-engine/specs/queries/cargo-manifest-entry-release-query-v21-2025-09.pdf).
 * Page references in comments are the chapter's ACMQ-n page numbers.
 *
 * Input: one WR1 per question, repeatable (ACMQ-13). Output: an error record
 * (WR0 entry, WSA in-bond/bill, WSB air waybill) or the result loops of
 * ACMQ-15 Note 3. Application codes: input CQ, response C1 (ACMQ-12;
 * APPLICATION_CODES.cargoManifestEntryReleaseQuery).
 *
 * The WO10..WO72 entry-status records (ACMQ-44..63) mirror the SO cargo
 * release notification and are not defined here; the parser keeps them raw.
 *
 * Output designations are declared C wherever CBP may leave the field blank
 * in practice, so a sparse record parses cleanly.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** Query request — input WR1 (ACMQ-13..14). One kind of question per record (Note 1). */
export const INPUT_WR1: RecordDef = {
  id: 'WR1',
  name: 'ManifestQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR1' },
    { name: 'filler', start: 4, end: 7, class: 'S', designation: 'M' },
    { name: 'entryFilerCode', start: 8, end: 10, class: 'AN', designation: 'C' }, // must equal the B-record filer
    { name: 'entryNumber', start: 11, end: 19, class: 'AN', designation: 'C', justify: 'right' },
    { name: 'inbondNumber', start: 20, end: 31, class: 'AN', designation: 'C' }, // 9N, V + 10AN, or an air waybill (Note 2)
    { name: 'billIssuerCode', start: 32, end: 35, class: 'AN', designation: 'C' }, // SCAC, or air carrier code on an air in-bond
    { name: 'billOfLadingNumber', start: 36, end: 47, class: 'AN', designation: 'C' },
    { name: 'airWaybillNumber', start: 48, end: 58, class: 'AN', designation: 'C' },
    { name: 'houseAirWaybillNumber', start: 59, end: 70, class: 'AN', designation: 'O' },
    { name: 'requestRelatedBills', start: 71, end: 71, class: 'AN', designation: 'O' }, // Y = related house/master bills
    { name: 'requestBillAndEntryData', start: 72, end: 72, class: 'AN', designation: 'O' }, // Y on an entry query
    { name: 'limitOutputOption', start: 73, end: 73, class: 'AN', designation: 'O' }, // space | 1 | 2 (Note 5)
    { name: 'filler2', start: 74, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry query error — output WR0 (ACMQ-21). */
export const OUTPUT_WR0: RecordDef = {
  id: 'WR0',
  name: 'ManifestQueryEntryError',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR0' },
    { name: 'entryFilerCode', start: 4, end: 6, class: 'AN', designation: 'M' },
    { name: 'entryNumber', start: 7, end: 15, class: 'AN', designation: 'M' },
    { name: 'filler', start: 16, end: 29, class: 'S', designation: 'M' },
    { name: 'errorCode', start: 30, end: 32, class: 'AN', designation: 'M' }, // CQ_ERROR_CODES
    { name: 'narrative', start: 33, end: 72, class: 'X', designation: 'M' },
    { name: 'filler2', start: 73, end: 80, class: 'S', designation: 'M' },
  ],
};

/** In-bond or ocean/rail/truck bill query error — output WSA (ACMQ-22). */
export const OUTPUT_WSA: RecordDef = {
  id: 'WSA',
  name: 'ManifestQueryBillError',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WSA' },
    { name: 'inbondNumber', start: 4, end: 15, class: 'AN', designation: 'C' },
    { name: 'billIssuerCode', start: 16, end: 19, class: 'AN', designation: 'C' },
    { name: 'masterBillNumber', start: 20, end: 31, class: 'AN', designation: 'C' },
    { name: 'errorCode', start: 32, end: 34, class: 'AN', designation: 'M' },
    { name: 'narrative', start: 35, end: 74, class: 'X', designation: 'M' },
    { name: 'filler', start: 75, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Air waybill query error — output WSB (ACMQ-23). */
export const OUTPUT_WSB: RecordDef = {
  id: 'WSB',
  name: 'ManifestQueryAirWaybillError',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WSB' },
    { name: 'airWaybillNumber', start: 4, end: 14, class: 'AN', designation: 'M' },
    { name: 'houseAirWaybillNumber', start: 15, end: 26, class: 'AN', designation: 'O' },
    { name: 'errorCode', start: 27, end: 29, class: 'AN', designation: 'M' },
    { name: 'narrative', start: 30, end: 69, class: 'X', designation: 'M' },
    { name: 'filler', start: 70, end: 80, class: 'S', designation: 'M' },
  ],
};

/**
 * Conveyance — output WR1 (ACMQ-24..26). Entry fields (pos 4-42) come back
 * only on entry queries by the entry's own filer (Note 1).
 */
export const OUTPUT_WR1: RecordDef = {
  id: 'WR1',
  name: 'ManifestQueryConveyance',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR1' },
    { name: 'districtPortOfEntry', start: 4, end: 7, class: 'N', designation: 'C' },
    { name: 'entryFilerCode', start: 8, end: 10, class: 'AN', designation: 'C' },
    { name: 'entryNumber', start: 11, end: 19, class: 'AN', designation: 'C' },
    { name: 'entryTypeCode', start: 20, end: 21, class: 'N', designation: 'C' },
    { name: 'importerOfRecordNumber', start: 22, end: 33, class: 'X', designation: 'C' },
    { name: 'brokerReferenceNumber', start: 34, end: 42, class: 'X', designation: 'C' },
    { name: 'carrierCode', start: 43, end: 46, class: 'AN', designation: 'C' }, // SCAC; 3-char carrier, left justified, for air
    // Vessel name; for air, carrier code + flight + original estimated arrival; spaces for truck.
    { name: 'conveyanceName', start: 47, end: 66, class: 'AN', designation: 'C' },
    { name: 'voyageFlightTripNumber', start: 67, end: 71, class: 'X', designation: 'C' },
    { name: 'dateOfArrival', start: 72, end: 77, class: 'N', designation: 'C' }, // MMDDYY, estimated
    { name: 'filler', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Truck trip and FIRMS — output WR2 (ACMQ-27). */
export const OUTPUT_WR2: RecordDef = {
  id: 'WR2',
  name: 'ManifestQueryTripAndLocation',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR2' },
    { name: 'tripNumber', start: 4, end: 28, class: 'AN', designation: 'C' },
    { name: 'filler', start: 29, end: 76, class: 'S', designation: 'M' },
    { name: 'firmsCode', start: 77, end: 80, class: 'AN', designation: 'C' },
  ],
};

/** Country of origin and tariff — output WR3 (ACMQ-28). Reserved; not currently returned. */
export const OUTPUT_WR3: RecordDef = {
  id: 'WR3',
  name: 'ManifestQueryTariff',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR3' },
    { name: 'recordControlNumber', start: 4, end: 6, class: 'N', designation: 'C' },
    { name: 'countryOfOrigin', start: 7, end: 8, class: 'A', designation: 'C' },
    { name: 'tariffNumber', start: 9, end: 18, class: 'AN', designation: 'C' },
    { name: 'filler', start: 19, end: 80, class: 'S', designation: 'M' },
  ],
};

const INBOND_STATUS_FIELDS: RecordDef['fields'] = [
  { name: 'inbondStatus', start: 4, end: 5, class: 'AN', designation: 'C' }, // INBOND_STATUS_CODES
  { name: 'inbondArrivalDate', start: 6, end: 11, class: 'N', designation: 'C' }, // MMDDYY; zeros when none
  { name: 'inbondExportDate', start: 12, end: 17, class: 'N', designation: 'C' },
  { name: 'filler', start: 18, end: 75, class: 'S', designation: 'M' },
  { name: 'inbondEntryType', start: 76, end: 77, class: 'AN', designation: 'C' }, // 61 IT | 62 T&E | 63 IE | 69 | 70
  { name: 'filler2', start: 78, end: 80, class: 'S', designation: 'M' },
];

/** In-bond status when the in-bond itself was updated — output WS4 (ACMQ-29). Precedes the WR4s. */
export const OUTPUT_WS4: RecordDef = {
  id: 'WS4',
  name: 'ManifestQueryInbondStatus',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WS4' },
    ...INBOND_STATUS_FIELDS,
  ],
};

/** In-bond status per bill — output WS5 (ACMQ-32). Follows its WR4. */
export const OUTPUT_WS5: RecordDef = {
  id: 'WS5',
  name: 'ManifestQueryBillInbondStatus',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WS5' },
    ...INBOND_STATUS_FIELDS,
  ],
};

/** The bill — output WR4 (ACMQ-30..31). Repeats per in-bond posted to the bill, latest first. */
export const OUTPUT_WR4: RecordDef = {
  id: 'WR4',
  name: 'ManifestQueryBill',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR4' },
    { name: 'inbondNumber', start: 4, end: 15, class: 'AN', designation: 'C' },
    { name: 'masterBillNumber', start: 16, end: 27, class: 'AN', designation: 'C' }, // also regular/simple bills (Note 1)
    { name: 'houseBillNumber', start: 28, end: 39, class: 'AN', designation: 'C' },
    { name: 'subHouseBillNumber', start: 40, end: 51, class: 'AN', designation: 'C' },
    { name: 'manifestQuantity', start: 52, end: 59, class: 'N', designation: 'C' },
    { name: 'unit', start: 60, end: 64, class: 'X', designation: 'C' },
    { name: 'masterBillIssuerCode', start: 65, end: 68, class: 'AN', designation: 'C' },
    { name: 'houseBillIssuerCode', start: 69, end: 72, class: 'AN', designation: 'C' },
    { name: 'billOfLadingType', start: 73, end: 73, class: 'X', designation: 'C' }, // 0 regular | M | H | F FROB
    { name: 'isfIndicator', start: 74, end: 74, class: 'X', designation: 'C' }, // Y | N, ocean only
    { name: 'modeOfTransportCode', start: 75, end: 75, class: 'X', designation: 'C' }, // 1 ocean | 2 rail | 3 truck
    { name: 'filler', start: 76, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Air waybill — output WSC (ACMQ-34..36). Repeats per in-bond and per house air waybill. */
export const OUTPUT_WSC: RecordDef = {
  id: 'WSC',
  name: 'ManifestQueryAirWaybill',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WSC' },
    { name: 'importingCarrierCode', start: 4, end: 6, class: 'AN', designation: 'M' },
    { name: 'flightNumber', start: 7, end: 11, class: 'AN', designation: 'M' },
    { name: 'scheduledArrivalDate', start: 12, end: 17, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'airWaybillNumber', start: 18, end: 28, class: 'AN', designation: 'M' },
    { name: 'partIndicator', start: 29, end: 29, class: 'A', designation: 'C' }, // split master
    { name: 'manifestQuantity', start: 30, end: 34, class: 'N', designation: 'M' },
    { name: 'boardedQuantity', start: 35, end: 39, class: 'N', designation: 'C' },
    // Left justified since 1/16/2020 (record version 1); right justified before (Note 5).
    { name: 'houseAirWaybillNumber', start: 40, end: 51, class: 'AN', designation: 'O' },
    { name: 'housePartIndicator', start: 52, end: 52, class: 'A', designation: 'C' },
    { name: 'houseManifestQuantity', start: 53, end: 57, class: 'N', designation: 'C' },
    { name: 'houseBoardedQuantity', start: 58, end: 62, class: 'N', designation: 'C' },
    { name: 'inbondNumber', start: 63, end: 73, class: 'N', designation: 'C' },
    { name: 'inbondStatus', start: 74, end: 75, class: 'AN', designation: 'C' },
    { name: 'inbondEntryType', start: 76, end: 77, class: 'AN', designation: 'C' },
    { name: 'filler', start: 78, end: 79, class: 'S', designation: 'M' },
    { name: 'recordVersion', start: 80, end: 80, class: 'AN', designation: 'C' },
  ],
};

/** Air disposition — output WSD (ACMQ-37..38). Repeats. */
export const OUTPUT_WSD: RecordDef = {
  id: 'WSD',
  name: 'ManifestQueryAirDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WSD' },
    { name: 'dispositionActionDate', start: 4, end: 9, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'dispositionActionTime', start: 10, end: 15, class: 'N', designation: 'M' }, // HHMMSS
    { name: 'dispositionCode', start: 16, end: 17, class: 'AN', designation: 'M' }, // Air CAMIR Appendix A
    { name: 'narrative', start: 18, end: 57, class: 'X', designation: 'M' },
    { name: 'inbondOrEntryNumber', start: 58, end: 69, class: 'AN', designation: 'C' },
    { name: 'filler', start: 70, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Surface disposition — output WR5 (ACMQ-39..40). Repeats per transaction. */
export const OUTPUT_WR5: RecordDef = {
  id: 'WR5',
  name: 'ManifestQueryDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WR5' },
    { name: 'dispositionActionDate', start: 4, end: 9, class: 'N', designation: 'M' }, // MMDDYY
    { name: 'dispositionActionTime', start: 10, end: 13, class: 'N', designation: 'M' }, // HHMM
    { name: 'dispositionCode', start: 14, end: 16, class: 'AN', designation: 'M' }, // Ocean CAMIR Appendix D; NP = not yet transmitted
    { name: 'narrative', start: 17, end: 56, class: 'X', designation: 'M' },
    { name: 'filler', start: 57, end: 57, class: 'S', designation: 'M' },
    { name: 'releaseDate', start: 58, end: 63, class: 'N', designation: 'C' }, // only with disposition 22
    { name: 'releaseOrigin', start: 64, end: 65, class: 'N', designation: 'C' }, // RELEASE_ORIGIN_CODES
    { name: 'quantity', start: 66, end: 73, class: 'N', designation: 'C' },
    { name: 'filler2', start: 74, end: 74, class: 'S', designation: 'M' },
    { name: 'sequence', start: 75, end: 77, class: 'N', designation: 'C' },
    { name: 'filler3', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Amended bill quantities — output WN0 (ACMQ-41). */
export const OUTPUT_WN0: RecordDef = {
  id: 'WN0',
  name: 'ManifestQueryAmendedQuantities',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WN0' },
    { name: 'masterBillAmendedQuantity', start: 4, end: 11, class: 'N', designation: 'C' },
    { name: 'houseBillAmendedQuantity', start: 12, end: 19, class: 'N', designation: 'C' },
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Ports and dates — output WN1 (ACMQ-42..43). Repeats per in-bond posted to the bill. */
export const OUTPUT_WN1: RecordDef = {
  id: 'WN1',
  name: 'ManifestQueryPorts',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 3, class: 'AN', designation: 'M', constant: 'WN1' },
    { name: 'inbondNumber', start: 4, end: 15, class: 'AN', designation: 'C' },
    { name: 'manifestedPortOfUnlading', start: 16, end: 19, class: 'AN', designation: 'C' },
    { name: 'actualPortOfUnlading', start: 20, end: 23, class: 'AN', designation: 'C' }, // rail/truck, when different
    { name: 'actualPortOfUnladingVesselDiversion', start: 24, end: 27, class: 'AN', designation: 'C' },
    { name: 'inbondOriginatingPort', start: 28, end: 31, class: 'AN', designation: 'C' },
    { name: 'manifestedInbondDestinationPort', start: 32, end: 35, class: 'AN', designation: 'C' },
    { name: 'actualInbondDestinationManualDiversion', start: 36, end: 39, class: 'AN', designation: 'C' },
    { name: 'actualInbondDestinationEdiDiversion', start: 40, end: 43, class: 'AN', designation: 'C' },
    { name: 'vesselDeparturePort', start: 44, end: 48, class: 'AN', designation: 'C' }, // Schedule K
    { name: 'vesselDepartureDate', start: 49, end: 54, class: 'N', designation: 'C' }, // MMDDYY
    { name: 'containerLoadPort', start: 55, end: 71, class: 'AN', designation: 'C' }, // from carrier status messages; may be absent
    { name: 'containerLoadDate', start: 72, end: 77, class: 'AN', designation: 'C' },
    { name: 'filler', start: 78, end: 80, class: 'S', designation: 'M' },
  ],
};

/** WR0 / WSA / WSB error codes (CQ Query Error Appendix, ACMQ-64). */
export const CQ_ERROR_CODES = {
  '009': 'INVALID CARRIER CODE',
  '176': 'CARRIER CODE MISSING',
  '185': 'BOL/IN-BOND NUMBER(S) MISSING',
  '122': 'BILL NBR NOT ON FILE',
  '123': 'INBOND NBR NOT ON FILE',
  '297': 'INVALID AIRWAY BILL',
  '950': 'ENTRY RECORD NOT FOUND',
  '999': 'BATCH REJECTED',
  B05: 'ENTRY FILER MISSING',
  B06: 'ENTRY FILER UNKNOWN',
  B14: 'ENTRY NUMBER MISSING',
  INE: 'INSUFFICIENT DATA FOR QUERY',
  X17: 'FILER NOT AUTHORIZED',
  X39: 'DATA FOUND IN FILLER',
  X40: 'NON-STANDARD DATA FOUND',
  ZZZ: '** ACE SYSTEM FAILURE **',
} as const;

/** In-bond status codes (WS4 / WS5 Note 1, WSC Note 2). */
export const INBOND_STATUS_CODES = {
  AR: 'Arrived',
  CN: 'Concluded',
  ER: 'Enroute',
  EX: 'Exported',
  IF: 'In-transit Foreign',
  IU: 'In-transit US',
  UA: 'Unarrived',
  OF: 'On File',
} as const;

/** Release origin codes (WR5 Note 2, ACMQ-40). */
export const RELEASE_ORIGIN_CODES = {
  '01': 'Selectivity Processing Date',
  '02': 'Estimated Date of Arrival',
  '03': 'Actual Arrival Date',
  '04': 'Paperless Master In-Bond Arrival Date',
  '05': 'Intensive Exam Completed',
  '06': 'Override to General Exam',
  '07': 'CBP Manifest Hold Removed',
  '08': 'Other Agency Review Completed',
  '09': 'Release Date Update',
  '99': 'Release Date Removed',
} as const;

for (const def of [
  INPUT_WR1,
  OUTPUT_WR0,
  OUTPUT_WSA,
  OUTPUT_WSB,
  OUTPUT_WR1,
  OUTPUT_WR2,
  OUTPUT_WR3,
  OUTPUT_WS4,
  OUTPUT_WS5,
  OUTPUT_WR4,
  OUTPUT_WSC,
  OUTPUT_WSD,
  OUTPUT_WR5,
  OUTPUT_WN0,
  OUTPUT_WN1,
]) {
  assertRecordDef(def);
}
