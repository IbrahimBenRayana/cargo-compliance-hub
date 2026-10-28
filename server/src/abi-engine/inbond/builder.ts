/**
 * In-Bond (QP) and In-Bond Event (WP) transaction builders — CATAIR
 * "In-Bond" chapter, Amendment 51, April 2026 (INB-n page numbers in
 * comments).
 *
 * buildInbond assembles one In-Bond Grouping (QP10 … QP76) following the
 * chapter's three input usage maps:
 *  - QP-Long (INB-10..12): add/replace in-bond AND bill of lading for a
 *    non-automated carrier or FTZ/warehouse withdrawal — emitted when a
 *    bill carries details (QP40+) or the FTZ indicator is set;
 *  - QP-Short (INB-13): add/replace an in-bond against a bill that
 *    already exists in ACE — QP10, QP20 (Air), QP30 (+QP32/QP33);
 *  - the two delete maps (INB-13..14): QP10 'B' + QP30 'D' per bill, or
 *    a lone QP10 'D' for the whole in-bond.
 *
 * buildInbondEvent assembles one In-bond Event Grouping (WP10 + WP20,
 * INB-14) for arrival (1/2/3), export (5/6/7), transfer of liability (A)
 * and diversion (Z).
 *
 * The response arrives in the QT / WT transaction sets (responseParser).
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../records/codec.js';
import {
  QP10, QP20, QP30, QP32, QP33, QP40, QP50, QP51, QP52, QP55, QP56, QP57,
  QP60, QP61, QP62, QP65, QP70, QP71, QP72, QP75, QP76, WP10, WP20,
  IN_BOND_ENTRY_TYPES,
  QP33_REFERENCE_QUALIFIERS,
  WP_ACTION_CODES,
  WEIGHT_UNITS,
  VOLUME_UNITS,
  HAZMAT_QUALIFIERS,
} from './recordDefs.js';
import { formatInbondNumber, isAcceptableInbondNumber } from './checkDigit.js';

// ── Input types ────────────────────────────────────────────

/** 61 IT (arrive only) | 62 T&E (arrive then export) | 63 IE (export only). */
export type InbondEntryType = '61' | '62' | '63';
export type InbondWeightUnit = 'LB' | 'KG' | 'LT' | 'ST' | 'ET' | 'MT';
/** WP10 Note 1 (INB-55..56). */
export type InbondEventAction = '1' | '2' | '3' | '5' | '6' | '7' | 'A' | 'Z';

/** QP20 importing-conveyance information (INB-23..25). */
export interface InbondConveyance {
  /** SCAC / ICAO / IATA — or the FTZ/warehouse FIRMS code for withdrawals. */
  importingCarrierCode: string;
  /** 2N import MOT; chapter prints 30 truck / 70 pipeline / 40 air. FTZ moves must use 30. */
  importMotCode: string;
  /** ISO flag country; not required for Air or FTZ withdrawals. */
  countryCode?: string;
  /** Not required for Air or FTZ withdrawals. */
  conveyanceName?: string;
  /** NNN / NNNA / NNNN / NNNNA; ≥ 1 char for FTZ withdrawals. */
  voyageFlightTripNumber?: string;
  /** Schedule D port of unlading (or previous in-bond's destination). */
  portOfArrival: string;
  /** MMDDYY; not required for FTZ withdrawals. */
  estimatedDateOfArrival?: string;
  /** FIRMS of the FTZ/warehouse — mandatory when the QP10 FTZ flag is set (Note 2, INB-25). */
  ftzFirmsCode?: string;
}

/** One QP50/55/60-style party with its optional 51/52-style continuations. */
export interface InbondParty {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  /** Emits the 52/57/62 record; requires addressLine2 (the 52-style record must follow a 51-style record, INB-37). */
  telephoneOrTelex?: string;
}

/** One QP70 harmonized-nomenclature record (INB-45..46). */
export interface InbondCommodity {
  /** 6-10 digits, left justified on the wire. */
  htsNumber: string;
  /** Whole USD, > 0 ($20/kilo may be used when unknown). */
  valueDollars: number;
  /** Net weight, > 0, no decimals. */
  weight: number;
  weightUnit: InbondWeightUnit;
}

/** One QP71 cargo-description record (INB-47..48). */
export interface InbondCargoLine {
  /** Mandatory on the first of multiple 71 records; the sum must equal QP40 manifestQuantity. */
  pieceCount?: number;
  description: string;
  /** ACE Ocean Appendix N. */
  manifestUnitCode?: string;
}

/**
 * One Cargo Description group per usage-map Note 1 (INB-11): 0-n QP70
 * records applying to the QP71 records that follow, then QP72 marks.
 * The chapter's Example 2 is three of these groups in sequence.
 */
export interface InbondCargoGroup {
  commodities?: InbondCommodity[];
  descriptions: InbondCargoLine[];
  marksAndNumbers?: string[];
}

/** Up to two QP76 free-form continuations per QP75 (INB-52). */
export interface InbondHazmatContinuation {
  description?: string;
  classification?: string;
}

