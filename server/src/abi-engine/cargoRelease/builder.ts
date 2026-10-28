/**
 * ACE Cargo Release (SE) transaction builder — CATAIR "ACE Cargo Release"
 * chapter, July 1, 2025 Version 40 (cited as CR p.N / SE-n).
 *
 * Assembles one SE Header Grouping as 80-char record lines from a typed
 * input with a discriminated action union:
 *  - add / replace: the full input usage map (CR p.24, SE-22) — SE10,
 *    SE11?, SE13, Bill of Lading Groupings (SE15 ×≤3 each, with nested
 *    Conveyance SE16 ×≤99 and Equipment SE17 ×≤99 groupings), SE20 ×≤99,
 *    Header Level Entity Groupings ×≤12 (SE30 [+SE31 ×≤3][+SE35 ×≤3]
 *    [+SE36]), SE Line Groupings (SE40, SE41?, Line Level Entity
 *    Groupings ×≤11, HTS Groupings ×≤32 with SE61? and a per-HTS PGA
 *    grouping via buildPgaLine), and an optional Unified Entry/ISF block
 *    appended after the last SE60/PG record (CR p.30/32, SE-28/30).
 *  - update: only SE10 / SE11 / SE13 / SE15 / SE16 / SE17 / SE20 may be
 *    reported (SE10 Note 1, CR p.35). AMBIGUITY: that note's record list
 *    omits SE13, but the "U" usage map (CR p.27, SE-25) marks SE13 as
 *    Mandatory and its Note 3 says SE10+SE13 are always required — the
 *    map wins here and SE13 is emitted.
 *  - cancel ("D"): SE10 + SE13 (reason code mandatory) + SE20 only
 *    (CR p.26, SE-24), with the replacement-reference rules of SE13
 *    Note 1 (reason 02 → IB, 03 → EN, 04 → FTZ reference required).
 *
 * The chapter's N-class formatting rule is right justify and ZERO-fill
 * (CR p.23/31), unlike the ESAR (S)N convention — numeric values are
 * zero-padded here before hitting the codec. The one deliberate
 * exception is the SE20 AMT bond amount, which the chapter overrides to
 * "Left-justified … No leading Zeroes" (CR p.57: SE20AMT90000) — it
 * lives in the X-class Reference Identifier field, so it is emitted
 * left-justified verbatim.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../records/codec.js';
import { buildPgaLine, type PgaLineInput } from '../pga/builder.js';
import {
  SE10, SE11, SE13, SE15, SE16, SE17, SE20, SE30, SE31, SE35, SE36,
  SE40, SE41, SE50, SE51, SE55, SE56, SE60, SE61,
  UNIFIED_SF10, UNIFIED_SF20, UNIFIED_SF25, UNIFIED_SF30, UNIFIED_SF31, UNIFIED_SF35, UNIFIED_SF36,
  SE_ENTRY_TYPES,
  SE_IMPORTER_OF_RECORD_TYPES,
  SE_MOT_CODES,
  BOND_TYPES,
  SPLIT_SHIPMENT_RELEASE_CODES,
  CANCELLATION_REASON_CODES,
  BILL_TYPE_INDICATORS,
  SE20_REFERENCE_QUALIFIERS,
  SE_ENTITY_CODES,
  SE_ENTITY_IDENTIFIER_QUALIFIERS,
  GBI_IDENTIFIER_QUALIFIERS,
  SE_ADDRESS_COMPONENT_QUALIFIERS,
  UNIFIED_ISF_SHIPMENT_TYPES,
  UNIFIED_SF20_REFERENCE_QUALIFIERS,
} from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

export type SeEntryType = '01' | '02' | '03' | '06' | '07' | '11' | '12' | '21' | '22' | '23' | '52' | '86';
export type SeBillType = 'R' | 'M' | 'H' | 'T' | 'I';
export type SeReferenceQualifier =
  | 'CR' | 'EN' | 'IB' | 'FTZ' | 'DIS' | 'V1' | 'AMT' | 'EXP' | 'KII' | 'RRN' | 'PER' | 'CES' | 'EDA';
export type SeCancellationReasonCode =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type SeEntityCode = 'MF' | 'SE' | 'BY' | 'ST' | 'LG' | 'CS' | 'CN' | 'BKP' | 'SH' | 'EX' | 'DR' | 'PK';

/** SE13 contact block — mandatory on every action (CR p.44, SE-42). */
export interface SeContact {
  /** 40AN — class AN: letters, digits and spaces only. */
  name: string;
  /** 15AN — digits only is safest (class AN forbids '-', '(' etc.). */
  phone: string;
  /** Emits '1' + requires an SE20 DIS reference (SE13 Note 2). */
  disSubmission?: boolean;
  /** Emits '1' — the SE is associated with a split shipment (Note 3). */
  splitShipment?: boolean;
}

/** One SE15 bill of lading. */
export interface SeBill {
  /** R / M / H / T / I (CR p.46, SE-44). */
  type: SeBillType;
  /** SCAC of the bill issuer; space filled for in-bond / air / MOT 32-34, 50, 60. */
  issuerCode?: string;
  /** Bill number, AWB prefix included for air; no spaces/hyphens/slashes. */
  billNumber: string;
  /** Smallest exterior packaging unit; bill-level entered quantity (Note 2). */
  quantity?: number;
  /** 'Y' — bill will NOT be manifested via a CBP automated manifest system (Note 5). */
  nonAms?: boolean;
}

/** One SE16 conveyance / split-part manifest detail (CR p.53, SE-51). */
export interface SeConveyance {
  carrierCode: string;
  voyageFlightTrip: string;
  /** MMDDYY. */
  dateOfArrival: string;
  /** Entered quantity for this split part (Note 1). */
  quantity: number;
  unitOfMeasure?: string;
  conveyanceName?: string;
}

/**
 * One Bill of Lading Grouping (input map, CR p.24): 1-3 SE15 records —
 * [R], [T], [M,H], [I,R] or [I,M,H] per SE15 Note 1 — followed by the
 * grouping's SE16 conveyances (×≤99) and SE17 equipment (×≤99).
 */
export interface SeBillGrouping {
  bills: SeBill[];
  conveyances?: SeConveyance[];
  /** SE17 equipment numbers (SCAC prefix + serial + check digit, ≤20AN). */
  equipment?: string[];
}

export interface SeReference {
  qualifier: SeReferenceQualifier;
  value: string;
}

/** SE31/SE51 GBI Test identifier (CR p.61/70). */
export interface SeGbiIdentifier {
  qualifier: 'LEI' | 'GLN' | 'DUNS';
  value: string;
}

export interface SeAddressComponent {
  qualifier: string;
  information: string;
}

export interface SeEntityGeography {
  city: string;
  countrySubEntityCode?: string;
  postalCode?: string;
  countryCode: string;
}

/**
 * One entity grouping (header SE30-SE36 or line SE50-SE56). Reported by
 * name+address (SE35/SE36 mandatory) or by identifier (SE30/SE50 only) —
 * never both (CR p.58/62/63). Identifiers are restricted to BY/ST/CN
 * (Note 3); CN by name+address is a low-value special case (types 11/86).
 */
