/**
 * Importer Security Filing (SF) transaction builder — CATAIR "Importer
 * Security Filing" chapter, July 2017 Version 3 (ISF-n page numbers in
 * comments).
 *
 * Assembles one ISF Grouping (SF10 … SF50) from a typed input, following
 * the ISF-10 input record usage map (ISF-7..8) or the ISF-5 map (ISF-9).
 * The output lines go into a block of an SF-application batch via
 * buildBatch(); the response arrives in the SN transaction set.
 *
 * Structural rules enforced here (the chapter's stated rules, not
 * conjecture):
 *  - ISF-10 (submission types 1/3) requires an SF30 for each of MF, SE,
 *    BY, ST, CS, CN, IM, LG; ISF-5 (types 2/4) requires BKP and ST
 *    (SF10 Note 1, ISF-15).
 *  - Delete transmits only the SF10 with the CBP-assigned ISF transaction
 *    number (ISF-4, ISF-17 Note 3).
 *  - Entities are reported by identifier XOR name+address: with a name the
 *    SF35 (1-3) and SF36 records are mandatory; with an identifier they
 *    must not be sent (ISF-28, ISF-31). CN/IM are SF30-only with a
 *    mandatory identifier (ISF-28).
 *  - For ISF-10, each manufacturer loop nests 1-999 SF40 records; for
 *    ISF-5 all SF40 records trail the last entity loop (ISF-8/9, ISF-36).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../records/codec.js';
import {
  SF10,
  SF13,
  SF15,
  SF20,
  SF25,
  SF30,
  SF31,
  SF35,
  SF36,
  SF40,
  SF50,
  SUBMISSION_TYPES,
  SHIPMENT_TYPES,
  ACTION_REASON_CODES,
  IMPORTER_NUMBER_QUALIFIERS,
  BOND_ACTIVITY_CODES,
  BOND_TYPES,
  ENTITY_IDENTIFIER_QUALIFIERS,
  ENTITY_SECONDARY_NAME_CODES,
  ADDRESS_COMPONENT_QUALIFIERS,
  REFERENCE_IDENTIFIER_QUALIFIERS,
} from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export type IsfSubmissionType = '1' | '2' | '3' | '4';
export type IsfShipmentType = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11';
export type IsfActionCode = 'A' | 'D' | 'R';
export type IsfActionReasonCode = 'CT' | 'FR' | 'FT' | 'FX';
export type IsfEntityCode = 'MF' | 'SE' | 'BY' | 'ST' | 'LG' | 'CS' | 'BKP' | 'CN' | 'IM';
export type IsfEntityIdentifierQualifier = 'EI' | 'ANI' | 'CIN' | '34' | 'DUN' | 'DNS' | 'FR' | 'AEF';

export interface IsfImporter {
  /** EI / ANI / 34 / AEF; '2' (SCAC) for ISF-5 submission types only. */
  qualifier: 'EI' | 'ANI' | '34' | 'AEF' | '2';
  number: string;
  /** MMDDYYYY; required with AEF, may be required with 34 (Note 4, ISF-18). */
  dateOfBirth?: string;
  /** ISO country of passport issuance; required with AEF (ISF-15). */
  countryOfIssuance?: string;
}

export interface IsfBond {
  /** Identification number of the party whose bond is obligated. */
  holder: string;
  /** 01 / 02 / 03 / 04 / 16 (ISF-20). */
  activityCode: string;
  /** 8 continuous, 9 single transaction (type 9 requires activity 16). */
  type: '8' | '9';
}

/** SF13 shipment information — mandatory for Shipment Type 11 (ISF-21). */
export interface IsfShipmentInfo {
  subType: '01' | '02' | '03';
  /** Whole U.S. dollars, > 0. */
  estimatedValueDollars: number;
  /** Smallest external packaging units, whole number > 0. */
  estimatedQuantity: number;
  /** Appendix B UOM code; generic PCS acceptable. */
  unitOfMeasure: string;
  /** Whole kilos or pounds, > 0. */
  estimatedWeight: number;
  weightQualifier: 'K' | 'L';
}