/** One QP75 (+ ≤2 QP76) hazmat group (INB-50..52). Max 99 per container. */
export interface InbondHazmat {
  code: string;
  hazmatClass?: string;
  /** HAZMAT_QUALIFIERS (QP75 Note 2). */
  codeQualifier?: string;
  description?: string;
  contact?: string;
  /** Whole °C; pair with negativeFlashpoint for below-zero values. */
  flashpointTemperature?: number;
  negativeFlashpoint?: boolean;
  continuations?: InbondHazmatContinuation[];
}

/** One QP65 container with its nested cargo groups and hazmat (INB-44). */
export interface InbondContainer {
  /** Exactly as it appears on the container; 'NC' for non-containerized freight. */
  containerNumber: string;
  sealNumber1?: string;
  sealNumber2?: string;
  /** ACE Ocean Appendix I. */
  descriptionCode?: string;
  cargo: InbondCargoGroup[];
  hazmat?: InbondHazmat[];
}

/** QP40 + party + container data — presence makes the bill QP-Long. */
export interface InbondBillDetails {
  /** Schedule K; '99999' only for FTZ/warehouse withdrawals (QP40 Note 1, INB-34). */
  foreignPortOfLading: string;
  /** Total pieces on the bill; must equal the sum of all QP71 piece counts (INB-48). */
  manifestQuantity: number;
  /** ACE Ocean Appendix N. */
  manifestUnits: string;
  /** Gross weight, > 0. */
  weight: number;
  weightUnit: InbondWeightUnit;
  volume?: number;
  volumeUnit?: string;
  /** Required for paperless manifest participants. */
  placeOfPreReceipt?: string;
  foreignShipper: InbondParty;
  consignee: InbondParty;
  /** Up to 3 notify-party groupings (INB-10). */
  notifyParties?: InbondParty[];
  /** 1-999 QP65 containers. */
  containers: InbondContainer[];
}

export interface InbondReference {
  /** QP33_REFERENCE_QUALIFIERS (INB-30..31). */
  qualifier: string;
  value: string;
}

export interface InbondBill {
  /** Echoed in the QT 30 record for error association (INB-26). */
  sequenceNumber?: string;
  /** SCAC or 3-char AWB prefix (FIRMS for FTZ withdrawals). */
  issuerCode: string;
  /** Simple/regular/master bill number; 8-digit AWB serial for Air. */
  billNumber: string;
  /** Air only (QP30, INB-27). */
  houseBillNumber?: string;
  /**
   * Set when the reported bill is an air MASTER bill: the chapter rejects
   * a QP posted to a master air waybill without its house bill ("If no
   * house bill is included when a master bill is listed, the filer will
   * receive a rejection of the QP", QP30 Note 1, INB-28). The wire format
   * itself cannot distinguish master from simple air bills, so the caller
   * declares it.
   */
  isMasterAirBill?: boolean;
  /** Previous in-bond for subsequent moves; must be blank for FTZ (QP30 Note 2). */
  previousInBondNumber?: string;
  /**
   * QP-Short only: partial in-bond quantity when less than the full bill
   * quantity of a previously transmitted bill (INB-27). Not permitted for
   * Air (full bill quantity required, QP30 Note 2).
   */
  inBondQuantity?: number;
  /** 1-4 QP32 SNP codes. CATAIR filers must include themselves to receive NS (INB-29). */
  secondaryNotifyParties?: string[];
  /** 0-999 QP33 records. */
  references?: InbondReference[];
  /** QP40..QP76 data — presence selects the QP-Long form for this bill. */
  details?: InbondBillDetails;
}

export interface InbondAddInput {
  kind: 'add';
  entryType: InbondEntryType;
  /** Conventional 9-digit number with a valid MOD-7 check digit. */
  inBondNumber: string;
  /** QP10 in-bond carrier: SCAC/ICAO/IATA, or the FIRMS code for FTZ withdrawals. */
  carrierCode: string;
  /** Schedule D: termination port (61), export port (62) or arrival port (63). */
  usPortOfDestination: string;
  /** Schedule K — mandatory for 62/63, forbidden for 61 (INB-20 Note 1/4). */
  portOfForeignDestination?: string;
  /** Whole USD, > 0 ($20/kilo may be used when unknown). */
  valueDollars: number;
  /** IRS / CBP-assigned / SSN number of the bonded carrier. */
  bondedCarrierId: string;
  /** FTZ or bonded-warehouse withdrawal (QP10 position 51 'Y'). */
  ftzWithdrawal?: boolean;
  /** BTA/FDA indicator — required for all in-bond types (INB-8); 63 and FTZ moves must be 'N' (QP10 Note 3). */
  btaIndicator: 'Y' | 'N';
  /** QP20 — required for QP-Long bills, Air in-bonds and FTZ withdrawals (INB-23). */
  conveyance?: InbondConveyance;
  /** 1-9999 bills. */
  bills: InbondBill[];
}