export interface SeEntity {
  code: SeEntityCode;
  name?: string;
  identifier?: { qualifier: 'EI' | 'ANI' | '34'; value: string };
  /** GBI Test only; ≤3, emitted immediately after the SE30/SE50. */
  gbiIdentifiers?: SeGbiIdentifier[];
  /** ≤6 components → ≤3 SE35/SE55 records; mandatory with a name. */
  addressComponents?: SeAddressComponent[];
  /** SE36/SE56; mandatory with a name. */
  geography?: SeEntityGeography;
}

/** One HTS Grouping: SE60 + optional SE61 + optional per-HTS PGA set. */
export interface SeTariff {
  /** 10AN HTS number (SE60 Notes 1/2 for TIB pairs and chapter 99). */
  htsNumber: string;
  /** Line item value in whole US dollars (SE60 Note 3). */
  valueDollars?: number;
  /**
   * SE61 current HTS for Privileged Foreign merchandise whose declared
   * HTS is no longer active (CR p.74, SE-72). Type 06 + zone status P only.
   */
  currentHtsNumber?: string;
  /**
   * PGA Message Set for this HTS code — the OI + PG records emitted
   * directly after this HTS grouping ("the PG record that is associated
   * with the … SE60 record", CR p.30/32; PGA Grouping nests inside the
   * HTS grouping in the input map, CR p.24).
   */
  pga?: PgaLineInput;
}

/** SE41 FTZ status — entry type 06 only, mandatory per line (CR p.65). */
export interface SeFtzStatus {
  /** P or N — D/Z are not used on type 06 consumption entries (Note 1). */
  zoneStatus: 'P' | 'N';
  /** MMDDYY PF grant date; only when the declared HTS is inactive (Note 2). */
  privilegedFilingDate?: string;
  /** Whole units of this HTS line removed from the FTZ, > 0. */
  quantity: number;
}

/** One SE Line Grouping. */
export interface SeLine {
  /** ISO country of origin (SE40). */
  countryOfOrigin: string;
  /** Commercial invoice description (SE40, 70X). */
  description?: string;
  /** SE41 — entry type 06 only. */
  ftz?: SeFtzStatus;
  /** Line Level Entity Groupings ×≤11 (SE50-SE56). */
  entities?: SeEntity[];
  /** HTS Groupings ×1-32 (v40 raised the loop from 16 to 32). */
  tariffs: SeTariff[];
}

/** SE11 additional header (CR p.39-43, SE-37..41). */
export interface SeAdditionalHeader {
  /** 'W' = Weekly Entry (entry type 06 only). */
  entryDateElectionCode?: 'W';
  /** MMDDYY; mandatory with election code W (Note 1). */
  electedEntryDate?: string;
  locationOfGoodsFirms?: string;
  electedExamSiteFirms?: string;
  /** Conveyance name, or the FTZ ID for type 06 (FTZ… format, Note 6). */
  conveyanceNameOrFtzId?: string;
  voyageFlightTrip?: string;
  generalOrderNumber?: string;
  /** FIRMS of the CBP Bonded Warehouse — mandatory for types 21/22 (Note 2). */
  bondedWarehouseFirms?: string;
  /** Originating warehouse entry — mandatory for type 22 (Note 3). */
  originatingWarehouseEntry?: { filerCode: string; entryNumber: string };
  /** Immediate Delivery request (Notes 8/9; not allowed on warehouse types). */
  immediateDelivery?: boolean;
}

/** Unified Entry/ISF entity loop (CR p.80-81, SE-78..79). */
export interface UnifiedIsfEntity {
  /** MF/SE/BY/ST/CS/LG/CN — IM is created by CBP and must not be sent. */
  code: 'MF' | 'SE' | 'BY' | 'ST' | 'CS' | 'LG' | 'CN';
  name?: string;
  /** SF31 secondary name (ALA/DH/DV/NU/NV/XD); name route only. */
  secondaryName?: { code: string; name: string };
  /** EI/ANI/CIN/34 for CN; FR (FIRMS) for ST (CR p.81 Note 2). */
  identifier?: { qualifier: 'EI' | 'ANI' | 'CIN' | '34' | 'FR'; value: string };
  addressComponents?: SeAddressComponent[];
  geography?: SeEntityGeography;
}

/** Unified Entry/ISF block appended after the last SE60/PG record (CR p.30/32). */
export interface UnifiedIsfInput {
  /** 01/02/04/07/09/10 (CR p.76 Note 2). Submission type is always 1. */
  shipmentTypeCode: '01' | '02' | '04' | '07' | '09' | '10';
  action: 'A' | 'D' | 'R';
  /** CBP-assigned FFF-NNNNNNNNNNN; required for D, space filled on A. */
  isfTransactionNumber?: string;
  /** Must be the same entity/number as the SE10 Importer of Record (Note 4). */
  importer: { qualifier: 'EI' | 'ANI' | '34'; number: string };
  /** 10 break bulk | 11 containerized. */
  modeOfTransportationCode?: '10' | '11';
  /** SCAC of the vessel operator. */
  scac?: string;
  /** SF20 ×≤999 — SBN / V1 / CR only (CR p.78). */
  references?: { qualifier: 'SBN' | 'V1' | 'CR'; value: string }[];
  /** SF25 ×≤999. */
  containers?: {
    descriptionCode: string;
    initial: string;
    number: string;
    checkDigit?: string;
    sizeTypeCode?: string;
  }[];
  /** Entity loops — MF, SE, BY, ST, CS, LG and CN are all required (Note 1). */
  entities: UnifiedIsfEntity[];
}

interface SeHeaderBase {
  /** CBP-assigned filer code; must match the B-record filer (CR p.33). */
  filerCode: string;
  /** 8AN entry number (without the filer-code prefix or check digit hyphens). */
  entryNumber: string;
  entryType: SeEntryType;
  importerOfRecord?: { type: 'EI' | 'ANI' | '34'; number: string };
  /** Mode of transportation (SE10 Note 5); required except type 06 without bills (Note 11). */
  motCode?: string;
  /** 0 = none, 8 = continuous, 9 = single transaction (Note 6). */
  bondType: '0' | '8' | '9';
  /** Total entered value in whole US dollars (≤$800 type 86, ≤$2500 type 11 — Note 13). */
  estimatedValueDollars: number;
  /** Schedule D Planned Port of Entry (Note 7 lists when mandatory). */
  plannedPortOfEntry?: string;
  /** 1 = Hold All, 2 = Incremental ID release (Note 8). */
  splitShipmentReleaseCode?: '1' | '2';
  /** Schedule D; required for MOT 50/60/70. */
  portOfUnlading?: string;
  contact: SeContact;
  /** SE20 ×≤99. */
  references?: SeReference[];
}