/** SF15 bill of lading. SCAC + number are concatenated on the wire (ISF-23). */
export interface IsfBill {
  /** OB = regular (straight/simple) bill, BM = house bill. */
  qualifier: 'OB' | 'BM';
  /** SCAC of the bill of lading issuer. */
  scac: string;
  /** Bill number — no spaces, hyphens, slashes or other specials. */
  billNumber: string;
}

export interface IsfReference {
  /** 6B / 6C / MB / SBN / V1 / CR / FN (ISF-25). */
  qualifier: '6B' | '6C' | 'MB' | 'SBN' | 'V1' | 'CR' | 'FN';
  value: string;
}

export interface IsfContainer {
  /** Equipment description code (Appendix B). */
  descriptionCode: string;
  /** Alpha prefix preceding the serial number. */
  initial: string;
  /** Serial number digits (zero-padded to 15 on the wire). */
  number: string;
  checkDigit?: string;
  sizeTypeCode?: string;
}

export interface IsfAddressComponent {
  /** SF35 address component qualifier (ISF-33..34). */
  qualifier: string;
  information: string;
}

export interface IsfEntityGeography {
  city: string;
  /** ISO subdivision code. */
  countrySubEntityCode?: string;
  postalCode?: string;
  /** ISO country code. */
  countryCode: string;
}

export interface IsfEntityBase {
  /** Entity name — mutually exclusive with identifier except for 34/AEF. */
  name?: string;
  /** Optional SF31 secondary name (ALA/DH/DV/NU/NV/XD, ISF-32). */
  secondaryName?: { code: string; name: string };
  /** Entity identifier in lieu of name and address (SF30 Note 2). */
  identifier?: {
    qualifier: IsfEntityIdentifierQualifier;
    value: string;
    /** Passport country of issuance (required with AEF). */
    countryOfIssuance?: string;
    /** MMDDYYYY (required with AEF, may be required with 34). */
    dateOfBirth?: string;
  };
  /** SF35 components (1-6 → 1-3 records); mandatory with name. */
  addressComponents?: IsfAddressComponent[];
  /** SF36 geography; mandatory with name. */
  geography?: IsfEntityGeography;
}

export interface IsfEntity extends IsfEntityBase {
  /** ISF-10: IM/CN/SE/BY/ST/LG/CS. ISF-5: BKP/ST. MF goes in manufacturers. */
  code: Exclude<IsfEntityCode, 'MF'>;
}

export interface IsfTariff {
  /** HTS number, minimum 6 digits, up to 10; left-justified on the wire. */
  htsNumber: string;
  /** ISO country of origin — mandatory for ISF-10, not required for ISF-5. */
  countryOfOrigin?: string;
}

/** ISF-10 manufacturer loop: entity records + 1-999 nested SF40s (ISF-8). */
export interface IsfManufacturer extends IsfEntityBase {
  tariffs: IsfTariff[];
}

export interface IsfInput {
  /** 1/3 = ISF-10; 2/4 = ISF-5 (SF10 Note 1, ISF-15). */
  submissionType: IsfSubmissionType;
  /** 01-11; must be 01 for ISF-5 submission types (Note 2, ISF-16). */
  shipmentTypeCode: IsfShipmentType;
  action: IsfActionCode;
  /** Mandatory when action is A or R (Note 3, ISF-17). */
  actionReasonCode?: IsfActionReasonCode;
  importer: IsfImporter;
  /** 10 = break bulk, 11 = containerized. */
  modeOfTransportationCode?: '10' | '11';
  /**
   * CBP-assigned FFF-NNNNNNNNNNN. Required for Delete; must be space
   * filled (omitted) on Add (Note 5, ISF-19).
   */
  isfTransactionNumber?: string;
  /** SCAC of the vessel operator transporting the container (Note 6). */
  scac?: string;
  /** Mandatory for ISF-10 Add/Replace with shipment types 01/02/07/08/10. */
  bond?: IsfBond;
  /** SF13 — mandatory when shipmentTypeCode is 11; ISF-10 only. */
  shipmentInfo?: IsfShipmentInfo;
  /** SF15 ×1-999. */
  bills: IsfBill[];
  /** SF20 ×0-999. */
  references?: IsfReference[];
  /** SF25 ×0-999. */
  containers?: IsfContainer[];
  /** Non-manufacturer entity loops. */
  entities: IsfEntity[];
  /** ISF-10 only: manufacturer loops, each with nested SF40s. */
  manufacturers?: IsfManufacturer[];
  /** ISF-5 only: trailing SF40 block ×1-999 (ISF-9 Note 2). */
  tariffs?: IsfTariff[];
  /** ISF-5 only: SF50 FROB/T&E/IE routing (ISF-37). */
  frob?: {
    portOfUnladingQualifier: 'K' | 'UN';
    foreignPortOfUnlading: string;
    placeOfDeliveryQualifier: 'K' | 'UN';
    placeOfDelivery: string;
  };
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'ImporterSecurityFiling', field, message };
  throw new RecordCodecError([issue]);
}