/** Delete in-bond from specific bills: QP10 'B' + QP30 'D' (INB-13 Note 4). */
export interface InbondDeleteBillInput {
  kind: 'deleteBill';
  inBondNumber: string;
  bills: Array<{
    issuerCode: string;
    billNumber: string;
    sequenceNumber?: string;
    houseBillNumber?: string;
  }>;
}

/** Delete the entire in-bond: a lone QP10 'D' (INB-14 Note 4A). */
export interface InbondDeleteInput {
  kind: 'delete';
  inBondNumber: string;
}

export type InbondInput = InbondAddInput | InbondDeleteBillInput | InbondDeleteInput;

/** WP event input (WP10 + WP20, INB-54..58). */
export interface InbondEventInput {
  action: InbondEventAction;
  /**
   * Entry type of the in-bond being acted on, when known — enables the
   * WP10 Note 1 lifecycle check (61 arrive-only, 62 arrive-then-export,
   * 63 export-only, INB-56).
   */
  entryType?: InbondEntryType;
  /** Conventional 9-digit (MOD-7 ±3 accepted, WP10 Note 2) or 'V' paperless. Mandatory for 1/3/5/7/A/Z. */
  inBondNumber?: string;
  /** Mandatory for actions 2/3/6/7. */
  billIssuerCode?: string;
  billNumber?: string;
  /** Air only. */
  houseBillNumber?: string;
  /** Mandatory for arrivals 1/2/3 except Air (INB-55). */
  firmsCode?: string;
  /** Mandatory for actions 3/7. */
  containerNumber?: string;
  /** True for Air — lifts the FIRMS requirement and bans actions 3/7/A. */
  air?: boolean;
  /** YYMMDD. */
  date: string;
  /** HHMMSS. */
  time: string;
  /** Schedule D — mandatory for 1/2/3/Z; for Z it is the NEW destination. */
  port?: string;
  /** SCAC assuming liability — mandatory for A. */
  inBondCarrierCode?: string;
  /** Bonded carrier ID assuming liability — mandatory for A/Z. */
  bondedCarrierId?: string;
  /** Mandatory for A (with stateCode). */
  cityName?: string;
  stateCode?: string;
  /** 10/11 vessel only; both-or-neither with exportConveyanceName (WP20 Note 2). */
  exportMotCode?: string;
  exportConveyanceName?: string;
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'InBond', field, message };
  throw new RecordCodecError([issue]);
}

function failEvent(field: string, message: string): never {
  const issue: CodecIssue = { record: 'InBondEvent', field, message };
  throw new RecordCodecError([issue]);
}

/**
 * Format a positive whole number for an N field: right justified,
 * zero-filled (class N admits no leading spaces).
 */
function zeroPad(value: number, width: number, field: string, failFn: typeof fail = fail): string {
  if (!Number.isInteger(value) || value <= 0) {
    failFn(field, `must be a whole number greater than zero, got ${value}`);
  }
  const s = String(value);
  if (s.length > width) failFn(field, `value ${s} exceeds ${width} digits`);
  return s.padStart(width, '0');
}

/** Validate/normalize the conventional 9-digit MOD-7 in-bond number (QP side). */
function requireConventionalInbondNumber(value: string, field: string): string {
  if (!/^[0-9]{9}$/.test(value)) {
    fail(field, `the conventional 9-position in-bond number must be used, got '${value}' (INB-19)`);
  }
  try {
    return formatInbondNumber(value);
  } catch (err) {
    fail(field, (err as Error).message);
  }
}

// ── QP emission ────────────────────────────────────────────

function emitParty(
  party: InbondParty,
  defs: { head: typeof QP50; address: typeof QP51; phone: typeof QP52 },
  label: string,
  lines: string[],
): void {
  lines.push(writeRecord(defs.head, { name: party.name, addressLine1: party.addressLine1 }));
  if (party.addressLine3 && !party.addressLine2) {
    fail(label, 'addressLine3 requires addressLine2 (the 51-type record carries lines two and three)');
  }
  if (party.addressLine2) {
    lines.push(
      writeRecord(defs.address, { addressLine2: party.addressLine2, addressLine3: party.addressLine3 }),
    );
  }
  if (party.telephoneOrTelex) {
    // The 52-type record "must immediately follow a 51 record" (INB-37).
    if (!party.addressLine2) {
      fail(label, 'telephoneOrTelex requires addressLine2 — the telephone record must follow an address record (INB-37)');
    }
    lines.push(writeRecord(defs.phone, { telephoneOrTelex: party.telephoneOrTelex }));
  }
}

