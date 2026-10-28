/**
 * PGA Message Set line builder — assembles the OI + PG-record set for one
 * CBP entry line (HTS code) from a typed input, per the "Participating
 * Government Agencies Message Set" chapter, July 01, 2026
 * (docs/abi-engine/specs/pga/pga-message-set-2026-07.pdf).
 *
 * Output is the record lines that follow the AE 50-record (or SE 60-record)
 * for one tariff line (p.13). AE integration happens separately — this
 * builder only produces the 80-char lines.
 *
 * Structure rules implemented from the chapter:
 * - Exactly one OI per HTS code (p.13, p.16); the OI precedes the PG set.
 * - Each PgaSet is one PGA line: a PG01 followed by its child records in
 *   the parent-child order of the relationship model (p.61-64) — product
 *   detail (PG02, PG06, PG07/PG08, PG10), then entity trios PG19→PG20→PG21
 *   (+ entity-scoped PG23 affirmations) repeated per entity (never grouped
 *   by record id, p.63-64), then PG22, then shipment-level PG23
 *   affirmations, then line-level PG26, PG27 and PG30.
 * - PGA Line Number starts at 001 for a given Agency Code, increments on
 *   each subsequent PG01 for that same agency, and restarts at 001 when
 *   the agency code changes (p.13, p.65). AMBIGUITY: the chapter does not
 *   say what happens if an agency's sets are non-contiguous (e.g. FDA,
 *   EPA, FDA); "restart at 001 when the Agency code changes" is read
 *   literally here, so numbering is per contiguous run of the same agency.
 * - Disclaimer sets: if a disclaimer is provided in the PG01 record, then
 *   only the OI and PG01 records are required (p.21, p.63) — the
 *   discriminated union makes it impossible to attach other records to a
 *   disclaimer set.
 * - One PG02 'P' per PGA line (p.21) — each data set has exactly one
 *   product; multiple product codes of the SAME qualifier at product level
 *   would force a new PGA line (p.21) and are rejected.
 * - PG26 can be repeated up to six times, outermost (level 1) to innermost;
 *   the last quantity is the base quantity (p.42).
 * - PG08 must be used in conjunction with the PG07, and all its numbers
 *   are of the type designated by the PG07 qualifier (p.29).
 *
 * Numeric fields are zero-filled to full width per the chapter's formatting
 * rules (p.14: N = right justify and zero-fill); unused numeric fields are
 * space filled (also p.14), which the codec does when a value is omitted.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../records/codec.js';
import {
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
  INPUT_PG26,
  INPUT_PG27,
  INPUT_PG30,
} from './recordDefs.js';

// ── Input types ────────────────────────────────────────────

/** PG01 position-80 disclaimer codes (p.19-20). */
export type PgaDisclaimerCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * Disclaimer-only PGA line: OI + PG01 with the disclaimer code in position
 * 80 and nothing else (p.21: "If a disclaimer is provided in the PG01
 * record, then only the OI and PG01 records are required").
 */
export interface PgaDisclaimerSet {
  kind: 'disclaimer';
  /** Government agency code, e.g. FDA, EPA (Appendix V). */
  agencyCode: string;
  /** Government agency program code, e.g. FOO (Appendix PGA). */
  programCode: string;
  /** Government agency processing code, e.g. CCW (Appendix PGA). */
  processingCode?: string;
  disclaimerCode: PgaDisclaimerCode;
}

/** One qualifier/number pair for PG01 (globally unique) or PG02 codes. */
export interface PgaProductCode {
  /** e.g. FDP (FDA product code), SKU, CAS. */
  qualifier: string;
  number: string;
}

/** PG21 individual contact; follows the entity's PG19/PG20 records. */
export interface PgaContact {
  /** Type of party the individual represents (PG19 role codes), e.g. FD1, PK. */
  qualifier?: string;
  name?: string;
  telephone?: string;
  emailOrFax?: string;
}

/**
 * One PG23 FDA affirmation of compliance (or another agency's AoC). For
 * 'indicator only' AoC codes leave the qualifier undefined (FDA guide
 * Table 9-20).
 */
export interface PgaAffirmation {
  /** AoC code, e.g. PFR, VES, VFT, CAN (Appendix PGA FDA AoC codes). */
  code: string;
  /** AoC qualifier — the affirmed value (registration number, vessel name…). */
  qualifier?: string;
}

/** One PG19→PG20→PG21… entity trio. */
export interface PgaEntity {
  /** e.g. MF, DEQ, FD1, DP (Appendix PGA entity role codes). */
  roleCode: string;
  /** Entity identification code, e.g. 16 (DUNS), 47 (FEI). */
  identificationCode?: string;
  /** Identifier for the entity (DUNS/FEI/FIRMS/manufacturer number). */
  number?: string;
  name?: string;
  address1?: string;
  // PG20 fields — the PG20 is emitted when any of these is present.
  address2?: string;
  aptSuite?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  zip?: string;
  /** PG21 individuals for this entity, emitted after its PG19/PG20. */
  contacts?: PgaContact[];
  /**
   * PG23 affirmations of compliance tied to this entity (e.g. PFR on the
   * MF — FDA guide Table 9-21 note: entity-role AoC codes ride with the
   * PG19 entity they affirm), emitted after the entity's PG19/PG20/PG21.
   */
  affirmations?: PgaAffirmation[];
}

/** PG06 source (origin) / processing data. */
export interface PgaSourceCountry {
  /** e.g. 39 (country of production), 262 (place of growth), HRV (Lacey harvest). */
  typeCode: string;
  /** ISO country (XZ / ZZ special values per p.26). */
  countryCode?: string;
  geographicLocation?: string;
  /** MMDDCCYY. */
  processingStartDate?: string;
  /** MMDDCCYY. */
  processingEndDate?: string;
  processingTypeCode?: string;
  processingDescription?: string;
}

/** PG07 (+ PG08 overflow) trade name / model / item identity data. */
export interface PgaItemIdentity {
  tradeName?: string;
  model?: string;
  /** MMCCYY; zero-fill MM for century+year only (p.28). */
  manufactureMonthYear?: string;
  /** e.g. VIN, serial-number qualifier (Appendix PGA). */
  numberQualifier?: string;
  number?: string;
  /** Additional identity numbers of the same qualifier — PG08 records, 4 per record (p.29). */
  additionalNumbers?: string[];
}

/** One PG26 packaging level. */
export interface PgaQuantity {
  /** Packaging level, 1 = outermost … 6 = innermost (p.42). */
  qualifier: 1 | 2 | 3 | 4 | 5 | 6;
  /** Integer quantity in hundredths (two implied decimals): 277.34 → 27734. */
  quantityHundredths: number;
  /** Unit of measure for the level, e.g. CS, PCS. */
  uom: string;
}

/** PG30 inspection / anticipated arrival data. */
export interface PgaArrival {
  /** R, S, P, L, N, A (anticipated arrival), I, F — p.48. */
  status: 'R' | 'S' | 'P' | 'L' | 'N' | 'A' | 'I' | 'F';
  /** MMDDCCYY. */
  dateMMDDCCYY?: string;
  /** Military time HHMM, 0001-2400. */
  timeHHMM?: string;
  /** FIRMS/facility/DUNS/port code (4AN). */
  locationCode?: string;
  location?: string;
}

/** One PG22 substantiating-document / conformance declaration. */
export interface PgaConformance {
  importersSubstantiatingDocument?: 'Y';
  documentIdentifier?: string;
  /** PGA form box number, e.g. 2B. */
  conformanceDeclaration?: string;
  /** Entity making the declaration (PG19 role codes). */
  entityRoleCode?: string;
  declarationCode?: string;
  declarationCertification?: 'Y';
  /** MMDDCCYY. */
  dateOfSignature?: string;
  invoiceNumber?: string;
  complianceDescription?: string;
}

/**
 * Data-bearing PGA line. Covers the FDA minimal sets: PG01, PG02 'P' with
 * an FDP product code, PG06 source country, PG10 product name, the
 * PG19/PG20/PG21 entity trios (MF/DEQ/FD1/DP), PG26 quantities and PG30
 * anticipated arrival — plus PG07/PG08 item identity and PG22 conformance
 * declarations for other agencies (DOT HS-7 style).
 */
export interface PgaDataSet {
  kind: 'data';
  /** Government agency code, e.g. FDA, EPA (Appendix V). */
  agencyCode: string;
  /** Government agency program code, e.g. FOO (Appendix PGA). */
  programCode: string;
  /** Government agency processing code, e.g. CCW (Appendix PGA). */
  processingCode?: string;
  // Remaining PG01 data elements.
  electronicImageSubmitted?: string;
  confidentialIndicator?: 'Y';
  /** PG01 globally unique product id (GTIN/UPC); non-global codes go on the PG02. */
  globallyUniqueProductId?: PgaProductCode;
  /** Appendix R intended use code, e.g. 081.006. */
  intendedUseCode?: string;
  /** Free-text description when the 980.000 "other use" code is used. */
  intendedUseDescription?: string;
  /**
   * PG02 'P' product codes — 1 to 3 pairs with DISTINCT qualifiers (same
   * qualifier twice at product level forces a new PGA line, p.21).
   * Component-level ('C') reporting is not yet modelled.
   */
  product?: { codes: PgaProductCode[] };
  /** PG06 records, one per source/country (repeat per Lacey country of harvest). */
  sources?: PgaSourceCountry[];
  /** PG07 (+PG08) trade name / model / serial-number data. */
  item?: PgaItemIdentity;
  /** PG10 commodity characteristic description (FDA: common/market product name). */
  productName?: string;
  /**
   * Full PG10 characteristic rows (NHTSA: category type/code + V-qualifier
   * rows, e.g. OFFTYP/OFF1 and V06 model-year CCYY — NHTSA guide Notes
   * 16-19). Emitted after `productName`'s PG10 when both are present.
   */
  characteristics?: {
    categoryTypeCode?: string;
    categoryCode?: string;
    commodityQualifierCode?: string;
    characteristicQualifier?: string;
    characteristicDescription?: string;
  }[];
  /** PG19→PG20→PG21 trios, emitted in order, one trio per entity (p.63-64). */
  entities: PgaEntity[];
  /** PG22 conformance/substantiating-document declarations. */
  conformance?: PgaConformance[];
  /**
   * Shipment-level PG23 affirmations of compliance (e.g. FDA VES vessel
   * name, VFT voyage number for a prior-notice combined entry), emitted
   * after the entities/PG22 and before the PG26 packaging levels.
   */
  affirmations?: PgaAffirmation[];
  /** PG26 packaging levels, outermost first, max 6; last is the base quantity (p.42). */
  quantities?: PgaQuantity[];
  /**
   * PG27 shipping container numbers, three per record (p.43); emitted
   * after PG26 and before PG30. Required for FDA PN containerized cargo.
   */
  containers?: string[];
  /** PG30 inspection / anticipated arrival. */
  arrival?: PgaArrival;
}

export type PgaSet = PgaDisclaimerSet | PgaDataSet;

/** One CBP entry line's PGA Message Set: one OI + one or more PGA lines. */
export interface PgaLineInput {
  /** OI commercial description of the HTS line item (p.16). */
  commercialDescription: string;
  sets: PgaSet[];
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'PgaMessageSet', field, message };
  throw new RecordCodecError([issue]);
}