/**
 * Format a positive whole number for an ISF N field. The chapter's
 * formatting rules require numeric fields to be right justified and
 * ZERO-filled (ISF-5), unlike the ESAR (S)N convention.
 */
function zeroPad(value: number, width: number, field: string): string {
  if (!Number.isInteger(value) || value <= 0) {
    fail(field, `must be a whole number greater than zero, got ${value}`);
  }
  const s = String(value);
  if (s.length > width) fail(field, `value ${s} exceeds ${width} digits`);
  return s.padStart(width, '0');
}

function padDigits(value: string, width: number, field: string): string {
  if (!/^[0-9]+$/.test(value)) fail(field, `must be numeric, got '${value}'`);
  if (value.length > width) fail(field, `value '${value}' exceeds ${width} digits`);
  return value.padStart(width, '0');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Shipment types for which bond info is mandatory on Add/Replace (ISF-19 Note 7). */
const BOND_MANDATORY_SHIPMENT_TYPES = new Set(['01', '02', '07', '08', '10']);

/** Shipment types that permit the AEF (passport) qualifier (ISF-18/31). */
const AEF_SHIPMENT_TYPES = new Set(['03', '05', '06']);

/** ISF-10 mandatory entity codes besides MF (SF10 Note 1, ISF-15). */
const ISF10_REQUIRED_ENTITIES: readonly IsfEntity['code'][] = ['SE', 'BY', 'ST', 'CS', 'CN', 'IM', 'LG'];

/** Canonical emission order per ISF-7 Note 1 (non-manufacturers first). */
const ISF10_ENTITY_ORDER: Record<string, number> = { IM: 0, CN: 1, SE: 2, BY: 3, ST: 4, LG: 5, CS: 6 };
const ISF5_ENTITY_ORDER: Record<string, number> = { BKP: 0, ST: 1 };

// ── Entity emission ────────────────────────────────────────

function emitEntity(
  code: IsfEntityCode,
  entity: IsfEntityBase,
  shipmentTypeCode: string,
  lines: string[],
): void {
  const label = `entities[${code}]`;
  const hasName = entity.name !== undefined && entity.name !== '';
  const hasIdentifier = entity.identifier !== undefined;

  if (code === 'CN' || code === 'IM') {
    // CN/IM are reported with only the SF30 record; the identifier is
    // mandatory (ISF-28).
    if (!hasIdentifier) fail(label, `${code} must be reported by entity identifier (SF30-only, ISF-28)`);
  }
  if (!hasName && !hasIdentifier) {
    fail(label, 'either an entity name or an entity identifier is required (ISF-31)');
  }

  if (hasIdentifier) {
    const q = entity.identifier!.qualifier;
    const table = ENTITY_IDENTIFIER_QUALIFIERS[q];
    if (!table) fail(label, `unknown entity identifier qualifier '${q}' (ISF-29)`);
    if (!table.allowedEntities.includes(code)) {
      fail(label, `identifier qualifier ${q} may only be used with entity codes ${table.allowedEntities.join('/')} (ISF-29..31)`);
    }
    if (q === 'AEF') {
      if (!AEF_SHIPMENT_TYPES.has(shipmentTypeCode)) {
        fail(label, 'AEF (passport) may only be used when the shipment type is 03, 05 or 06 (ISF-31)');
      }
      if (!hasName || !entity.identifier!.countryOfIssuance || !entity.identifier!.dateOfBirth) {
        fail(label, 'passport identifier requires full legal name, country of issuance and DOB (SF30 Note 3, ISF-31)');
      }
    }
    // Only either a name or an identifier may be provided, except that
    // 34/AEF may (or must) also carry the full legal name (ISF-31).
    if (hasName && q !== '34' && q !== 'AEF') {
      fail(label, `only either an entity name or an entity identifier can be provided (qualifier ${q}, ISF-31)`);
    }
    if ((entity.addressComponents && entity.addressComponents.length > 0) || entity.geography) {
      fail(label, 'SF35/SF36 records are not used when an entity identifier is reported (ISF-28/33/35)');
    }
  } else {
    // Name route: SF35 and SF36 are mandatory (ISF-28/33/35).
    const components = entity.addressComponents ?? [];
    if (components.length === 0) fail(label, 'address components (SF35) are mandatory when a name is reported (ISF-33)');
    if (components.length > 6) fail(label, 'at most 3 SF35 records (6 address components) per entity (ISF-7)');
    if (!entity.geography) fail(label, 'geographic area (SF36) is mandatory when a name is reported (ISF-35)');
  }

  lines.push(
    writeRecord(SF30, {
      entityCode: code,
      entityName: entity.name,
      entityIdentifierQualifier: entity.identifier?.qualifier,
      entityIdentifier: entity.identifier?.value,
      countryCode: entity.identifier?.countryOfIssuance,
      dateOfBirth: entity.identifier?.dateOfBirth,
    }),
  );

  if (entity.secondaryName) {
    if (!ENTITY_SECONDARY_NAME_CODES[entity.secondaryName.code]) {
      fail(label, `unknown secondary-name code '${entity.secondaryName.code}' (ISF-32)`);
    }
    lines.push(
      writeRecord(SF31, {
        entityCode: entity.secondaryName.code,
        entityName: entity.secondaryName.name,
      }),
    );
  }

  if (!hasIdentifier) {
    for (const component of entity.addressComponents ?? []) {
      if (!ADDRESS_COMPONENT_QUALIFIERS[component.qualifier]) {
        fail(label, `unknown address component qualifier '${component.qualifier}' (ISF-33..34)`);
      }
    }
    for (const pair of chunk(entity.addressComponents ?? [], 2)) {
      lines.push(
        writeRecord(SF35, {
          addressComponentQualifier1: pair[0].qualifier,
          addressInformation1: pair[0].information,
          addressComponentQualifier2: pair[1]?.qualifier,
          addressInformation2: pair[1]?.information,
        }),
      );
    }
    const geo = entity.geography!;
    lines.push(
      writeRecord(SF36, {
        cityName: geo.city,
        countrySubEntityCode: geo.countrySubEntityCode,
        postalCode: geo.postalCode,
        countryCode: geo.countryCode,
      }),
    );
  }
}

function emitTariff(tariff: IsfTariff, isIsf10: boolean, index: number, lines: string[]): void {
  const label = `tariffs[${index}]`;
  if (!/^[0-9]{6,10}$/.test(tariff.htsNumber)) {
    fail(label, `HTS number must be 6 to 10 digits, got '${tariff.htsNumber}' (ISF-36)`);
  }
  // Country of Origin is a required ISF-10 data element (ISF-5 p.5 item 9)
  // and "is not required if the ISF submission is being made for FROB, IE
  // or TE shipments, i.e. ISF-5" (ISF-36).
  if (isIsf10 && !tariff.countryOfOrigin) {
    fail(label, 'country of origin is mandatory on ISF-10 SF40 records (ISF-36)');
  }
  lines.push(
    writeRecord(SF40, {
      harmonizedNumber: tariff.htsNumber,
      countryOfOrigin: tariff.countryOfOrigin,
    }),
  );
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build one ISF transaction (ISF Grouping) as 80-char record lines. A
 * Delete action emits only the SF10 record, per ISF-4 / ISF-17 Note 3.
 */
export function buildIsf(input: IsfInput): string[] {
  if (!SUBMISSION_TYPES[input.submissionType]) {
    fail('submissionType', `unknown ISF submission type '${input.submissionType}' (ISF-15)`);
  }
  if (!SHIPMENT_TYPES[input.shipmentTypeCode]) {
    fail('shipmentTypeCode', `unknown shipment type '${input.shipmentTypeCode}' (ISF-16)`);
  }
  const isIsf10 = input.submissionType === '1' || input.submissionType === '3';
  const isIsf5 = !isIsf10;

  if (input.action === 'D') {
    // "To delete a previously accepted Importer Security Filing, only the
    // SF10 record is required containing the ISF transaction number
    // previously provided in the SN output transaction." (ISF-4)
    if (!input.isfTransactionNumber) {
      fail('isfTransactionNumber', 'a Delete requires the CBP-assigned ISF transaction number (ISF-17 Note 3)');
    }
    return [
      writeRecord(SF10, {
        isfSubmissionType: input.submissionType,
        shipmentTypeCode: input.shipmentTypeCode,
        actionCode: 'D',
        isfImporterNumberQualifier: input.importer.qualifier,
        isfImporterNumber: input.importer.number,
        isfTransactionNumber: input.isfTransactionNumber,
      }),
    ];
  }
  if (input.action !== 'A' && input.action !== 'R') {
    fail('action', `action code must be A, D or R, got '${input.action}' (ISF-14)`);
  }

  // ── Header-level rules (Add/Replace) ─────────────────────
  if (!input.actionReasonCode || !ACTION_REASON_CODES[input.actionReasonCode]) {
    fail('actionReasonCode', 'an action reason code (CT/FR/FT/FX) is mandatory when the action is A or R (ISF-17 Note 3)');
  }
  if (input.action === 'A' && input.isfTransactionNumber) {
    fail('isfTransactionNumber', 'the ISF transaction number must be space filled when the action is Add (ISF-19 Note 5)');
  }
  if (isIsf5 && input.shipmentTypeCode !== '01') {
    fail('shipmentTypeCode', 'shipment type must be 01 when submitting an ISF-5 submission type (ISF-16 Note 2)');
  }
  if (!IMPORTER_NUMBER_QUALIFIERS[input.importer.qualifier]) {
    fail('importer.qualifier', `unknown ISF importer number qualifier '${input.importer.qualifier}' (ISF-18)`);
  }
  if (input.importer.qualifier === '2' && !isIsf5) {
    fail('importer.qualifier', "the '2' (SCAC) qualifier may only be used for ISF-5 submission types (ISF-18 Note 4)");
  }
  const references = input.references ?? [];
  for (const [i, ref] of references.entries()) {
    if (!REFERENCE_IDENTIFIER_QUALIFIERS[ref.qualifier]) {
      fail(`references[${i}]`, `unknown reference identifier qualifier '${ref.qualifier}' (ISF-25)`);
    }
  }
  const hasRef = (qualifier: IsfReference['qualifier']) => references.some((r) => r.qualifier === qualifier);
  if (input.importer.qualifier === 'AEF') {
    if (!AEF_SHIPMENT_TYPES.has(input.shipmentTypeCode)) {
      fail('importer.qualifier', 'AEF (passport) may only be used when the shipment type is 03, 05 or 06 (ISF-18 Note 4)');
    }
    if (!input.importer.dateOfBirth || !input.importer.countryOfIssuance || !hasRef('FN')) {
      fail('importer', 'a passport-identified ISF importer requires DOB, country of issuance and an FN full-name reference (ISF-15/18)');
    }
  }

  // SF13 is required when Shipment Type 11 is provided, otherwise optional
  // (ISF-21); the ISF-5 usage map has no SF13 at all (ISF-9).
  if (input.shipmentTypeCode === '11' && !input.shipmentInfo) {
    fail('shipmentInfo', 'an SF13 shipment information record is mandatory for shipment type 11 (ISF-16 Note 2, ISF-21)');
  }
  if (isIsf5 && input.shipmentInfo) {
    fail('shipmentInfo', 'the SF13 record is not part of the ISF-5 input usage map (ISF-9)');
  }

  // Bond information is mandatory for all Add or Replace transactions when
  // the Shipment Type code = 01, 02, 07, 08 or 10 (ISF-19 Note 7).
  // AMBIGUITY: ISF-5 forces shipment type 01, which read literally would
  // always demand a bond, yet the ISF-5 data set (ISF-6) has no bond
  // element and permits a SCAC-identified importer; we therefore apply the
  // rule to ISF-10 submissions only.
  if (isIsf10 && BOND_MANDATORY_SHIPMENT_TYPES.has(input.shipmentTypeCode) && !input.bond) {
    fail('bond', `bond information is mandatory on Add/Replace for shipment type ${input.shipmentTypeCode} (ISF-19 Note 7)`);
  }
  if (input.bond) {
    if (!BOND_ACTIVITY_CODES[input.bond.activityCode]) {
      fail('bond.activityCode', `unknown bond activity code '${input.bond.activityCode}' (ISF-20)`);
    }
    if (!BOND_TYPES[input.bond.type]) {
      fail('bond.type', `unknown bond type '${input.bond.type}' (ISF-20)`);
    }
    if (input.bond.type === '9') {
      if (input.bond.activityCode !== '16') {
        fail('bond', 'bond type 9 may only be used with bond activity code 16 (ISF-19 Note 7)');
      }
      if (!hasRef('V1') || !hasRef('SBN')) {
        fail('bond', 'bond type 9 / activity 16 requires SF20 records for both V1 (surety code) and SBN (bond reference number) (ISF-19 Note 7)');
      }
    }
  }

  if (input.shipmentTypeCode === '06' && !hasRef('6C')) {
    fail('references', "a 6C (carnet country + number) reference is required when the shipment type is 06 (ISF-26)");
  }

  if (input.bills.length === 0) fail('bills', 'at least one SF15 bill of lading is mandatory (ISF-7/9)');
  if (input.bills.length > 999) fail('bills', 'at most 999 SF15 records (ISF-7/9)');
  if (references.length > 999) fail('references', 'at most 999 SF20 records (ISF-7/9)');
  if ((input.containers ?? []).length > 999) fail('containers', 'at most 999 SF25 records (ISF-7/9)');

  // ── Entity-set rules ─────────────────────────────────────
  const manufacturers = input.manufacturers ?? [];
  if (isIsf10) {
    for (const code of ISF10_REQUIRED_ENTITIES) {
      if (!input.entities.some((e) => e.code === code)) {
        fail('entities', `ISF-10 requires an SF30 record for entity code ${code} (SF10 Note 1, ISF-15)`);
      }
    }
    if (manufacturers.length === 0) {
      fail('manufacturers', 'ISF-10 requires at least one MF (manufacturer) entity loop (SF10 Note 1, ISF-15)');
    }
    if (input.entities.some((e) => e.code === 'BKP')) {
      fail('entities', 'BKP (booking party) is an ISF-5 entity, not part of an ISF-10 (ISF-15)');
    }
    if (input.tariffs && input.tariffs.length > 0) {
      fail('tariffs', 'ISF-10 SF40 records nest inside each manufacturer loop; there is no trailing SF40 block (ISF-8)');
    }
    if (input.frob) {
      fail('frob', "the SF50 record requires an ISF-5 submission type (ISF Submission Type '2', ISF-37)");
    }
  } else {
    for (const code of ['BKP', 'ST'] as const) {
      if (!input.entities.some((e) => e.code === code)) {
        fail('entities', `ISF-5 requires an SF30 record for entity code ${code} (SF10 Note 1, ISF-15)`);
      }
    }
    const disallowed = input.entities.find((e) => e.code !== 'BKP' && e.code !== 'ST');
    if (disallowed) {
      fail('entities', `ISF-5 entity records are required only for BKP and ST; got ${disallowed.code} (ISF-9 Note 1)`);
    }
    if (manufacturers.length > 0) {
      fail('manufacturers', 'manufacturers are not included as entities for ISF-5 submissions (ISF-9 Note 1)');
    }
    if (!input.tariffs || input.tariffs.length === 0) {
      fail('tariffs', 'ISF-5 requires 1-999 SF40 records following the last entity loop (ISF-9 Note 2)');
    }
  }
  const imCount = input.entities.filter((e) => e.code === 'IM').length;
  if (imCount > 1) fail('entities', 'there can only be a single Importer of Record per ISF filing (ISF-28)');
  if (input.entities.length + manufacturers.length > 999) fail('entities', 'at most 999 entity loops (ISF-7/9)');
  for (const [i, mf] of manufacturers.entries()) {
    if (mf.tariffs.length === 0 || mf.tariffs.length > 999) {
      fail(`manufacturers[${i}]`, 'each manufacturer loop must include 1 to 999 SF40 records (ISF-8 Note 2)');
    }
  }
  if ((input.tariffs ?? []).length > 999) fail('tariffs', 'at most 999 SF40 records (ISF-9)');

  // ── Emission ─────────────────────────────────────────────
  const lines: string[] = [];

  lines.push(
    writeRecord(SF10, {
      isfSubmissionType: input.submissionType,
      shipmentTypeCode: input.shipmentTypeCode,
      actionCode: input.action,
      actionReasonCode: input.actionReasonCode,
      isfImporterNumberQualifier: input.importer.qualifier,
      isfImporterNumber: input.importer.number,
      dateOfBirth: input.importer.dateOfBirth,
      modeOfTransportationCode: input.modeOfTransportationCode,
      isfTransactionNumber: input.isfTransactionNumber,
      scacIdentifier: input.scac,
      bondHolder: input.bond?.holder,
      bondActivityCode: input.bond?.activityCode,
      bondType: input.bond?.type,
      countryOfIssuance: input.importer.countryOfIssuance,
    }),
  );

  if (input.shipmentInfo) {
    lines.push(
      writeRecord(SF13, {
        shipmentSubType: input.shipmentInfo.subType,
        estimatedValue: zeroPad(input.shipmentInfo.estimatedValueDollars, 11, 'shipmentInfo.estimatedValueDollars'),
        estimatedQuantity: zeroPad(input.shipmentInfo.estimatedQuantity, 11, 'shipmentInfo.estimatedQuantity'),
        unitOfMeasure: input.shipmentInfo.unitOfMeasure,
        estimatedWeight: zeroPad(input.shipmentInfo.estimatedWeight, 11, 'shipmentInfo.estimatedWeight'),
        weightQualifier: input.shipmentInfo.weightQualifier,
      }),
    );
  }

  for (const bill of input.bills) {
    lines.push(
      writeRecord(SF15, {
        codeQualifier: bill.qualifier,
        shipmentReferenceIdentifier: `${bill.scac}${bill.billNumber}`,
      }),
    );
  }

  for (const ref of references) {
    lines.push(
      writeRecord(SF20, {
        referenceIdentifierQualifier: ref.qualifier,
        referenceIdentifier: ref.value,
      }),
    );
  }

  for (const [i, container] of (input.containers ?? []).entries()) {
    lines.push(
      writeRecord(SF25, {
        equipmentDescriptionCode: container.descriptionCode,
        equipmentInitial: container.initial,
        equipmentNumber: padDigits(container.number, 15, `containers[${i}].number`),
        equipmentNumberCheckDigit: container.checkDigit,
        equipmentSizeTypeCode: container.sizeTypeCode,
      }),
    );
  }

  // Non-manufacturer entity loops first, in the chapter's canonical order
  // (ISF-7 Note 1 / ISF-9 Note 1); input order is kept within a code.
  const order = isIsf10 ? ISF10_ENTITY_ORDER : ISF5_ENTITY_ORDER;
  const sortedEntities = input.entities
    .map((entity, i) => ({ entity, i }))
    .sort((a, b) => (order[a.entity.code] ?? 99) - (order[b.entity.code] ?? 99) || a.i - b.i);
  for (const { entity } of sortedEntities) {
    emitEntity(entity.code, entity, input.shipmentTypeCode, lines);
  }

  if (isIsf10) {
    // Manufacturer loops, each with 1-999 nested SF40 records (ISF-8).
    for (const mf of manufacturers) {
      emitEntity('MF', mf, input.shipmentTypeCode, lines);
      for (const [i, tariff] of mf.tariffs.entries()) emitTariff(tariff, true, i, lines);
    }
  } else {
    // ISF-5: SF40 block immediately follows the last entity loop (ISF-9).
    for (const [i, tariff] of (input.tariffs ?? []).entries()) emitTariff(tariff, false, i, lines);
    if (input.frob) {
      lines.push(
        writeRecord(SF50, {
          portOfUnladingQualifier: input.frob.portOfUnladingQualifier,
          foreignPortOfUnlading: input.frob.foreignPortOfUnlading,
          placeOfDeliveryQualifier: input.frob.placeOfDeliveryQualifier,
          placeOfDelivery: input.frob.placeOfDelivery,
        }),
      );
    }
  }

  return lines;
}