function emitBillDetails(
  input: InbondAddInput,
  bill: InbondBill,
  details: InbondBillDetails,
  label: string,
  lines: string[],
): void {
  // ── QP40 (INB-32..34) ──
  if (!/^[0-9]{5}$/.test(details.foreignPortOfLading)) {
    fail(`${label}.foreignPortOfLading`, `must be a 5-digit Schedule K code, got '${details.foreignPortOfLading}'`);
  }
  if (input.ftzWithdrawal && details.foreignPortOfLading !== '99999') {
    fail(`${label}.foreignPortOfLading`, "use '99999' for the foreign port of lading when the FTZ flag is set (QP40 Note 1, INB-34)");
  }
  if (!input.ftzWithdrawal && details.foreignPortOfLading === '99999') {
    fail(`${label}.foreignPortOfLading`, "'99999' may only be used when the FTZ flag is set (QP40 Note 1, INB-34)");
  }
  if (!WEIGHT_UNITS[details.weightUnit]) {
    fail(`${label}.weightUnit`, `unknown weight unit '${details.weightUnit}' (INB-32)`);
  }
  if (details.volume !== undefined && !details.volumeUnit) {
    fail(`${label}.volumeUnit`, 'the volume unit is required when a volume is provided (INB-33)');
  }
  if (details.volumeUnit && !VOLUME_UNITS[details.volumeUnit]) {
    fail(`${label}.volumeUnit`, `unknown volume unit '${details.volumeUnit}' (INB-33)`);
  }
  lines.push(
    writeRecord(QP40, {
      foreignPortOfLading: details.foreignPortOfLading,
      manifestQuantity: zeroPad(details.manifestQuantity, 10, `${label}.manifestQuantity`),
      manifestUnits: details.manifestUnits,
      weight: zeroPad(details.weight, 10, `${label}.weight`),
      weightUnit: details.weightUnit,
      volume: details.volume === undefined ? undefined : zeroPad(details.volume, 10, `${label}.volume`),
      volumeUnit: details.volumeUnit,
      placeOfPreReceipt: details.placeOfPreReceipt,
    }),
  );

  // ── Foreign shipper / consignee / notify parties (INB-35..43) ──
  emitParty(details.foreignShipper, { head: QP50, address: QP51, phone: QP52 }, `${label}.foreignShipper`, lines);
  emitParty(details.consignee, { head: QP55, address: QP56, phone: QP57 }, `${label}.consignee`, lines);
  const notifyParties = details.notifyParties ?? [];
  if (notifyParties.length > 3) {
    fail(`${label}.notifyParties`, 'at most 3 notify-party groupings per bill (INB-10)');
  }
  for (const [i, notify] of notifyParties.entries()) {
    emitParty(notify, { head: QP60, address: QP61, phone: QP62 }, `${label}.notifyParties[${i}]`, lines);
  }

  // ── Containers with nested cargo groups (INB-44..52) ──
  if (details.containers.length === 0 || details.containers.length > 999) {
    fail(`${label}.containers`, 'each QP-Long bill requires 1 to 999 QP65 container records (INB-10/44)');
  }
  const seenContainers = new Set<string>();
  let totalPieceCount = 0;

  for (const [c, container] of details.containers.entries()) {
    const cLabel = `${label}.containers[${c}]`;
    if (seenContainers.has(container.containerNumber)) {
      fail(cLabel, `container number '${container.containerNumber}' repeated within the bill (INB-44)`);
    }
    seenContainers.add(container.containerNumber);
    lines.push(
      writeRecord(QP65, {
        containerNumber: container.containerNumber,
        sealNumber1: container.sealNumber1,
        sealNumber2: container.sealNumber2,
        containerDescriptionCode: container.descriptionCode,
      }),
    );

    if (container.cargo.length === 0) {
      fail(cLabel, 'each container requires a cargo description grouping (INB-10)');
    }
    // QP70 is mandatory when the in-bond being initiated is type 62 or 63
    // at the time the bill is added (usage-map Note 2, INB-11).
    const hasCommodity = container.cargo.some((g) => (g.commodities ?? []).length > 0);
    if ((input.entryType === '62' || input.entryType === '63') && !hasCommodity) {
      fail(cLabel, `the QP70 harmonized record is mandatory when creating bills for entry type ${input.entryType} (INB-11 Note 2, INB-45)`);
    }

    let qp70Count = 0;
    let qp71Count = 0;
    let qp72Count = 0;
    for (const [g, group] of container.cargo.entries()) {
      const gLabel = `${cLabel}.cargo[${g}]`;
      for (const [i, commodity] of (group.commodities ?? []).entries()) {
        qp70Count += 1;
        if (!/^[0-9]{6,10}$/.test(commodity.htsNumber)) {
          fail(`${gLabel}.commodities[${i}]`, `the HTS number must be 6 to 10 digits, got '${commodity.htsNumber}' (INB-45)`);
        }
        if (!WEIGHT_UNITS[commodity.weightUnit]) {
          fail(`${gLabel}.commodities[${i}]`, `unknown weight unit '${commodity.weightUnit}' (INB-46)`);
        }
        lines.push(
          writeRecord(QP70, {
            harmonizedNumber: commodity.htsNumber,
            value: zeroPad(commodity.valueDollars, 8, `${gLabel}.commodities[${i}].valueDollars`),
            weight: zeroPad(commodity.weight, 10, `${gLabel}.commodities[${i}].weight`),
            weightUnit: commodity.weightUnit,
          }),
        );
      }
      if (group.descriptions.length === 0) {
        fail(gLabel, 'each cargo description grouping requires at least one QP71 record (INB-10)');
      }
      for (const [i, line] of group.descriptions.entries()) {
        qp71Count += 1;
        // "This field is mandatory for the first of multiple 71 records"
        // (INB-47); with a single 71 it carries the container total.
        if (g === 0 && i === 0 && line.pieceCount === undefined) {
          fail(`${gLabel}.descriptions[0]`, "the piece count is mandatory on a container's first QP71 record (INB-47)");
        }
        if (line.pieceCount !== undefined) totalPieceCount += line.pieceCount;
        lines.push(
          writeRecord(QP71, {
            pieceCount:
              line.pieceCount === undefined
                ? undefined
                : zeroPad(line.pieceCount, 10, `${gLabel}.descriptions[${i}].pieceCount`),
            description: line.description,
            manifestUnitCode: line.manifestUnitCode,
          }),
        );
      }
      for (const marks of group.marksAndNumbers ?? []) {
        qp72Count += 1;
        lines.push(writeRecord(QP72, { marksAndNumbers: marks }));
      }
    }
    if (qp70Count > 999) fail(cLabel, 'at most 999 QP70 records per container (INB-10)');
    if (qp71Count > 999) fail(cLabel, 'at most 999 QP71 records per container (INB-11 Note 1)');
    if (qp72Count > 999) fail(cLabel, 'at most 999 QP72 records per container (INB-11 Note 1)');

    // Hazmat follows the description and marks records (Note 3, INB-11..12).
    const hazmat = container.hazmat ?? [];
    if (hazmat.length > 99) fail(cLabel, 'at most 99 QP75/76 hazmat groups per container (INB-12)');
    for (const [h, hz] of hazmat.entries()) {
      const hLabel = `${cLabel}.hazmat[${h}]`;
      if (hz.codeQualifier && !HAZMAT_QUALIFIERS[hz.codeQualifier]) {
        fail(hLabel, `unknown hazardous material code qualifier '${hz.codeQualifier}' (QP75 Note 2, INB-51)`);
      }
      let flashpoint: string | undefined;
      if (hz.flashpointTemperature !== undefined) {
        if (!Number.isInteger(hz.flashpointTemperature) || hz.flashpointTemperature < 0) {
          fail(hLabel, 'the flashpoint temperature must be a whole non-negative number, with negativeFlashpoint for below-zero values (INB-50)');
        }
        flashpoint = String(hz.flashpointTemperature).padStart(3, '0');
      }
      lines.push(
        writeRecord(QP75, {
          hazmatCode: hz.code,
          hazmatClass: hz.hazmatClass,
          hazmatCodeQualifier: hz.codeQualifier,
          hazmatDescription: hz.description,
          hazmatContact: hz.contact,
          flashpointTemperature: flashpoint,
          flashpointUom: flashpoint === undefined ? undefined : 'CE',
          negativeIndicator: hz.negativeFlashpoint ? 'N' : undefined,
        }),
      );
      const continuations = hz.continuations ?? [];
      if (continuations.length > 2) fail(hLabel, 'at most two QP76 records per QP75 record (INB-52)');
      for (const extra of continuations) {
        lines.push(
          writeRecord(QP76, {
            hazmatDescription: extra.description,
            hazmatClassification: extra.classification,
          }),
        );
      }
    }
  }

  // "The total amount in all piece count fields in all 71 records must
  // equal the amount in the manifest quantity field on the associated 40
  // record." (QP71 Note 1, INB-48)
  if (totalPieceCount !== details.manifestQuantity) {
    fail(`${label}.manifestQuantity`, `the QP71 piece counts total ${totalPieceCount} but the QP40 manifest quantity is ${details.manifestQuantity} (INB-48)`);
  }
}