/** Zero-fill a non-negative integer per the chapter's N formatting rule (p.14). */
function zeroFill(value: number, width: number, field: string): string {
  if (!Number.isInteger(value) || value < 0) {
    fail(field, `must be a non-negative integer, got ${value}`);
  }
  const s = String(value);
  if (s.length > width) fail(field, `value ${value} exceeds ${width} digits`);
  return s.padStart(width, '0');
}

// ── Builder ────────────────────────────────────────────────

/**
 * Build the PGA Message Set record lines for one CBP entry line: the OI
 * record followed by each set's PG01 + child records in the chapter's
 * parent-child order.
 */
export function buildPgaLine(input: PgaLineInput): string[] {
  if (input.sets.length === 0) fail('sets', 'at least one PGA data set is required per PGA-flagged line');

  const lines: string[] = [
    writeRecord(INPUT_OI, { commercialDescription: input.commercialDescription }),
  ];

  // PGA line numbering: 001 per agency, reset on agency change (p.13, p.65).
  let previousAgency: string | undefined;
  let lineNumber = 0;

  input.sets.forEach((set, si) => {
    lineNumber = set.agencyCode === previousAgency ? lineNumber + 1 : 1;
    previousAgency = set.agencyCode;
    const at = `sets[${si}]`;

    const pg01: Record<string, string | undefined> = {
      pgaLineNumber: zeroFill(lineNumber, 3, `${at}.pgaLineNumber`),
      governmentAgencyCode: set.agencyCode,
      governmentAgencyProgramCode: set.programCode,
      governmentAgencyProcessingCode: set.processingCode,
    };

    if (set.kind === 'disclaimer') {
      // p.21/p.63: only the OI and PG01 are submitted for a disclaimed line.
      pg01.disclaimer = set.disclaimerCode;
      lines.push(writeRecord(INPUT_PG01, pg01));
      return;
    }

    pg01.electronicImageSubmitted = set.electronicImageSubmitted;
    pg01.confidentialInformationIndicator = set.confidentialIndicator;
    pg01.globallyUniqueProductIdQualifier = set.globallyUniqueProductId?.qualifier;
    pg01.globallyUniqueProductIdCode = set.globallyUniqueProductId?.number;
    pg01.intendedUseCode = set.intendedUseCode;
    pg01.intendedUseDescription = set.intendedUseDescription;
    lines.push(writeRecord(INPUT_PG01, pg01));

    // PG02 'P' — required when no disclaimer is given (p.21, p.63). The
    // qualifier/number pairs are conditional: NHTSA's own OFF-vehicle sample
    // transmits a bare 'PG02P' (NHTSA guide p.65), so zero pairs is legal.
    if (!set.product) {
      fail(`${at}.product`, "a PG02 with item type 'P' is required when no disclaimer is provided (p.21)");
    }
    const codes = set.product.codes;
    if (codes.length > 3) {
      fail(`${at}.product.codes`, `a PG02 record carries at most 3 qualifier/number pairs, got ${codes.length}`);
    }
    const qualifiers = new Set(codes.map((c) => c.qualifier));
    if (qualifiers.size !== codes.length) {
      fail(
        `${at}.product.codes`,
        'multiple product codes of the same qualifier at product level require a new PGA line (p.21)'
      );
    }
    const pg02: Record<string, string | undefined> = { itemType: 'P' };
    codes.forEach((c, i) => {
      pg02[`productCodeQualifier${i + 1}`] = c.qualifier;
      pg02[`productCodeNumber${i + 1}`] = c.number;
    });
    lines.push(writeRecord(INPUT_PG02, pg02));

    // PG06 source/country records.
    for (const source of set.sources ?? []) {
      lines.push(
        writeRecord(INPUT_PG06, {
          sourceTypeCode: source.typeCode,
          countryCode: source.countryCode,
          geographicLocation: source.geographicLocation,
          processingStartDate: source.processingStartDate,
          processingEndDate: source.processingEndDate,
          processingTypeCode: source.processingTypeCode,
          processingDescription: source.processingDescription,
        })
      );
    }

    // PG07 (+ PG08 continuation records, 4 numbers each, p.29).
    if (set.item) {
      const item = set.item;
      const extra = item.additionalNumbers ?? [];
      if (extra.length > 0 && !item.numberQualifier) {
        fail(
          `${at}.item.additionalNumbers`,
          'PG08 identity numbers must be of the type designated by the PG07 Item Identity Number Qualifier (p.29)'
        );
      }
      lines.push(
        writeRecord(INPUT_PG07, {
          tradeNameBrandName: item.tradeName,
          model: item.model,
          manufactureMonthYear: item.manufactureMonthYear,
          itemIdentityNumberQualifier: item.numberQualifier,
          itemIdentityNumber: item.number,
        })
      );
      for (let i = 0; i < extra.length; i += 4) {
        const chunk = extra.slice(i, i + 4);
        const pg08: Record<string, string | undefined> = {};
        chunk.forEach((n, j) => {
          pg08[`itemIdentityNumber${j + 1}`] = n;
        });
        lines.push(writeRecord(INPUT_PG08, pg08));
      }
    }

    // PG10 product name / characteristic description.
    if (set.productName !== undefined) {
      lines.push(writeRecord(INPUT_PG10, { commodityCharacteristicDescription: set.productName }));
    }
    for (const row of set.characteristics ?? []) {
      lines.push(
        writeRecord(INPUT_PG10, {
          categoryTypeCode: row.categoryTypeCode,
          categoryCode: row.categoryCode,
          commodityQualifierCode: row.commodityQualifierCode,
          commodityCharacteristicQualifier: row.characteristicQualifier,
          commodityCharacteristicDescription: row.characteristicDescription,
        })
      );
    }

    // Entity trios PG19 → PG20 → PG21, kept together per entity (p.63-64).
    set.entities.forEach((entity, ei) => {
      const eAt = `${at}.entities[${ei}]`;
      if ((entity.identificationCode === undefined) !== (entity.number === undefined)) {
        fail(
          `${eAt}.identificationCode`,
          'entity identification code and entity number must be provided together (p.35)'
        );
      }
      lines.push(
        writeRecord(INPUT_PG19, {
          entityRoleCode: entity.roleCode,
          entityIdentificationCode: entity.identificationCode,
          entityNumber: entity.number,
          entityName: entity.name,
          entityAddress1: entity.address1,
        })
      );
      const hasAddress =
        entity.address2 !== undefined ||
        entity.aptSuite !== undefined ||
        entity.city !== undefined ||
        entity.stateProvince !== undefined ||
        entity.country !== undefined ||
        entity.zip !== undefined;
      if (hasAddress) {
        lines.push(
          writeRecord(INPUT_PG20, {
            entityAddress2: entity.address2,
            entityApartmentSuiteNumber: entity.aptSuite,
            entityCity: entity.city,
            entityStateProvince: entity.stateProvince,
            entityCountry: entity.country,
            entityZipPostalCode: entity.zip,
          })
        );
      }
      for (const contact of entity.contacts ?? []) {
        lines.push(
          writeRecord(INPUT_PG21, {
            individualQualifier: contact.qualifier,
            individualName: contact.name,
            individualTelephoneNumber: contact.telephone,
            individualEmailOrFax: contact.emailOrFax,
          })
        );
      }
      // Entity-scoped PG23 affirmations (e.g. PFR with the MF) — association
      // is positional, so they must ride inside the entity's record group.
      for (const aoc of entity.affirmations ?? []) {
        lines.push(
          writeRecord(INPUT_PG23, {
            affirmationOfComplianceCode: aoc.code,
            affirmationOfComplianceDescription: aoc.qualifier,
          })
        );
      }
    });

    // PG22 conformance declarations (after the entities they reference, p.70 example).
    for (const conf of set.conformance ?? []) {
      lines.push(
        writeRecord(INPUT_PG22, {
          importersSubstantiatingDocument: conf.importersSubstantiatingDocument,
          documentIdentifier: conf.documentIdentifier,
          conformanceDeclaration: conf.conformanceDeclaration,
          entityRoleCode: conf.entityRoleCode,
          declarationCode: conf.declarationCode,
          declarationCertification: conf.declarationCertification,
          dateOfSignature: conf.dateOfSignature,
          invoiceNumber: conf.invoiceNumber,
          complianceDescription: conf.complianceDescription,
        })
      );
    }

    // Shipment-level PG23 affirmations (VES/VFT/CAN…, FDA guide Table 9-21).
    for (const aoc of set.affirmations ?? []) {
      lines.push(
        writeRecord(INPUT_PG23, {
          affirmationOfComplianceCode: aoc.code,
          affirmationOfComplianceDescription: aoc.qualifier,
        })
      );
    }

    // PG26 packaging levels — max six, outermost (1) to innermost (p.42).
    const quantities = set.quantities ?? [];
    if (quantities.length > 6) {
      fail(`${at}.quantities`, `PG26 can be repeated up to six times, got ${quantities.length} (p.42)`);
    }
    quantities.forEach((q, qi) => {
      // Levels run 1..n outermost to innermost; a level cannot appear
      // without the levels above it (p.42; FDA guide PG26 notes).
      if (q.qualifier !== qi + 1) {
        fail(
          `${at}.quantities[${qi}].qualifier`,
          `packaging levels must run 1..n outermost to innermost; expected ${qi + 1}, got ${q.qualifier} (p.42)`
        );
      }
      if (q.quantityHundredths <= 0) {
        fail(`${at}.quantities[${qi}].quantityHundredths`, 'quantity must be greater than zero');
      }
      lines.push(
        writeRecord(INPUT_PG26, {
          packagingQualifier: String(q.qualifier),
          quantity: zeroFill(q.quantityHundredths, 12, `${at}.quantities[${qi}].quantityHundredths`),
          unitOfMeasure: q.uom,
        })
      );
    });

    // PG27 shipping containers — three container numbers per record (p.43).
    const containers = set.containers ?? [];
    for (let i = 0; i < containers.length; i += 3) {
      const chunk = containers.slice(i, i + 3);
      const pg27: Record<string, string | undefined> = {};
      chunk.forEach((c, j) => {
        pg27[`containerNumber${j + 1}`] = c;
      });
      lines.push(writeRecord(INPUT_PG27, pg27));
    }

    // PG30 inspection / anticipated arrival.
    if (set.arrival) {
      lines.push(
        writeRecord(INPUT_PG30, {
          inspectionLaboratoryTestingStatus: set.arrival.status,
          inspectionOrArrivalDate: set.arrival.dateMMDDCCYY,
          inspectionOrArrivalTime: set.arrival.timeHHMM,
          inspectionOrArrivalLocationCode: set.arrival.locationCode,
          inspectionOrArrivalLocation: set.arrival.location,
        })
      );
    }
  });

  return lines;
}