export interface CargoReleaseAddReplaceInput extends SeHeaderBase {
  action: 'add' | 'replace';
  additionalHeader?: SeAdditionalHeader;
  /** Bill of Lading Groupings ×≤999. */
  billGroupings?: SeBillGrouping[];
  /** Header Level Entity Groupings ×≤12. */
  headerEntities?: SeEntity[];
  /** SE Line Groupings ×1-999. */
  lines: SeLine[];
  /** Unified Entry/ISF filing appended after the last SE60/PG record. */
  unifiedIsf?: UnifiedIsfInput;
}

export interface CargoReleaseUpdateInput extends SeHeaderBase {
  action: 'update';
  additionalHeader?: SeAdditionalHeader;
  billGroupings?: SeBillGrouping[];
}

export interface CargoReleaseCancelInput extends SeHeaderBase {
  action: 'cancel';
  cancellation: {
    reasonCode: SeCancellationReasonCode;
    /** Emits '1' — multiple cargo dispositions exist besides the reason code. */
    multipleCargoDispositions?: boolean;
  };
}

export type CargoReleaseInput = CargoReleaseAddReplaceInput | CargoReleaseUpdateInput | CargoReleaseCancelInput;

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'CargoRelease', field, message };
  throw new RecordCodecError([issue]);
}