function emitBill(input: InbondAddInput, bill: InbondBill, index: number, lines: string[]): void {
  const label = `bills[${index}]`;
  const isAir = input.conveyance?.importMotCode === '40';

  if (bill.isMasterAirBill && !bill.houseBillNumber) {
    fail(label, 'a QP posted to a master air waybill without its house bill is rejected (QP30 Note 1, INB-28)');
  }
  if (input.ftzWithdrawal && bill.previousInBondNumber) {
    fail(`${label}.previousInBondNumber`, 'must be blank for FTZ/warehouse withdrawals (QP30, INB-27)');
  }
  if (bill.inBondQuantity !== undefined) {
    if (bill.details) {
      // "When creating the Bill of Lading, the quantity is provided in the
      // QP40 and this field will not be validated." (INB-27)
      fail(`${label}.inBondQuantity`, 'the in-bond quantity is only used when adding an in-bond to an EXISTING bill; a QP-Long bill carries its quantity in the QP40 (INB-27)');
    }
    if (isAir) {
      fail(`${label}.inBondQuantity`, 'full bill quantity is required for Air in-bonds; partial quantities are not permitted (QP30 Note 2, INB-28)');
    }
  }

  lines.push(
    writeRecord(QP30, {
      actionCode: 'A',
      sequenceNumber: bill.sequenceNumber,
      billIssuerCode: bill.issuerCode,
      billNumber: bill.billNumber,
      houseBillNumber: bill.houseBillNumber,
      previousInBondNumber: bill.previousInBondNumber,
      inBondQuantity:
        bill.inBondQuantity === undefined
          ? undefined
          : zeroPad(bill.inBondQuantity, 10, `${label}.inBondQuantity`),
    }),
  );

  const snps = bill.secondaryNotifyParties ?? [];
  if (snps.length > 4) fail(`${label}.secondaryNotifyParties`, 'at most 4 secondary notify parties per QP32 record (INB-29)');
  if (snps.length > 0) {
    lines.push(
      writeRecord(QP32, {
        snpCode1: snps[0],
        snpCode2: snps[1],
        snpCode3: snps[2],
        snpCode4: snps[3],
      }),
    );
  }

  const references = bill.references ?? [];
  if (references.length > 999) fail(`${label}.references`, 'at most 999 QP33 records per bill (INB-10/30)');
  for (const [i, ref] of references.entries()) {
    if (!QP33_REFERENCE_QUALIFIERS[ref.qualifier]) {
      fail(`${label}.references[${i}]`, `unknown reference identifier qualifier '${ref.qualifier}' (QP33 Note 1, INB-30..31)`);
    }
    lines.push(writeRecord(QP33, { qualifier: ref.qualifier, referenceIdentifier: ref.value }));
  }

  if (bill.details) emitBillDetails(input, bill, bill.details, label, lines);
}

