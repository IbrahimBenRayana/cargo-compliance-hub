/**
 * Add Manufacturer Name & Address ($I input / $R response) — record defs
 * transcribed from the March 2023 v3.0 chapter (Pub #0875-0419), pages
 * AMF-10..24.
 *
 * The application submits a manufacturer's name/address and receives the
 * ACE-derived MID back ($6 output) — the authoritative check on locally
 * derived MIDs (payload/mid.ts). Action 'U' updates the postal code of an
 * existing MID (rev 3, AMF-4).
 *
 * Long values span records: name 70+30 ($1/$2), street 43+51 ($2/$3),
 * city 23+44 ($3/$4).
 */
import { assertRecordDef, type RecordDef } from '../../records/codec.js';

/** $A — optional user data, echoed back verbatim (AMF-10/18). */
export const INPUT_DOLLAR_A: RecordDef = {
  id: '$A',
  name: 'AmfUserData',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'A', designation: 'M', constant: 'A' },
    { name: 'userData', start: 3, end: 80, class: 'X', designation: 'M' },
  ],
};

/** $1 — update action, sequence, country, firm name 1-70 (AMF-11..12). */
export const INPUT_DOLLAR_1: RecordDef = {
  id: '$1',
  name: 'AmfActionCountryName',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '1' },
    // A = add manufacturer; U = update postal code (Note 3, AMF-14).
    { name: 'updateActionCode', start: 3, end: 3, class: 'A', designation: 'M' },
    { name: 'updateSequenceNumber', start: 4, end: 8, class: 'N', designation: 'M' },
    // Canadian manufacturers use province X-codes instead of 'CA' (Note 1,
    // AMF-13); US never uses the 24 state-like ISO codes (Note 2).
    { name: 'isoCountryCode', start: 9, end: 10, class: 'A', designation: 'C' },
    { name: 'firmName', start: 11, end: 80, class: 'AN', designation: 'C' },
  ],
};

/** $2 — firm name 71-100 + street 1-43 (AMF-15). */
export const INPUT_DOLLAR_2: RecordDef = {
  id: '$2',
  name: 'AmfNameStreet',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '2' },
    { name: 'firmName', start: 3, end: 32, class: 'AN', designation: 'C' },
    { name: 'street', start: 33, end: 75, class: 'AN', designation: 'C' },
    { name: 'filler', start: 76, end: 80, class: 'S', designation: 'M' },
  ],
};

/** $3 — street 44-94 + city 1-23 (AMF-16; mandatory for action 'A'). */
export const INPUT_DOLLAR_3: RecordDef = {
  id: '$3',
  name: 'AmfStreetCity',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '3' },
    { name: 'street', start: 3, end: 53, class: 'AN', designation: 'C' },
    // English/American city spelling; no Flughafen/Postfach/Cedex/County
    // prefixes (Note 1, AMF-16).
    { name: 'city', start: 54, end: 76, class: 'AN', designation: 'M' },
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' },
  ],
};

/** $4 — city 24-67, ZIP/postal, MID (AMF-17..18). */
export const INPUT_DOLLAR_4: RecordDef = {
  id: '$4',
  name: 'AmfCityZipMid',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '4' },
    { name: 'city', start: 3, end: 46, class: 'AN', designation: 'C' },
    // Required for action 'A' when the country is US/CA/CN; required for 'U'.
    { name: 'zipOrPostalCode', start: 47, end: 56, class: 'AN', designation: 'C' },
    // Optional on 'A' (ACE verifies against its own derivation, Note 2
    // AMF-18); required on 'U'.
    { name: 'manufacturerIdCode', start: 57, end: 71, class: 'AN', designation: 'C' },
    { name: 'filler', start: 72, end: 80, class: 'S', designation: 'M' },
  ],
};

/** $5 (output) — update status, sequence, country, firm name 1-70 (AMF-19..20). */
export const OUTPUT_DOLLAR_5: RecordDef = {
  id: '$5',
  name: 'AmfUpdateStatus',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '5' },
    // U = update acknowledgment ($6 follows when error-free); E = error
    // condition ($7 records follow).
    { name: 'updateStatus', start: 3, end: 3, class: 'A', designation: 'M' },
    { name: 'updateSequenceNumber', start: 4, end: 8, class: 'N', designation: 'M' },
    { name: 'isoCountryCode', start: 9, end: 10, class: 'A', designation: 'M' },
    { name: 'firmName', start: 11, end: 80, class: 'AN', designation: 'M' },
  ],
};

/** $6 (output) — firm name 71-100, ACE MID, ZIP/postal (AMF-21..22). */
export const OUTPUT_DOLLAR_6: RecordDef = {
  id: '$6',
  name: 'AmfManufacturerId',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '6' },
    { name: 'firmName', start: 3, end: 32, class: 'AN', designation: 'C' },
    { name: 'filler', start: 33, end: 33, class: 'S', designation: 'M' },
    // ACE-generated MID for adds; the submitted MID for postal updates.
    { name: 'manufacturerIdCode', start: 34, end: 48, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 49, end: 50, class: 'S', designation: 'M' },
    { name: 'zipOrPostalCode', start: 51, end: 60, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 61, end: 80, class: 'S', designation: 'M' },
  ],
};

/** $7 (output) — error id + narrative, up to 20 per loop (AMF-23/AMF-10). */
export const OUTPUT_DOLLAR_7: RecordDef = {
  id: '$7',
  name: 'AmfError',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 1, class: 'X', designation: 'M', constant: '$' },
    { name: 'recordType', start: 2, end: 2, class: 'N', designation: 'M', constant: '7' },
    { name: 'errorMessageIdentifier', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'filler', start: 6, end: 6, class: 'S', designation: 'M' },
    { name: 'narrativeMessage', start: 7, end: 46, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 47, end: 80, class: 'S', designation: 'M' },
  ],
};

for (const def of [
  INPUT_DOLLAR_A, INPUT_DOLLAR_1, INPUT_DOLLAR_2, INPUT_DOLLAR_3, INPUT_DOLLAR_4,
  OUTPUT_DOLLAR_5, OUTPUT_DOLLAR_6, OUTPUT_DOLLAR_7,
]) {
  assertRecordDef(def);
}