/** Zero-fill per the chapter's N formatting rule (CR p.23/31). */
function zeroFill(value: number, width: number, field: string, opts: { min?: number } = {}): string {
  const min = opts.min ?? 0;
  if (!Number.isInteger(value) || value < min) {
    fail(field, `must be a whole number ${min > 0 ? 'greater than zero' : '>= 0'}, got ${value}`);
  }
  const s = String(value);
  if (s.length > width) fail(field, `value ${s} exceeds ${width} digits`);
  return s.padStart(width, '0');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** SE20 per-qualifier format validators (CR p.56-57 Note 1). */
const SE20_FORMATS: Record<string, RegExp> = {
  CR: /^.{1,9}$/,
  EN: /^[A-Z0-9]{3}[0-9]{8}$/, // FFFNNNNNNNN, no hyphens
  IB: /^(?:[0-9]{9}|[0-9]{11}|[A-Z0-9]{3}[0-9]{8})$/,
  FTZ: /^[A-Z0-9 ]{1,19}$/,
  DIS: /^.{1,50}$/,
  V1: /^[A-Z0-9]{1,3}$/,
  // Left-justified integer, no leading zeroes, > 0, ≤10 digits (CR p.57).
  AMT: /^[1-9][0-9]{0,9}$/,
  EXP: /^Y$/,
  KII: /^Y$/,
  RRN: /^.{1,50}$/,
  PER: /^Y$/,
  CES: /^[A-Z0-9]{1,11}$/,
  EDA: /^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{2}$/, // MMDDYY
};

/** MOTs that force the Non-AMS indicator to 'Y' (SE15 Note 5, CR p.50). */
const NON_AMS_MANDATORY_MOTS = new Set(['32', '33', '34', '50', '60', '70']);

/** Entry types for which the Planned Port of Entry is mandatory (SE10 Note 7). */
const POE_MANDATORY_ENTRY_TYPES = new Set(['02', '06', '07', '12', '21', '22', '23', '86']);

/** MOTs for which the Port of Unlading is required (SE10, CR p.34). */
const POU_MANDATORY_MOTS = new Set(['50', '60', '70']);

// ── Shared validation + emission pieces ────────────────────

function validateHeader(input: CargoReleaseInput): void {
  if (!SE_ENTRY_TYPES[input.entryType]) {
    fail('entryType', `unknown entry type '${input.entryType}' (SE10 Note 2, CR p.35)`);
  }
  if (!BOND_TYPES[input.bondType]) {
    fail('bondType', `unknown bond type '${input.bondType}' (SE10 Note 6, CR p.36)`);
  }
  if (input.importerOfRecord && !SE_IMPORTER_OF_RECORD_TYPES[input.importerOfRecord.type]) {
    fail('importerOfRecord.type', `unknown importer of record type '${input.importerOfRecord.type}' (SE10 Note 3)`);
  }
  if (input.motCode !== undefined && !SE_MOT_CODES[input.motCode]) {
    fail('motCode', `unknown mode of transportation '${input.motCode}' (SE10 Note 5)`);
  }
  if (input.splitShipmentReleaseCode && !SPLIT_SHIPMENT_RELEASE_CODES[input.splitShipmentReleaseCode]) {
    fail('splitShipmentReleaseCode', `unknown split shipment release code (SE10 Note 8)`);
  }
  if (input.motCode && POU_MANDATORY_MOTS.has(input.motCode) && !input.portOfUnlading) {
    fail('portOfUnlading', `port of unlading is required for MOT ${input.motCode} (SE10, CR p.34)`);
  }
  // Entry value caps (SE10 Note 13, CR p.38).
  if (input.entryType === '86' && input.estimatedValueDollars > 800) {
    fail('estimatedValueDollars', `entry value cannot exceed $800 for type 86 entries, got ${input.estimatedValueDollars} (SE10 Note 13)`);
  }
  if (input.entryType === '11' && input.estimatedValueDollars > 2500) {
    fail('estimatedValueDollars', `entry value cannot exceed $2500 for type 11 entries, got ${input.estimatedValueDollars} (SE10 Note 13)`);
  }

  const references = input.references ?? [];
  if (references.length > 99) fail('references', 'at most 99 SE20 records (input map, CR p.24)');
  for (const [i, ref] of references.entries()) {
    const table = SE20_REFERENCE_QUALIFIERS[ref.qualifier];
    if (!table) fail(`references[${i}]`, `unknown reference identifier qualifier '${ref.qualifier}' (SE20 Note 1)`);
    const format = SE20_FORMATS[ref.qualifier];
    if (format && !format.test(ref.value)) {
      fail(`references[${i}]`, `${ref.qualifier} reference '${ref.value}' violates the required format ${table.format} (SE20 Note 1, CR p.56-57)`);
    }
  }
  const hasRef = (q: string) => references.some((r) => r.qualifier === q);

  // Bond type 9: both V1 (surety) and AMT (bond amount) are mandatory
  // (SE10 Note 6, CR p.36; SE20 Note 1, CR p.57).
  if (input.bondType === '9' && (!hasRef('V1') || !hasRef('AMT'))) {
    fail('references', 'bond type 9 requires SE20 records for both V1 (surety code) and AMT (bond amount) (SE10 Note 6)');
  }
  // DIS indicator requires the DIS reference (SE13 Note 2, CR p.45).
  if (input.contact.disSubmission && !hasRef('DIS')) {
    fail('references', "a DIS (filer-defined DIS reference number) SE20 record is required when the SE13 DIS indicator is '1' (SE13 Note 2)");
  }
}

function emitSe10(input: CargoReleaseInput, actionCode: 'A' | 'R' | 'U' | 'D'): string {
  return writeRecord(SE10, {
    actionCode,
    entryFilerCode: input.filerCode,
    entryNumber: input.entryNumber,
    entryType: input.entryType,
    importerOfRecordType: input.importerOfRecord?.type,
    importerOfRecord: input.importerOfRecord?.number,
    modeOfTransportation: input.motCode,
    bondType: input.bondType,
    estimatedEntryValue: zeroFill(input.estimatedValueDollars, 10, 'estimatedValueDollars'),
    plannedPortOfEntry: input.plannedPortOfEntry,
    splitShipmentReleaseCode: input.splitShipmentReleaseCode,
    portOfUnlading: input.portOfUnlading,
  });
}

function emitSe13(input: CargoReleaseInput, reasonCode?: string, multipleDispositions?: boolean): string {
  return writeRecord(SE13, {
    contactName: input.contact.name,
    contactPhone: input.contact.phone,
    reasonCode,
    multipleCargoDispositionsIndicator: multipleDispositions ? '1' : undefined,
    disIndicator: input.contact.disSubmission ? '1' : undefined,
    splitShipmentIndicator: input.contact.splitShipment ? '1' : undefined,
  });
}

function emitSe11(header: SeAdditionalHeader, input: CargoReleaseInput, lines: string[]): void {
  if (header.entryDateElectionCode === 'W') {
    if (input.entryType !== '06') {
      fail('additionalHeader.entryDateElectionCode', "election code 'W' (Weekly Entry) is only reported on entry type 06 (SE11, CR p.39)");
    }
    if (!header.electedEntryDate) {
      fail('additionalHeader.electedEntryDate', "an entry date must be provided if 'W' is selected for Entry Date Election Code (SE11 Note 1)");
    }
  }
  if (header.immediateDelivery && (input.entryType === '21' || input.entryType === '22')) {
    fail('additionalHeader.immediateDelivery', 'the ID procedure is not allowed on Warehouse entry types (SE11 Note 9)');
  }
  lines.push(
    writeRecord(SE11, {
      entryDateElectionCode: header.entryDateElectionCode,
      electedEntryDate: header.electedEntryDate,
      locationOfGoodsFirms: header.locationOfGoodsFirms,
      electedExamSiteFirms: header.electedExamSiteFirms,
      conveyanceNameOrFtzId: header.conveyanceNameOrFtzId,
      voyageFlightTripNumber: header.voyageFlightTrip,
      generalOrderNumber: header.generalOrderNumber,
      bondedWarehouseFirms: header.bondedWarehouseFirms,
      originatingWarehouseEntryFilerCode: header.originatingWarehouseEntry?.filerCode,
      originatingWarehouseEntryNumber: header.originatingWarehouseEntry?.entryNumber,
      immediateDeliveryIndicator: header.immediateDelivery === undefined ? undefined : header.immediateDelivery ? 'Y' : 'N',
    }),
  );
}

/** Valid SE15 sequences within one grouping (SE15 Note 1, CR p.48-49). */
const BILL_PATTERNS = new Set(['R', 'T', 'MH', 'IR', 'IMH']);

function emitBillGrouping(
  grouping: SeBillGrouping,
  gi: number,
  input: CargoReleaseInput,
  lines: string[],
): void {
  const at = `billGroupings[${gi}]`;
  if (grouping.bills.length === 0 || grouping.bills.length > 3) {
    fail(at, '1 to 3 SE15 records per Bill of Lading Grouping (input map, CR p.24)');
  }
  const pattern = grouping.bills.map((b) => b.type).join('');
  if (!BILL_PATTERNS.has(pattern)) {
    fail(at, `bill sequence '${pattern}' is not a valid grouping — use R, T, M+H, I+R or I+M+H (SE15 Note 1)`);
  }

  for (const [bi, bill] of grouping.bills.entries()) {
    const billAt = `${at}.bills[${bi}]`;
    if (!BILL_TYPE_INDICATORS[bill.type]) fail(billAt, `unknown bill type indicator '${bill.type}' (SE15)`);
    if (bill.type === 'I') {
      // In-bond SE15: no quantity (bill level only) and never Non-AMS
      // (SE15 Notes 1 and 5).
      if (bill.quantity !== undefined) fail(billAt, 'an in-bond (I) SE15 record must not contain a Quantity (SE15 Note 1)');
      if (bill.nonAms) fail(billAt, "if the Bill Type Indicator is 'I', the Non-AMS indicator must be 'N' (SE15 Note 5)");
    }
    if (bill.type === 'T') {
      // Note 7 (CR p.51): T cannot be Non-AMS and is not allowed for 86.
      if (bill.nonAms) fail(billAt, "bill type 'T' cannot be a Non-AMS bill (SE15 Note 7)");
      if (input.entryType === '86') fail(billAt, "bill type 'T' is not allowed for type 86 entries (SE15 Note 7)");
    }
    if (input.motCode && NON_AMS_MANDATORY_MOTS.has(input.motCode) && bill.type !== 'I' && !bill.nonAms) {
      fail(billAt, `the Non-AMS indicator must be 'Y' for MOT ${input.motCode} (SE15 Note 5)`);
    }
    if (input.entryType === '86' && bill.type !== 'I' && bill.type !== 'M' && bill.quantity === undefined) {
      fail(billAt, 'bill quantity is mandatory for entry type 86 (SE15 Note 11)');
    }
    if (bill.nonAms && (grouping.conveyances ?? []).length === 0) {
      fail(billAt, "when 'Y' is declared for the Non-AMS indicator, use of the SE16 record is mandatory (SE15 Note 6)");
    }
    lines.push(
      writeRecord(SE15, {
        billTypeIndicator: bill.type,
        billIssuerCode: bill.issuerCode,
        billOfLadingNumber: bill.billNumber,
        quantity: bill.quantity === undefined ? undefined : zeroFill(bill.quantity, 8, `${billAt}.quantity`, { min: 1 }),
        nonAmsIndicator: bill.nonAms ? 'Y' : 'N',
      }),
    );
  }

  const conveyances = grouping.conveyances ?? [];
  if (conveyances.length > 99) fail(at, 'at most 99 SE16 conveyance records per grouping (input map, CR p.24)');
  if (conveyances.length > 0 && input.entryType === '06') {
    fail(at, 'the SE16 record is not used for entry type 06 FTZ (CR p.53)');
  }
  for (const [ci, conveyance] of conveyances.entries()) {
    lines.push(
      writeRecord(SE16, {
        carrierCode: conveyance.carrierCode,
        voyageFlightTripNumber: conveyance.voyageFlightTrip,
        dateOfArrival: conveyance.dateOfArrival,
        quantity: zeroFill(conveyance.quantity, 8, `${at}.conveyances[${ci}].quantity`, { min: 1 }),
        unitOfMeasure: conveyance.unitOfMeasure,
        conveyanceName: conveyance.conveyanceName,
      }),
    );
  }

  const equipment = grouping.equipment ?? [];
  if (equipment.length > 99) fail(at, 'at most 99 SE17 equipment records per grouping (input map, CR p.24)');
  if (equipment.length > 0 && input.entryType === '06') {
    fail(at, 'the SE17 record is not used for entry type 06 FTZ (CR p.55)');
  }
  for (const unit of equipment) {
    lines.push(writeRecord(SE17, { equipmentNumber: unit }));
  }
}

function emitReferences(input: CargoReleaseInput, lines: string[]): void {
  for (const ref of input.references ?? []) {
    lines.push(
      writeRecord(SE20, {
        referenceIdentifierQualifier: ref.qualifier,
        referenceIdentifier: ref.value,
      }),
    );
  }
}

/** Record set for one entity level (header SE30-36 vs line SE50-56). */
const HEADER_ENTITY_DEFS = { entity: SE30, gbi: SE31, address: SE35, geo: SE36 } as const;
const LINE_ENTITY_DEFS = { entity: SE50, gbi: SE51, address: SE55, geo: SE56 } as const;

function emitEntity(
  defs: typeof HEADER_ENTITY_DEFS | typeof LINE_ENTITY_DEFS,
  entity: SeEntity,
  entryType: string,
  label: string,
  lines: string[],
): void {
  if (!SE_ENTITY_CODES[entity.code]) fail(label, `unknown entity code '${entity.code}' (SE30/SE50 Note 1)`);
  if (defs === LINE_ENTITY_DEFS && entity.code === 'BKP') {
    fail(label, 'BKP (Booking Party) is not a line-level entity code (SE50 Note 1, CR p.68)');
  }
  const hasName = entity.name !== undefined && entity.name !== '';
  const hasIdentifier = entity.identifier !== undefined;
  if (hasName === hasIdentifier) {
    fail(label, 'either an Entity Name or an Entity Identifier must be provided, never both (SE30/SE50, CR p.58/67)');
  }

  if (hasIdentifier) {
    const q = entity.identifier!.qualifier;
    if (!SE_ENTITY_IDENTIFIER_QUALIFIERS[q]) fail(label, `unknown entity identifier qualifier '${q}' (Note 3)`);
    if (!['BY', 'ST', 'CN'].includes(entity.code)) {
      fail(label, `identifier qualifier ${q} may only be used with Entity Codes BY, ST, or CN (SE30/SE50 Note 3)`);
    }
    if (entity.addressComponents?.length || entity.geography) {
      fail(label, 'the SE35/SE36 (SE55/SE56) records are not used when an Entity Identifier is reported (CR p.62/63)');
    }
  } else {
    // Name route. CN by name+address is the low-value special case for
    // entry types 11 and 86 only (SE30/SE50 Note 2, CR p.60/69).
    if (entity.code === 'CN' && entryType !== '11' && entryType !== '86') {
      fail(label, 'Consignee (CN) name and address may only be reported for low value entry types 11 and 86; otherwise report an identifier (SE30 Note 2)');
    }
    const components = entity.addressComponents ?? [];
    if (components.length === 0) fail(label, 'address components (SE35/SE55) are mandatory when an Entity Name is reported (CR p.62/71)');
    if (components.length > 6) fail(label, 'at most 3 SE35/SE55 records (6 address components) per entity (input map, CR p.24)');
    for (const component of components) {
      if (!SE_ADDRESS_COMPONENT_QUALIFIERS[component.qualifier]) {
        fail(label, `unknown address component qualifier '${component.qualifier}' (SE35/SE55 Note 1)`);
      }
    }
    if (!entity.geography) fail(label, 'the city/country record (SE36/SE56) is mandatory when an Entity Name is reported (CR p.63/72)');
  }

  const gbi = entity.gbiIdentifiers ?? [];
  if (gbi.length > 3) fail(label, 'at most 3 GBI identifier records per entity (input map, CR p.24)');
  for (const g of gbi) {
    if (!GBI_IDENTIFIER_QUALIFIERS[g.qualifier]) fail(label, `unknown GBI identifier qualifier '${g.qualifier}' (SE31/SE51 Note 1)`);
  }

  lines.push(
    writeRecord(defs.entity, {
      entityCode: entity.code,
      entityName: entity.name,
      entityIdentifierQualifier: entity.identifier?.qualifier,
      entityIdentifier: entity.identifier?.value,
    }),
  );
  // "applicable SE31/SE51 Records must be submitted immediately following
  // the SE30/SE50" (CR p.61/70).
  for (const g of gbi) {
    lines.push(writeRecord(defs.gbi, { gbiIdentifierQualifier: g.qualifier, gbiIdentifier: g.value }));
  }
  if (hasName) {
    for (const pair of chunk(entity.addressComponents ?? [], 2)) {
      lines.push(
        writeRecord(defs.address, {
          addressComponentQualifier1: pair[0].qualifier,
          addressInformation1: pair[0].information,
          addressComponentQualifier2: pair[1]?.qualifier,
          addressInformation2: pair[1]?.information,
        }),
      );
    }
    const geo = entity.geography!;
    lines.push(
      writeRecord(defs.geo, {
        cityName: geo.city,
        countrySubEntityCode: geo.countrySubEntityCode,
        postalCode: geo.postalCode,
        countryCode: geo.countryCode,
      }),
    );
  }
}

function assertEntityCodesUnique(entities: SeEntity[], label: string): void {
  const seen = new Set<string>();
  for (const entity of entities) {
    if (seen.has(entity.code)) {
      fail(label, `each Entity Code may be reported a maximum of one time at this level; ${entity.code} repeats (SE30/SE50 Note 1)`);
    }
    seen.add(entity.code);
  }
}

function emitLine(line: SeLine, li: number, input: CargoReleaseAddReplaceInput, lines: string[]): void {
  const at = `lines[${li}]`;

  lines.push(
    writeRecord(SE40, {
      lineItemIdentifier: zeroFill(li + 1, 3, `${at}.lineItemIdentifier`, { min: 1 }),
      countryOfOrigin: line.countryOfOrigin,
      commercialInvoiceDescription: line.description,
    }),
  );

  // SE41 — used only for entry type 06 FTZ, where it is mandatory per
  // line; zone statuses D/Z are not used on consumption entries (CR p.65).
  if (input.entryType === '06') {
    if (!line.ftz) fail(at, 'the SE41 record is mandatory for every line of an entry type 06 FTZ (CR p.65)');
  } else if (line.ftz) {
    fail(at, 'the SE41 record is used only for entry type 06 FTZ — do not submit if not required (CR p.65)');
  }
  if (line.ftz) {
    if (line.ftz.zoneStatus !== 'P' && line.ftz.zoneStatus !== 'N') {
      fail(at, 'zone status must be P (Privileged) or N (Non-privileged) on a type 06 consumption entry (SE41 Note 1)');
    }
    if (line.ftz.privilegedFilingDate && line.ftz.zoneStatus !== 'P') {
      fail(at, 'the Privileged FTZ Merchandise Filing Date is space filled if not Privileged Foreign (SE41, CR p.65)');
    }
    lines.push(
      writeRecord(SE41, {
        zoneStatus: line.ftz.zoneStatus,
        privilegedFilingDate: line.ftz.privilegedFilingDate,
        ftzLineItemQuantity: zeroFill(line.ftz.quantity, 8, `${at}.ftz.quantity`, { min: 1 }),
      }),
    );
  }

  const entities = line.entities ?? [];
  if (entities.length > 11) fail(at, 'at most 11 Line Level Entity Groupings per line (input map, CR p.24)');
  assertEntityCodesUnique(entities, `${at}.entities`);
  for (const entity of entities) {
    emitEntity(LINE_ENTITY_DEFS, entity, input.entryType, `${at}.entities[${entity.code}]`, lines);
  }

  // ── HTS Groupings (1-32 since v40) ───────────────────────
  if (line.tariffs.length === 0) fail(at, 'at least one SE60 HTS record is required per line (input map, CR p.24)');
  if (line.tariffs.length > 32) fail(at, 'at most 32 HTS Groupings per line (input map, CR p.24 — raised from 16 in v40)');

  // Type 23 TIB: SE60 records come in pairs, 9813 first (SE60 Note 1).
  if (input.entryType === '23') {
    if (line.tariffs.length < 2 || line.tariffs.length % 2 !== 0) {
      fail(at, 'entry type 23 TIB requires SE60 records in pairs — a 9813 HTS followed by the merchandise HTS (SE60 Note 1)');
    }
    for (let i = 0; i < line.tariffs.length; i += 2) {
      if (!line.tariffs[i].htsNumber.startsWith('9813')) {
        fail(at, `entry type 23 TIB pairs must lead with a 9813 HTS number; pair ${i / 2 + 1} starts with '${line.tariffs[i].htsNumber}' (SE60 Note 1)`);
      }
      if (line.tariffs[i + 1].htsNumber.startsWith('9813')) {
        fail(at, 'the second SE60 of a TIB pair must identify the merchandise being imported, not another 9813 number (SE60 Note 1)');
      }
    }
  }

  // Chapter 99 ordering: 99 HTS numbers first, entered value on the
  // chapter 1-97 commodity classification (SE60 Note 2).
  const isCh99 = (t: SeTariff) => t.htsNumber.startsWith('99');
  const hasCh99 = line.tariffs.some(isCh99);
  const hasCommodity = line.tariffs.some((t) => !isCh99(t));
  if (hasCh99 && hasCommodity) {
    const lastCh99 = line.tariffs.map(isCh99).lastIndexOf(true);
    const firstCommodity = line.tariffs.map(isCh99).indexOf(false);
    if (firstCommodity < lastCh99) {
      fail(at, 'chapter 99 HTS numbers must be reported before the chapter 1-97 commodity tariff (SE60 Note 2)');
    }
    for (const t of line.tariffs.filter(isCh99)) {
      if (t.valueDollars !== undefined) {
        fail(at, 'the entered value is reported on the chapter 1-97 HTS classification, not the chapter 99 number (SE60 Note 2)');
      }
    }
  }

  // Line value mandatory: for type 86 always; and when the Consignee name
  // and address immediately precede (SE60 Note 3) — approximated as: a
  // name-and-address CN at header or on this line.
  const cnByName = (e: SeEntity) => e.code === 'CN' && e.identifier === undefined;
  const consigneeNameProvided = (input.headerEntities ?? []).some(cnByName) || entities.some(cnByName);
  for (const [ti, tariff] of line.tariffs.entries()) {
    const tAt = `${at}.tariffs[${ti}]`;
    if (!/^[0-9]{4,10}$/.test(tariff.htsNumber)) {
      fail(tAt, `HTS number must be up to 10 digits, got '${tariff.htsNumber}' (SE60)`);
    }
    if (tariff.valueDollars === undefined && !isCh99(tariff)) {
      if (input.entryType === '86') fail(tAt, 'the line value is mandatory for type 86 entries (SE60 Note 3)');
      if (consigneeNameProvided) {
        fail(tAt, 'reporting the Line Value is mandatory when the Consignee Name and Address is provided (SE60 Note 3)');
      }
    }
    lines.push(
      writeRecord(SE60, {
        htsNumber: tariff.htsNumber,
        lineItemValue: tariff.valueDollars === undefined ? undefined : zeroFill(tariff.valueDollars, 10, `${tAt}.valueDollars`),
      }),
    );
    if (tariff.currentHtsNumber !== undefined) {
      if (line.ftz?.zoneStatus !== 'P') {
        fail(tAt, 'the SE61 record is reported only when Privileged Foreign status is declared in the preceding SE41 record (CR p.74)');
      }
      lines.push(writeRecord(SE61, { currentHtsNumber: tariff.currentHtsNumber }));
    }
    if (tariff.pga) lines.push(...buildPgaLine(tariff.pga));
  }
}

// ── Unified Entry/ISF block ────────────────────────────────

/** Entity codes for which an SF30 loop is required in a unified ISF-10 (CR p.76 Note 1; IM is CBP-created). */
const UNIFIED_REQUIRED_ENTITIES: readonly UnifiedIsfEntity['code'][] = ['MF', 'SE', 'BY', 'ST', 'CS', 'LG', 'CN'];

function emitUnifiedIsf(isf: UnifiedIsfInput, input: CargoReleaseAddReplaceInput, lines: string[]): void {
  if (!UNIFIED_ISF_SHIPMENT_TYPES[isf.shipmentTypeCode]) {
    fail('unifiedIsf.shipmentTypeCode', `unknown unified ISF shipment type '${isf.shipmentTypeCode}' (CR p.76 Note 2)`);
  }
  // Rule 9 (CR p.20) / SF10 Note 4: the ISF Importer and the Entry
  // Importer of Record must be the same entity with the same number.
  if (input.importerOfRecord && isf.importer.number !== input.importerOfRecord.number) {
    fail('unifiedIsf.importer', `the ISF Importer (${isf.importer.number}) must be the same entity as the SE10 Importer of Record (${input.importerOfRecord.number}) (SF10 Note 4, CR p.76)`);
  }

  if (isf.action === 'D') {
    // "For Action Code 'D', only the SF10 record is required … with the
    // ISF transaction number previously provided" (CR p.76 Note 3).
    if (!isf.isfTransactionNumber) {
      fail('unifiedIsf.isfTransactionNumber', "a unified ISF Delete requires the CBP-assigned ISF transaction number (CR p.76 Note 3)");
    }
    lines.push(
      writeRecord(UNIFIED_SF10, {
        shipmentTypeCode: isf.shipmentTypeCode,
        actionCode: 'D',
        isfImporterNumberQualifier: isf.importer.qualifier,
        isfImporterNumber: isf.importer.number,
        isfTransactionNumber: isf.isfTransactionNumber,
      }),
    );
    return;
  }

  if (isf.action === 'A' && isf.isfTransactionNumber) {
    fail('unifiedIsf.isfTransactionNumber', "the ISF Transaction Number is space filled when the Action Code is 'A' (SF10, CR p.75)");
  }
  const references = isf.references ?? [];
  for (const [i, ref] of references.entries()) {
    if (!UNIFIED_SF20_REFERENCE_QUALIFIERS[ref.qualifier]) {
      fail(`unifiedIsf.references[${i}]`, `unified ISF SF20 qualifiers are SBN, V1 and CR only; got '${ref.qualifier}' (CR p.78 Note 1)`);
    }
  }
  for (const code of UNIFIED_REQUIRED_ENTITIES) {
    if (!isf.entities.some((e) => e.code === code)) {
      fail('unifiedIsf.entities', `the unified SF data set must have an SF30 record for entity code ${code} (CR p.76 Note 1)`);
    }
  }
  if ((isf.entities as { code: string }[]).some((e) => e.code === 'IM')) {
    fail('unifiedIsf.entities', 'an SF30 with Entity Code IM should not be included — the CBP system creates it from the SF10 ISF Importer (CR p.80)');
  }

  // SF10 with the mandatory 'CT' reason for A/R (CR p.76 Note 3); the
  // bond fields are space filled — bond data comes from the Entry
  // (CR p.77 Note 5).
  lines.push(
    writeRecord(UNIFIED_SF10, {
      shipmentTypeCode: isf.shipmentTypeCode,
      actionCode: isf.action,
      actionReasonCode: 'CT',
      isfImporterNumberQualifier: isf.importer.qualifier,
      isfImporterNumber: isf.importer.number,
      modeOfTransportationCode: isf.modeOfTransportationCode,
      isfTransactionNumber: isf.action === 'R' ? isf.isfTransactionNumber : undefined,
      scacIdentifier: isf.scac,
    }),
  );
  for (const ref of references) {
    lines.push(
      writeRecord(UNIFIED_SF20, {
        referenceIdentifierQualifier: ref.qualifier,
        referenceIdentifier: ref.value,
      }),
    );
  }
  for (const [i, container] of (isf.containers ?? []).entries()) {
    if (!/^[0-9]+$/.test(container.number)) {
      fail(`unifiedIsf.containers[${i}]`, `equipment number must be numeric, got '${container.number}' (SF25, CR p.79)`);
    }
    lines.push(
      writeRecord(UNIFIED_SF25, {
        equipmentDescriptionCode: container.descriptionCode,
        equipmentInitial: container.initial,
        equipmentNumber: container.number.padStart(15, '0'),
        equipmentNumberCheckDigit: container.checkDigit,
        equipmentSizeTypeCode: container.sizeTypeCode,
      }),
    );
  }
  for (const entity of isf.entities) {
    emitUnifiedEntity(entity, lines);
  }
}

function emitUnifiedEntity(entity: UnifiedIsfEntity, lines: string[]): void {
  const label = `unifiedIsf.entities[${entity.code}]`;
  const hasName = entity.name !== undefined && entity.name !== '';
  const hasIdentifier = entity.identifier !== undefined;
  if (hasName === hasIdentifier) {
    fail(label, 'only either an Entity Name or an Entity Identifier can be provided for each SF30 (CR p.83)');
  }
  if (entity.code === 'CN' && !hasIdentifier) {
    fail(label, 'the Consignee (CN) is reported using an identifier in an importer of record number format (CR p.81 Note 1)');
  }
  if (hasIdentifier) {
    const q = entity.identifier!.qualifier;
    if (q === 'FR') {
      if (entity.code !== 'ST') fail(label, 'the FR (FIRMS) qualifier may only be used with Entity Code ST (CR p.81 Note 2)');
    } else if (entity.code !== 'CN') {
      fail(label, `identifier qualifier ${q} may only be used with Entity Code CN (CR p.81 Note 2)`);
    }
    if (entity.secondaryName || entity.addressComponents?.length || entity.geography) {
      fail(label, 'if the SF30 contains an Entity Identifier, the SF31, SF35 and SF36 records are not used (CR p.81 Note 2)');
    }
  } else {
    if (!entity.addressComponents?.length) fail(label, 'the SF35 records are mandatory when an Entity Name is reported (CR p.83)');
    if (entity.addressComponents.length > 6) fail(label, 'at most 3 SF35 records (6 address components) per entity (CR p.32)');
    if (!entity.geography) fail(label, 'the SF36 record is mandatory when an Entity Name is reported (CR p.84)');
  }
  lines.push(
    writeRecord(UNIFIED_SF30, {
      entityCode: entity.code,
      entityName: entity.name,
      entityIdentifierQualifier: entity.identifier?.qualifier,
      entityIdentifier: entity.identifier?.value,
    }),
  );
  if (entity.secondaryName) {
    lines.push(
      writeRecord(UNIFIED_SF31, {
        entityCode: entity.secondaryName.code,
        entityName: entity.secondaryName.name,
      }),
    );
  }
  if (hasName) {
    for (const pair of chunk(entity.addressComponents ?? [], 2)) {
      lines.push(
        writeRecord(UNIFIED_SF35, {
          addressComponentQualifier1: pair[0].qualifier,
          addressInformation1: pair[0].information,
          addressComponentQualifier2: pair[1]?.qualifier,
          addressInformation2: pair[1]?.information,
        }),
      );
    }
    const geo = entity.geography!;
    lines.push(
      writeRecord(UNIFIED_SF36, {
        cityName: geo.city,
        countrySubEntityCode: geo.countrySubEntityCode,
        postalCode: geo.postalCode,
        countryCode: geo.countryCode,
      }),
    );
  }
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build one ACE Cargo Release transaction (SE Header Grouping) as 80-char
 * record lines. The response arrives in the SX transaction set; ongoing
 * processing status arrives in SO.
 */
export function buildCargoRelease(input: CargoReleaseInput): string[] {
  validateHeader(input);
  const lines: string[] = [];

  if (input.action === 'cancel') {
    // "D" action map: SE10 + SE13 + SE20 only (CR p.26, SE-24).
    const reason = input.cancellation.reasonCode;
    if (!CANCELLATION_REASON_CODES[reason]) {
      fail('cancellation.reasonCode', `unknown cancellation reason code '${reason}' (SE13 Note 1)`);
    }
    if (reason === '12' && input.entryType !== '06') {
      fail('cancellation.reasonCode', 'reason code 12 is for Entry Type 06 Weekly ONLY (SE13 Note 1)');
    }
    // Replacement references (SE13 Note 1 / SE20 Note 1, CR p.57).
    const required: Partial<Record<SeCancellationReasonCode, SeReferenceQualifier>> = { '02': 'IB', '03': 'EN', '04': 'FTZ' };
    const wanted = required[reason];
    if (wanted && !(input.references ?? []).some((r) => r.qualifier === wanted)) {
      fail('references', `cancellation reason ${reason} requires a replacement ${wanted} reference in an SE20 record (SE13 Note 1)`);
    }
    // Planned Port of Entry must be provided for Cancel transactions
    // (SE10 Note 7, CR p.37).
    if (!input.plannedPortOfEntry) {
      fail('plannedPortOfEntry', 'the Planned Port of Entry must be provided on Cancel transactions (SE10 Note 7)');
    }
    for (const key of ['billGroupings', 'headerEntities', 'lines', 'unifiedIsf', 'additionalHeader'] as const) {
      if ((input as unknown as Record<string, unknown>)[key] !== undefined) {
        fail(key, `the ${key} records cannot be reported on a cancellation — the D action map is SE10 + SE13 + SE20 only (CR p.26)`);
      }
    }
    lines.push(emitSe10(input, 'D'));
    lines.push(emitSe13(input, reason, input.cancellation.multipleCargoDispositions));
    emitReferences(input, lines);
    return lines;
  }

  if (input.action === 'update') {
    // "If the update action code is U, the only records that can be
    // reported are SE10, SE11, SE15, SE16, SE17, and SE20" (SE10 Note 1)
    // — plus the SE13 the U map marks Mandatory (see module header).
    for (const key of ['headerEntities', 'lines', 'unifiedIsf', 'cancellation'] as const) {
      if ((input as unknown as Record<string, unknown>)[key] !== undefined) {
        fail(key, `the ${key} records cannot be reported on an Update — only SE10/SE11/SE13/SE15/SE16/SE17/SE20 are allowed (SE10 Note 1, CR p.35)`);
      }
    }
    lines.push(emitSe10(input, 'U'));
    if (input.additionalHeader) emitSe11(input.additionalHeader, input, lines);
    lines.push(emitSe13(input));
    for (const [gi, grouping] of (input.billGroupings ?? []).entries()) {
      emitBillGrouping(grouping, gi, input, lines);
    }
    emitReferences(input, lines);
    return lines;
  }

  // ── Add / Replace ────────────────────────────────────────
  const groupings = input.billGroupings ?? [];
  const references = input.references ?? [];
  const hasRef = (q: string) => references.some((r) => r.qualifier === q);
  const allBills = groupings.flatMap((g) => g.bills);
  const headerEntities = input.headerEntities ?? [];

  if (groupings.length > 999) fail('billGroupings', 'at most 999 Bill of Lading Groupings');
  if (headerEntities.length > 12) fail('headerEntities', 'at most 12 Header Level Entity Groupings (input map, CR p.24)');
  if (input.lines.length === 0) fail('lines', 'at least one SE Line Grouping is required');
  if (input.lines.length > 999) fail('lines', 'at most 999 SE Line Groupings');
  assertEntityCodesUnique(headerEntities, 'headerEntities');

  // MOT is required on all Entry Types except 06 without bills (Note 11).
  if (!input.motCode && !(input.entryType === '06' && allBills.length === 0)) {
    fail('motCode', 'MOT is required on all Entry Types except type 06 without a Bill of Lading (SE10 Note 11)');
  }

  // Type 06 FTZ: the SE15 record is not used, except to report an
  // In-Bond Number and Bill for cross-port removals (SE15 Note 10).
  if (input.entryType === '06') {
    for (const [gi, grouping] of groupings.entries()) {
      if (!grouping.bills.some((b) => b.type === 'I')) {
        fail(`billGroupings[${gi}]`, 'the SE15 record is not used for entry type 06 FTZ unless reporting a cross-port In-Bond Number and Bill (SE15 Note 10)');
      }
    }
  }

  // Warehouse entries (SE10 Notes 9/10).
  if (input.entryType === '21' || input.entryType === '22') {
    if (!input.additionalHeader?.bondedWarehouseFirms) {
      fail('additionalHeader.bondedWarehouseFirms', `the FIRMS code of the CBP Bonded Warehouse must be reported in the SE11 record for entry type ${input.entryType} (SE10 Note 9 / SE11 Note 2)`);
    }
  }
  if (input.entryType === '22' && !input.additionalHeader?.originatingWarehouseEntry) {
    fail('additionalHeader.originatingWarehouseEntry', 'the originating warehouse entry number must be reported in the SE11 record for entry type 22 (SE10 Note 10 / SE11 Note 3)');
  }

  // Type 86 (SE10 Note 13, SE15 Notes 11/12, SE20 EDA, SE30 Note 1).
  if (input.entryType === '86') {
    if (!hasRef('EDA')) {
      fail('references', 'an EDA (Estimated Date of Arrival) SE20 reference is required for Type 86 entries (SE20 Note 1, CR p.57)');
    }
    if (groupings.length !== 1) {
      fail('billGroupings', 'only one bill is allowed per entry for entry type 86 (SE15 Note 12)');
    }
    const cn = headerEntities.filter((e) => e.code === 'CN');
    if (cn.length !== 1) {
      fail('headerEntities', 'for type 86 the Consignee is required at the header level and only one Consignee is allowed per entry (SE30 Note 1, CR p.59)');
    }
    const sellerAtHeader = headerEntities.some((e) => e.code === 'SE');
    if (!sellerAtHeader) {
      for (const [li, line] of input.lines.entries()) {
        if (!(line.entities ?? []).some((e) => e.code === 'SE')) {
          fail(`lines[${li}]`, 'for type 86 the Seller is required at the line level unless one Seller is reported at the header level (SE30/SE50 Note 1)');
        }
      }
    }
  }

  // Planned Port of Entry requirements (SE10 Note 7, CR p.37).
  const hasInBond = allBills.some((b) => b.type === 'I');
  const hasNonAms = allBills.some((b) => b.nonAms);
  const hasPga = input.lines.some((l) => l.tariffs.some((t) => t.pga));
  if (!input.plannedPortOfEntry) {
    if (hasInBond) fail('plannedPortOfEntry', 'the Planned Port of Entry must be provided when an In-Bond number is reported in the entry filing (SE10 Note 7)');
    if (hasPga) fail('plannedPortOfEntry', 'the Planned Port of Entry must be provided when PGA data is included in the entry filing (SE10 Note 7)');
    if (POE_MANDATORY_ENTRY_TYPES.has(input.entryType)) {
      fail('plannedPortOfEntry', `the Planned Port of Entry must be provided for entry type ${input.entryType} (SE10 Note 7)`);
    }
    if (hasNonAms) fail('plannedPortOfEntry', 'the Planned Port of Entry is required for entries with Non-AMS bills (SE10 Note 7 / SE15 Note 5)');
  }

  lines.push(emitSe10(input, input.action === 'add' ? 'A' : 'R'));
  if (input.additionalHeader) emitSe11(input.additionalHeader, input, lines);
  lines.push(emitSe13(input));
  for (const [gi, grouping] of groupings.entries()) {
    emitBillGrouping(grouping, gi, input, lines);
  }
  emitReferences(input, lines);
  for (const entity of headerEntities) {
    emitEntity(HEADER_ENTITY_DEFS, entity, input.entryType, `headerEntities[${entity.code}]`, lines);
  }
  for (const [li, line] of input.lines.entries()) {
    emitLine(line, li, input, lines);
  }
  // Unified Entry/ISF: SF records immediately following the last Entry
  // data record (CR p.30/32, SE-28/30).
  if (input.unifiedIsf) emitUnifiedIsf(input.unifiedIsf, input, lines);

  return lines;
}