// ── QP builder ─────────────────────────────────────────────

/**
 * Build one In-Bond Grouping (QP transaction) as 80-char record lines:
 * {kind:'add'} per the QP-Long/QP-Short maps, {kind:'deleteBill'} per the
 * Delete In-bond/Bill map (QP10 'B' + QP30 'D'), {kind:'delete'} per the
 * Delete In-bond map (lone QP10 'D').
 */
export function buildInbond(input: InbondInput): string[] {
  const inBondNumber = requireConventionalInbondNumber(input.inBondNumber, 'inBondNumber');

  if (input.kind === 'delete') {
    // "When deleting the entire in-bond, the QP10 Action Code is 'D'."
    // Only QP10 is provided (Note 4A, INB-14).
    return [writeRecord(QP10, { actionCode: 'D', inBondNumber })];
  }

  if (input.kind === 'deleteBill') {
    // "When deleting a specific BOL from an in-bond, the QP10 Action Code
    // is 'B' and the QP30 Action Code is 'D'." (Note 4, INB-13)
    if (input.bills.length === 0) fail('bills', 'a bill-level delete requires at least one QP30 record (INB-13)');
    if (input.bills.length > 9999) fail('bills', 'at most 9999 bills per in-bond (INB-13)');
    const lines = [writeRecord(QP10, { actionCode: 'B', inBondNumber })];
    for (const bill of input.bills) {
      lines.push(
        writeRecord(QP30, {
          actionCode: 'D',
          sequenceNumber: bill.sequenceNumber,
          billIssuerCode: bill.issuerCode,
          billNumber: bill.billNumber,
          houseBillNumber: bill.houseBillNumber,
        }),
      );
    }
    return lines;
  }

  // ── Add (QP-Long / QP-Short) ─────────────────────────────
  if (!IN_BOND_ENTRY_TYPES[input.entryType]) {
    fail('entryType', `unknown in-bond entry type '${input.entryType}' (INB-19)`);
  }
  // 62/63 carry a foreign destination; 61 must be space/zero filled (INB-20).
  if ((input.entryType === '62' || input.entryType === '63') && !input.portOfForeignDestination) {
    fail('portOfForeignDestination', `the Schedule K foreign destination is required for entry type ${input.entryType} (INB-20)`);
  }
  if (input.entryType === '61' && input.portOfForeignDestination) {
    fail('portOfForeignDestination', "space or zero fill the foreign destination for IT '61' entries (INB-20)");
  }
  // BTA/FDA: IE 63 shipments are exempt and must report 'N'; all FTZ or
  // bonded-warehouse moves are exempt and should report 'N' (Note 3, INB-22).
  if (input.entryType === '63' && input.btaIndicator !== 'N') {
    fail('btaIndicator', "type IE '63' shipments are exempt from BTA reporting; the indicator must be 'N' (QP10 Note 3, INB-22)");
  }
  if (input.ftzWithdrawal && input.btaIndicator !== 'N') {
    fail('btaIndicator', "in-bonds moving out of an FTZ or bonded warehouse are BTA-exempt; the indicator must be 'N' (QP10 Note 3, INB-22)");
  }

  if (input.bills.length === 0) fail('bills', 'an add requires at least one QP30 bill grouping (INB-10)');
  if (input.bills.length > 9999) fail('bills', 'at most 9999 bills per in-bond (INB-10)');

  const longForm = input.ftzWithdrawal === true || input.bills.some((b) => b.details !== undefined);

  if (input.ftzWithdrawal) {
    // FTZ withdrawals are always QP-Long with full bill data (INB-8).
    for (const [i, bill] of input.bills.entries()) {
      if (!bill.details) {
        fail(`bills[${i}]`, 'FTZ/warehouse withdrawals require full bill of lading information (QP-Long) for every bill (INB-8/26)');
      }
    }
    if (!input.conveyance) {
      fail('conveyance', 'the QP20 record is required for moves from an FTZ or bonded warehouse (INB-23)');
    }
    if (!input.conveyance.ftzFirmsCode) {
      fail('conveyance.ftzFirmsCode', 'the FIRMS code of the FTZ or bonded warehouse must be reported when the FTZ flag is set (QP20 Note 2, INB-24)');
    }
    // "If the FIRMS code is provided it must match the FIRMS code provided
    // in QP10 'Carrier code' and QP20 'Carrier code'." (Note 2, INB-25)
    if (input.conveyance.ftzFirmsCode !== input.carrierCode || input.conveyance.ftzFirmsCode !== input.conveyance.importingCarrierCode) {
      fail('conveyance.ftzFirmsCode', 'the FTZ FIRMS code must match the QP10 carrier code and the QP20 importing carrier code (QP20 Note 2, INB-25)');
    }
    if (input.conveyance.importMotCode !== '30') {
      fail('conveyance.importMotCode', "use MOT code 30 (Truck) for in-bonds created from an FTZ or bonded-warehouse withdrawal (INB-24)");
    }
  } else if (longForm && !input.conveyance) {
    // QP20 is required for bills that were not imported (INB-23).
    fail('conveyance', 'the QP20 conveyance record is required for QP-Long bills that were not imported (INB-23)');
  }

  const lines: string[] = [];
  lines.push(
    writeRecord(QP10, {
      actionCode: 'A',
      inBondEntryType: input.entryType,
      inBondNumber,
      inBondCarrierCode: input.carrierCode,
      usPortOfDestination: input.usPortOfDestination,
      portOfForeignDestination: input.portOfForeignDestination,
      value: zeroPad(input.valueDollars, 8, 'valueDollars'),
      bondedCarrierId: input.bondedCarrierId,
      ftzWarehouseIndicator: input.ftzWithdrawal ? 'Y' : undefined,
      btaFdaIndicator: input.btaIndicator,
    }),
  );

  if (input.conveyance) {
    lines.push(
      writeRecord(QP20, {
        importingCarrierCode: input.conveyance.importingCarrierCode,
        importMotCode: input.conveyance.importMotCode,
        countryCode: input.conveyance.countryCode,
        conveyanceName: input.conveyance.conveyanceName,
        voyageFlightTripNumber: input.conveyance.voyageFlightTripNumber,
        portOfArrival: input.conveyance.portOfArrival,
        estimatedDateOfArrival: input.conveyance.estimatedDateOfArrival,
        ftzFirmsCode: input.conveyance.ftzFirmsCode,
      }),
    );
  }

  for (const [i, bill] of input.bills.entries()) emitBill(input, bill, i, lines);
  return lines;
}

// ── WP builder ─────────────────────────────────────────────

const ARRIVE_ACTIONS = new Set<InbondEventAction>(['1', '2', '3']);
const EXPORT_ACTIONS = new Set<InbondEventAction>(['5', '6', '7']);
/** WP10: in-bond number mandatory for 1, 3, 5, 7, A, Z (INB-54). */
const INBOND_NUMBER_ACTIONS = new Set<InbondEventAction>(['1', '3', '5', '7', 'A', 'Z']);
/** WP10: bill mandatory for 2, 3, 6, 7 (INB-54). */
const BILL_ACTIONS = new Set<InbondEventAction>(['2', '3', '6', '7']);
/** WP10: container mandatory for 3 and 7 (INB-55). */
const CONTAINER_ACTIONS = new Set<InbondEventAction>(['3', '7']);
/** WP10 Note 1: not used for Air (INB-55). */
const NO_AIR_ACTIONS = new Set<InbondEventAction>(['3', '7', 'A']);

/**
 * Build one In-bond Event Grouping (WP10 + WP20) as 80-char record lines
 * for arrival (1/2/3), export (5/6/7), transfer of liability (A) or
 * diversion (Z), enforcing the WP10/WP20 per-action conditionals and the
 * WP10 Note 1 per-type lifecycle.
 */
export function buildInbondEvent(input: InbondEventInput): string[] {
  const { action } = input;
  if (!WP_ACTION_CODES[action]) {
    failEvent('action', `unknown WP action code '${action}' (WP10 Note 1, INB-55)`);
  }

  // Per-type lifecycle intent (WP10 Note 1, INB-56).
  if (input.entryType === '61' && EXPORT_ACTIONS.has(action)) {
    failEvent('action', "a type IT '61' in-bond needs only to be arrived — export actions are invalid (WP10 Note 1, INB-56)");
  }
  if (input.entryType === '63' && ARRIVE_ACTIONS.has(action)) {
    failEvent('action', "a type IE '63' in-bond needs only to be exported — arrival actions are invalid (WP10 Note 1, INB-56)");
  }

  if (input.air && NO_AIR_ACTIONS.has(action)) {
    failEvent('action', `action code ${action} is not used for Air (WP10 Note 1, INB-55)`);
  }

  if (INBOND_NUMBER_ACTIONS.has(action)) {
    if (!input.inBondNumber) {
      failEvent('inBondNumber', `the in-bond number is mandatory for action code ${action} (INB-54)`);
    }
    // Conventional 9-digit (MOD-7; the high-volume-air +1/+2/+3 variant
    // is accepted, WP10 Note 2) or the 'V' paperless number (INB-54).
    const number = input.inBondNumber;
    if (!(number.startsWith('V') || isAcceptableInbondNumber(number))) {
      failEvent('inBondNumber', `'${number}' is neither a conventional 9-digit number with a valid MOD-7 check digit nor a 'V' paperless number (INB-54, Note 2 INB-56)`);
    }
  }
  if (BILL_ACTIONS.has(action) && (!input.billIssuerCode || !input.billNumber)) {
    failEvent('billNumber', `the bill issuer and bill number are mandatory for action code ${action} (INB-54)`);
  }
  if (CONTAINER_ACTIONS.has(action) && !input.containerNumber) {
    failEvent('containerNumber', `the container number is mandatory for action code ${action} (INB-55)`);
  }
  // FIRMS on arrival — all MOTs except Air (INB-55, Table of Changes rev 44).
  if (ARRIVE_ACTIONS.has(action) && !input.air && !input.firmsCode) {
    failEvent('firmsCode', `the FIRMS code must be reported for arrival action code ${action} (INB-55)`);
  }
  if (!/^[0-9]{6}$/.test(input.date)) {
    failEvent('date', `the date must be YYMMDD, got '${input.date}' (INB-57)`);
  }
  if (!/^[0-9]{6}$/.test(input.time)) {
    failEvent('time', `the time must be HHMMSS, got '${input.time}' (INB-57)`);
  }
  // Port of arrival: mandatory for 1/2/3/Z (new destination for Z, INB-57).
  if ((ARRIVE_ACTIONS.has(action) || action === 'Z') && !input.port) {
    failEvent('port', `the Schedule D port is mandatory for action code ${action} (INB-57)`);
  }
  if (action === 'A' && !input.inBondCarrierCode) {
    failEvent('inBondCarrierCode', 'the SCAC of the carrier assuming liability is mandatory for action code A (INB-57)');
  }
  if ((action === 'A' || action === 'Z') && !input.bondedCarrierId) {
    failEvent('bondedCarrierId', `the bonded carrier ID assuming liability is mandatory for action code ${action} (INB-57)`);
  }
  if (action === 'A' && !input.cityName) {
    failEvent('cityName', 'the city where the transfer of liability occurs is mandatory for action code A (INB-57)');
  }
  if (input.cityName && !input.stateCode) {
    failEvent('stateCode', 'if a city name is supplied, the corresponding state code must also be provided (INB-57)');
  }
  // Export MOT / conveyance: both-or-neither, actions 5/6/7 only (Note 2, INB-58).
  const hasExportMot = input.exportMotCode !== undefined;
  const hasExportConveyance = input.exportConveyanceName !== undefined;
  if (hasExportMot !== hasExportConveyance) {
    failEvent('exportMotCode', 'if either the export conveyance or the export MOT is provided, both must be populated (WP20 Note 2, INB-58)');
  }
  if (hasExportMot && !EXPORT_ACTIONS.has(action)) {
    failEvent('exportMotCode', 'the export MOT and conveyance apply only to export action codes 5, 6 or 7 (INB-58)');
  }
  if (input.exportMotCode !== undefined && input.exportMotCode !== '10' && input.exportMotCode !== '11') {
    failEvent('exportMotCode', `the export MOT is only for codes 10 and 11 (vessel), got '${input.exportMotCode}' (INB-58)`);
  }

  return [
    writeRecord(WP10, {
      actionCode: action,
      inBondNumber: input.inBondNumber,
      billIssuerCode: input.billIssuerCode,
      billNumber: input.billNumber,
      houseBillNumber: input.houseBillNumber,
      firmsCode: input.firmsCode,
      containerNumber: input.containerNumber,
    }),
    writeRecord(WP20, {
      date: input.date,
      time: input.time,
      portOfArrival: input.port,
      inBondCarrierCode: input.inBondCarrierCode,
      bondedCarrierId: input.bondedCarrierId,
      cityName: input.cityName,
      stateCode: input.stateCode,
      exportMotCode: input.exportMotCode,
      exportConveyanceName: input.exportConveyanceName,
    }),
  ];
}
