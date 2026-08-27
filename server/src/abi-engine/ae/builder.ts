/**
 * Entry Summary (AE) transaction builder — Entry Summary Create/Update
 * chapter, July 2026 (docs/abi-engine/specs/entry-summary/ae-ax-create-update-2026-07.pdf).
 *
 * Assembles one Entry Summary TRANSACTION grouping (10-Record … 90-Record)
 * from a typed input, following the ES Transaction / Line / Totals input
 * structure maps (ESF-21..24). The output lines go into a block of an
 * AE-application batch via buildBatch().
 *
 * Monetary units are explicit in field names: *Cents where the record
 * implies two decimals, *Dollars where the record takes whole dollars.
 * Quantities carry their implied-decimal factor in the name.
 */
import { writeRecord, RecordCodecError, type CodecIssue } from '../records/codec.js';
import { buildPgaLine, type PgaLineInput } from '../pga/builder.js';
import {
  INPUT_10,
  INPUT_11,
  INPUT_20,
  INPUT_SE13,
  INPUT_21,
  INPUT_22,
  INPUT_23,
  INPUT_30,
  INPUT_31,
  INPUT_32,
  INPUT_33,
  INPUT_34,
  INPUT_35,
  INPUT_36,
  INPUT_SE30,
  INPUT_SE35,
  INPUT_SE36,
} from './headerRecordDefs.js';
import {
  INPUT_40,
  INPUT_41,
  INPUT_43,
  INPUT_44,
  INPUT_47,
  INPUT_50,
  INPUT_51,
  INPUT_52,
  INPUT_53,
  INPUT_54,
  INPUT_60,
  INPUT_61,
  INPUT_62,
  INPUT_63,
  INPUT_CW02,
  INPUT_88,
  INPUT_89,
  INPUT_90,
} from './lineRecordDefs.js';
import { formatEntryNumber } from './checkDigit.js';

// ── Input types ────────────────────────────────────────────

export interface AeBond {
  /** 8 = continuous, 9 = single transaction bond. */
  bondTypeCode: '8' | '9';
  /** B basic, A additional, U substitution STB, E superseding STB. */
  designationTypeCode: 'B' | 'A' | 'U' | 'E';
  /** Continuous only: Y supersedes / S substitutes the bond at entry. */
  continuousBondIndicator?: 'Y' | 'S';
  suretyCompanyCode: string;
  /** STB only: coverage in whole U.S. dollars. */
  stbAmountDollars?: number;
  /** STB only: surety reference number. */
  stbProducerAccountNumber?: string;
}

export interface AeManifestBill {
  /** I in-bond, M master, H house, S sub-house (emitted in that order). */
  type: 'I' | 'M' | 'H' | 'S';
  issuerCode?: string;
  identifier: string;
}

export interface AeManifest {
  manifestedQuantity: number;
  uomCode: string;
  bills: AeManifestBill[];
}

export interface AeTariff {
  htsNumber: string;
  /** Estimated duty, cents (two implied decimals on the wire). */
  dutyCents: number;
  /** Article value, whole U.S. dollars. */
  valueDollars: number;
  /** UOM code 1 is mandatory per the HTS even when quantity 1 is not. */
  /** Omit entirely for zero-reporting-unit tariffs (CERT F441/F442). */
  uomCode1?: string;
  /** Quantity 1 in hundredths (two implied decimals). */
  quantity1Hundredths?: number;
  uomCode2?: string;
  quantity2Hundredths?: number;
  uomCode3?: string;
  quantity3Hundredths?: number;
}

export interface AeAdCvdCase {
  /** 10-digit case number, no hyphens. */
  caseNumber: string;
  /** B = bonded, C = cash deposit. */
  bondCashClaimCode: 'B' | 'C';
  /** Deposit rate, two implied decimals (10.17% → 1017; $110.25 → 11025). */
  depositRateHundredths: number;
  /** A = ad valorem, S = specific. */
  rateTypeQualifier: 'A' | 'S';
  /** AD/CVD value of goods, whole dollars. Zero-filled when absent per spec. */
  valueOfGoodsDollars?: number;
  /** AD/CVD quantity, four implied decimals. Zero-filled when absent. */
  quantityTenThousandths?: number;
  /** Estimated case duty, cents. */
  dutyCents: number;
  nonReimbursementDeclarationId?: string;
}

export interface AeParty {
  /** M manufacturer/supplier, C delivered-to, S sold-to, E foreign exporter. */
  type: 'M' | 'C' | 'S' | 'E';
  identifier: string;
}

/**
 * Certify-for-cargo-release contact (SE13, between the 20- and 21-Records;
 * ESF-41). Spec-mandatory when Replace + certify; CERT's SX also demands it
 * on an Add certify (live condition 11208 MISSING CONTACT INFO, 8/2026).
 */
export interface AeCertifyContact {
  name: string;
  phone: string;
  /** Emits '1': a DIS submission supports the correction request (Note 1). */
  disIndicator?: boolean;
}

export interface AeCargoEntityAddressComponent {
  /** SE35 Note 1: 01 street number, 02 street name, 15 unstructured, … */
  qualifier: string;
  information: string;
}

/**
 * Header Level Cargo Entity (SE30 [+SE35 ×≤3][+SE36]; ESF-58..64).
 * Certify-only: the derived ACE Cargo Release mandates Seller (SE) and
 * Buyer (BY). Name route requires SE35 + SE36; the identifier route
 * (EI / ANI / 34, IOR-number formats) is allowed for BY and ST only.
 */
export interface AeCargoEntity {
  /** CN, SE, BY, ST, LG, CS (+ GBI test SH/EX/DR/PK) — SE30 Note 1. */
  code: string;
  name?: string;
  identifier?: { qualifier: 'EI' | 'ANI' | '34'; value: string };
  addressComponents?: AeCargoEntityAddressComponent[];
  geography?: {
    city: string;
    countrySubEntityCode?: string;
    postalCode?: string;
    countryCode: string;
  };
}

export interface AeFee {
  /** Accounting class code (AE Table 6 / 13 / 17). */
  classCode: string;
  /** Amount in cents (two implied decimals). */
  amountCents: number;
}

export interface AeLine {
  /** Unique line id (≤3 chars). Defaults to 001, 002, … */
  id?: string;
  /** X = article-set header, V = component. */
  articleSetIndicator?: 'X' | 'V';
  countryOfOrigin: string;
  countryOfExport?: string;
  /** MMDDYY. */
  dateOfExportation?: string;
  textileExportDate?: string;
  /** Trade agreement / special program claim (AE Table 8). */
  spiClaimCode?: string;
  /** Aggregate charges, whole dollars. Spec: report zeroes if not used. */
  chargesDollars?: number;
  foreignPortOfLading?: string;
  /** Gross weight in kg. Spec: report zeroes if not used. */
  grossWeightKg?: number;
  textileCategoryCode?: string;
  productClaimCode?: string;
  relatedPartyIndicator?: 'Y' | 'N';
  naftaNetCostIndicator?: 'Y';
  feeExemptionCode?: string;
  adNonReimbursementStatement?: 'Y';
  ftz?: { statusCode: 'P' | 'N' | 'D'; privilegedFilingDate?: string; quantity: number };
  ruling?: { typeCode: 'C' | 'P' | 'R'; number?: string };
  descriptions?: string[];
  parties?: AeParty[];
  tariffs: AeTariff[];
  visaNumber?: string;
  license?: { typeCode: string; number: string };
  adCvdCases?: AeAdCvdCase[];
  declarations?: { typeCode: string; information: string }[];
  irTax?: AeFee;
  otherRevenue?: AeFee;
  fees?: AeFee[];
  pscReasonCodes?: string[];
  censusOverrides?: { conditionCode: string; overrideCode: string }[];
  /** PGA message-set data for the line (OI + PG records follow the 50s). */
  pga?: PgaLineInput;
}

export interface AeEntrySummaryInput {
  /** A add, R replace, D delete. */
  action: 'A' | 'R' | 'D';
  filerCode: string;
  /** 7-digit sequence (check digit computed) or full 8-char entry number. */
  entryNumber: string;
  districtPortOfEntry: string;
  brokerReferenceNumber?: string;
  entryTypeCode: string;
  motCode?: string;
  /** Present = bond waived ('0' indicator), with optional reason (AE Table 4). */
  bondWaiver?: { reasonCode?: string };
  cargoReleaseCertification?: boolean;
  /** SE13 contact — only with cargoReleaseCertification (ESF-41). */
  certifyContact?: AeCertifyContact;
  indicators?: {
    electronicInvoice?: boolean;
    consolidatedSummary?: boolean;
    shipmentUsageTypeCode?: 'P' | 'X';
    liveEntry?: boolean;
    deferredTaxPaymentCode?: '1' | '2';
    tradeAgreementReconciliation?: boolean;
    reconciliationIssueCode?: string;
    postSummaryCorrection?: boolean;
    acceleratedLiquidation?: boolean;
    knownImporter?: boolean;
    pgaDataIncluded?: 'Y' | 'F';
    tibDeclaration?: boolean;
    consolidatedExpressInformal?: boolean;
  };
  payment?: {
    typeCode: '1' | '2' | '3' | '5' | '6' | '7' | '8';
    preliminaryStatementPrintDate?: string;
    periodicStatementMonth?: string;
    statementClientBranchId?: string;
  };
  header?: {
    importerOfRecordNumber: string;
    consigneeNumber?: string;
    designatedNotifyPartyNumber?: string;
    /** MMDDYY. */
    estimatedEntryDate?: string;
    dateOfImportation?: string;
    usStateOfDestination?: string;
    foreignTradeZoneId?: string;
  };
  cargo?: {
    carrierCode?: string;
    districtPortOfUnlading?: string;
    estimatedDateOfArrival?: string;
    locationOfGoodsCode?: string;
    conveyanceName?: string;
    vesselCode?: string;
    designatedExamPortCode?: string;
    inBondDate?: string;
  };
  tripIdentifier?: string;
  manifests?: AeManifest[];
  warehouse?: {
    filerCode: string;
    entryNumber: string;
    districtPortCode: string;
    finalWithdrawal?: boolean;
  };
  bonds?: AeBond[];
  /** Consolidated releases (filer + entry number pairs; 6 per 32-record). */
  releases?: { filerCode: string; entryNumber: string }[];
  /** Up to two missing-document codes (AE Table 7). */
  missingDocumentCodes?: string[];
  /** Up to two header-level fees (311/496/500). */
  headerFees?: AeFee[];
  psc?: { headerReasonCodes: string[]; explanationLines: string[] };
  /**
   * Header Level Cargo Entity Grouping (≤12) — the last header grouping
   * before the lines; only with cargoReleaseCertification (ESF-58).
   */
  cargoEntities?: AeCargoEntity[];
  lines?: AeLine[];
  adCvdTotals?: {
    bondedAdCents?: number;
    cashAdCents?: number;
    bondedCvCents?: number;
    cashCvCents?: number;
  };
  /** Fee totals by class (89-Record); required when any 34/62 fee reported. */
  feeTotals?: AeFee[];
  /** Grand totals (90-Record); mandatory on Add/Replace. */
  grandTotals?: {
    dutyCents: number;
    userFeeCents: number;
    irTaxCents: number;
    adDutyCents: number;
    cvDutyCents: number;
    otherRevenueCents?: number;
  };
}

// ── Helpers ────────────────────────────────────────────────

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'EntrySummary', field, message };
  throw new RecordCodecError([issue]);
}

/** Format a non-negative integer amount for an (S)N field. */
function num(value: number, field: string): string {
  if (!Number.isInteger(value) || value < 0) {
    fail(field, `amount must be a non-negative integer, got ${value}`);
  }
  return String(value);
}

function optNum(value: number | undefined, field: string): string | undefined {
  return value === undefined ? undefined : num(value, field);
}

function bool(value: boolean | undefined, flag = 'Y'): string | undefined {
  return value ? flag : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Bills lead, in-bond references trail — three live F187s (8/27) ruled out
// the printed I-first reading; M/H/S then I is the wire truth being tested.
const BILL_ORDER: Record<AeManifestBill['type'], number> = { M: 0, H: 1, S: 2, I: 3 };

// ── Builder ────────────────────────────────────────────────

/**
 * Build one Entry Summary transaction as 80-char record lines. A Delete
 * action emits only the 10-Record, per the spec's delete restrictions.
 */
export function buildEntrySummary(input: AeEntrySummaryInput): string[] {
  const isDelete = input.action === 'D';
  const entryNumber = formatEntryNumber(input.filerCode, input.entryNumber);
  const lines: string[] = [];

  lines.push(
    writeRecord(INPUT_10, {
      actionRequestCode: input.action,
      entryFilerCode: input.filerCode,
      entryNumber,
      districtPortOfEntry: input.districtPortOfEntry,
      brokerReferenceNumber: input.brokerReferenceNumber,
      entryTypeCode: input.entryTypeCode,
      ...(isDelete
        ? {}
        : {
            motCode: input.motCode,
            bondWaiverIndicator: input.bondWaiver ? '0' : undefined,
            bondWaiverReasonCode: input.bondWaiver?.reasonCode,
            electronicSignature: 'X', // mandatory on Add/Replace (ESF-28)
            cargoReleaseCertificationRequestIndicator: bool(input.cargoReleaseCertification, 'A'),
            electronicInvoiceIndicator: bool(input.indicators?.electronicInvoice),
            consolidatedSummaryIndicator: bool(input.indicators?.consolidatedSummary),
            shipmentUsageTypeCode: input.indicators?.shipmentUsageTypeCode,
            liveEntryIndicator: bool(input.indicators?.liveEntry),
            deferredTaxPaymentCode: input.indicators?.deferredTaxPaymentCode,
            tradeAgreementReconciliationIndicator: bool(input.indicators?.tradeAgreementReconciliation),
            reconciliationIssueCode: input.indicators?.reconciliationIssueCode,
            paymentTypeCode: input.payment?.typeCode,
            preliminaryStatementPrintDate: input.payment?.preliminaryStatementPrintDate,
            periodicStatementMonth: input.payment?.periodicStatementMonth,
            statementClientBranchIdentifier: input.payment?.statementClientBranchId,
            postSummaryCorrectionIndicator: bool(input.indicators?.postSummaryCorrection),
            acceleratedLiquidationRequestIndicator: bool(input.indicators?.acceleratedLiquidation),
            knownImporterIndicator: bool(input.indicators?.knownImporter),
            pgaDataIncludedIndicator: input.indicators?.pgaDataIncluded,
            tibDeclarationIndicator: bool(input.indicators?.tibDeclaration),
            consolidatedExpressInformalIndicator: bool(input.indicators?.consolidatedExpressInformal),
          }),
    })
  );
  if (isDelete) return lines;

  // 11-Record is mandatory on Add/Replace (ESF-36).
  if (!input.header?.importerOfRecordNumber) {
    fail('header.importerOfRecordNumber', 'importer of record is mandatory on Add/Replace');
  }
  lines.push(
    writeRecord(INPUT_11, {
      importerOfRecordNumber: input.header.importerOfRecordNumber,
      consigneeNumber: input.header.consigneeNumber,
      designatedNotifyPartyNumber: input.header.designatedNotifyPartyNumber,
      estimatedEntryDate: input.header.estimatedEntryDate,
      dateOfImportation: input.header.dateOfImportation,
      usStateOfDestinationCode: input.header.usStateOfDestination,
      foreignTradeZoneIdentifier: input.header.foreignTradeZoneId,
    })
  );

  if (input.cargo) {
    lines.push(
      writeRecord(INPUT_20, {
        carrierCode: input.cargo.carrierCode,
        districtPortOfUnlading: input.cargo.districtPortOfUnlading,
        estimatedDateOfArrival: input.cargo.estimatedDateOfArrival,
        locationOfGoodsCode: input.cargo.locationOfGoodsCode,
        conveyanceName: input.cargo.conveyanceName,
        vesselCode: input.cargo.vesselCode,
        designatedExamPortCode: input.cargo.designatedExamPortCode,
        inBondInTransitDate: input.cargo.inBondDate,
      })
    );
  }

  // SE13 sits between the 20- and 21-Records (ES header structure map,
  // ESF-21). Spec-mandatory when Replace + certify (ESF-41); CERT's SX
  // also wants it on an Add certify (11208 MISSING CONTACT INFO, live).
  if (input.certifyContact) {
    if (!input.cargoReleaseCertification) {
      fail('certifyContact', 'the SE13 contact is only transmitted when certifying for cargo release (ESF-41)');
    }
    lines.push(
      writeRecord(INPUT_SE13, {
        contactName: input.certifyContact.name,
        contactPhone: input.certifyContact.phone,
        disIndicator: input.certifyContact.disIndicator ? '1' : undefined,
      })
    );
  } else if (input.action === 'R' && input.cargoReleaseCertification) {
    fail('certifyContact', 'the SE13 contact detail is mandatory on a Replace that certifies for cargo release (ESF-41)');
  }

  if (input.tripIdentifier) {
    lines.push(writeRecord(INPUT_21, { tripIdentifier: input.tripIdentifier }));
  }

  for (const manifest of input.manifests ?? []) {
    lines.push(
      writeRecord(INPUT_22, {
        manifestedQuantity: num(manifest.manifestedQuantity, 'manifestedQuantity'),
        manifestedQuantityUnitOfMeasureCode: manifest.uomCode,
      })
    );
    const bills = [...manifest.bills].sort((a, b) => BILL_ORDER[a.type] - BILL_ORDER[b.type]);
    for (const bill of bills) {
      lines.push(
        writeRecord(INPUT_23, {
          manifestComponentTypeCode: bill.type,
          manifestComponentIssuerCode: bill.issuerCode,
          manifestComponentIdentifier: bill.identifier,
        })
      );
    }
  }

  if (input.warehouse) {
    lines.push(
      writeRecord(INPUT_30, {
        associatedWarehouseEntryFilerCode: input.warehouse.filerCode,
        associatedWarehouseEntryNumber: input.warehouse.entryNumber,
        associatedWarehouseEntryDistrictPortCode: input.warehouse.districtPortCode,
        finalWarehouseWithdrawalIndicator: bool(input.warehouse.finalWithdrawal),
      })
    );
  }

  for (const bond of input.bonds ?? []) {
    lines.push(
      writeRecord(INPUT_31, {
        bondTypeCode: bond.bondTypeCode,
        bondDesignationTypeCode: bond.designationTypeCode,
        continuousBondIndicator: bond.continuousBondIndicator,
        suretyCompanyCode: bond.suretyCompanyCode,
        singleTransactionBondAmount: optNum(bond.stbAmountDollars, 'stbAmountDollars'),
        singleTransactionBondProducerAccountNumber: bond.stbProducerAccountNumber,
      })
    );
  }

  for (const group of chunk(input.releases ?? [], 6)) {
    const values: Record<string, string> = {};
    group.forEach((release, i) => {
      values[`releaseEntryFilerCode${i + 1}`] = release.filerCode;
      values[`releaseEntryNumber${i + 1}`] = release.entryNumber;
    });
    lines.push(writeRecord(INPUT_32, values));
  }

  if (input.missingDocumentCodes && input.missingDocumentCodes.length > 0) {
    if (input.missingDocumentCodes.length > 2) {
      fail('missingDocumentCodes', 'at most two missing document codes (use 99 for more)');
    }
    lines.push(
      writeRecord(INPUT_33, {
        missingDocumentCode1: input.missingDocumentCodes[0],
        missingDocumentCode2: input.missingDocumentCodes[1],
      })
    );
  }

  if (input.headerFees && input.headerFees.length > 0) {
    if (input.headerFees.length > 2) fail('headerFees', 'at most two header fees per summary');
    const values: Record<string, string> = {};
    input.headerFees.forEach((fee, i) => {
      values[`accountingClassCode${i + 1}`] = fee.classCode;
      values[`headerFeeAmount${i + 1}`] = num(fee.amountCents, 'headerFees.amountCents');
    });
    lines.push(writeRecord(INPUT_34, values));
  }

  if (input.psc) {
    if (input.psc.headerReasonCodes.length > 0) {
      if (input.psc.headerReasonCodes.length > 5) {
        fail('psc.headerReasonCodes', 'at most five PSC header reason codes');
      }
      const values: Record<string, string> = {};
      input.psc.headerReasonCodes.forEach((code, i) => {
        values[`pscHeaderReasonCode${i + 1}`] = code;
      });
      lines.push(writeRecord(INPUT_35, values));
    }
    for (const text of input.psc.explanationLines) {
      lines.push(writeRecord(INPUT_36, { pscFilingExplanationText: text }));
    }
  }

  // Header Level Cargo Entity Grouping (SE30 [+SE35 ×≤3][+SE36]) — the
  // last header grouping before the lines (ES header structure map,
  // ESF-22). Certify-only: the derived ACE Cargo Release mandates Seller
  // (SE, name+address) and Buyer (BY, name+address or an EI/ANI/34
  // identifier) at the header or line level (ESF-58).
  const cargoEntities = input.cargoEntities ?? [];
  if (cargoEntities.length > 0 && !input.cargoReleaseCertification) {
    fail('cargoEntities', 'header cargo entities are only transmitted when certifying for cargo release (ESF-58)');
  }
  if (cargoEntities.length > 12) {
    fail('cargoEntities', 'at most 12 header cargo entities (ES header structure map, ESF-22)');
  }
  const seenEntityCodes = new Set<string>();
  cargoEntities.forEach((entity, i) => {
    const at = `cargoEntities[${i}]`;
    if (seenEntityCodes.has(entity.code)) {
      fail(at, `each Entity Code may be reported at most once at the header level; ${entity.code} repeats (ESF-58)`);
    }
    seenEntityCodes.add(entity.code);
    const hasName = entity.name !== undefined;
    if (hasName === (entity.identifier !== undefined)) {
      fail(at, 'provide either an Entity Name or an Entity Identifier, never both (ESF-63)');
    }
    if (entity.identifier && entity.code !== 'BY' && entity.code !== 'ST') {
      fail(at, 'an Entity Identifier may only be used with Entity Codes BY or ST (SE30 Note 2)');
    }
    lines.push(
      writeRecord(INPUT_SE30, {
        entityCode: entity.code,
        entityName: entity.name,
        entityIdentifierQualifier: entity.identifier?.qualifier,
        entityIdentifier: entity.identifier?.value,
      })
    );
    if (hasName) {
      const components = entity.addressComponents ?? [];
      if (components.length === 0 || !entity.geography) {
        fail(at, 'the SE35 address and SE36 city/country records are mandatory when an Entity Name is reported (ESF-63/64)');
      }
      if (components.length > 6) {
        fail(at, 'at most 3 SE35 records (6 address components) per entity (ES header structure map, ESF-22)');
      }
      for (const pair of chunk(components, 2)) {
        lines.push(
          writeRecord(INPUT_SE35, {
            addressComponentQualifier1: pair[0].qualifier,
            addressInformation1: pair[0].information,
            addressComponentQualifier2: pair[1]?.qualifier,
            addressInformation2: pair[1]?.information,
          })
        );
      }
      const geo = entity.geography!;
      lines.push(
        writeRecord(INPUT_SE36, {
          cityName: geo.city,
          countrySubEntityCode: geo.countrySubEntityCode,
          postalCode: geo.postalCode,
          countryCode: geo.countryCode,
        })
      );
    }
  });

  const summaryLines = input.lines ?? [];
  if (summaryLines.length === 0) {
    fail('lines', 'at least one line item is mandatory on Add/Replace');
  }
  summaryLines.forEach((line, index) => {
    const lineId = line.id ?? String(index + 1).padStart(3, '0');
    lines.push(
      writeRecord(INPUT_40, {
        lineItemIdentifier: lineId,
        articleSetIndicator: line.articleSetIndicator,
        countryOfOriginCode: line.countryOfOrigin,
        countryOfExportCode: line.countryOfExport,
        dateOfExportation: line.dateOfExportation,
        textileExportDate: line.textileExportDate,
        spiClaimCode: line.spiClaimCode,
        chargesAmount: num(line.chargesDollars ?? 0, 'chargesDollars'),
        foreignPortOfLadingCode: line.foreignPortOfLading,
        grossShippingWeight: num(line.grossWeightKg ?? 0, 'grossWeightKg'),
        textileCategoryCode: line.textileCategoryCode,
        productClaimCode: line.productClaimCode,
        relatedPartyIndicator: line.relatedPartyIndicator,
        naftaNetCostIndicator: line.naftaNetCostIndicator,
        feeExemptionCode: line.feeExemptionCode,
        adCaseNonReimbursementStatement: line.adNonReimbursementStatement,
      })
    );

    if (line.ftz) {
      lines.push(
        writeRecord(INPUT_41, {
          ftzMerchandiseStatusCode: line.ftz.statusCode,
          privilegedFtzMerchandiseFilingDate: line.ftz.privilegedFilingDate,
          ftzLineItemQuantity: num(line.ftz.quantity, 'ftz.quantity'),
        })
      );
    }

    if (line.ruling) {
      lines.push(
        writeRecord(INPUT_43, {
          rulingTypeCode: line.ruling.typeCode,
          rulingNumber: line.ruling.number,
        })
      );
    }
    for (const description of line.descriptions ?? []) {
      lines.push(writeRecord(INPUT_44, { commercialDescriptionText: description }));
    }
    for (const party of line.parties ?? []) {
      lines.push(
        writeRecord(INPUT_47, {
          articlePartyTypeCode: party.type,
          articlePartyIdentifier: party.identifier,
        })
      );
    }

    if (line.tariffs.length === 0) {
      fail(`lines[${index}].tariffs`, 'the tariff grouping is mandatory for a line item');
    }
    for (const tariff of line.tariffs) {
      lines.push(
        writeRecord(INPUT_50, {
          htsNumber: tariff.htsNumber,
          dutyAmount: num(tariff.dutyCents, 'dutyCents'),
          valueOfGoodsAmount: num(tariff.valueDollars, 'valueDollars'),
          quantity1: optNum(tariff.quantity1Hundredths, 'quantity1Hundredths'),
          uomCode1: tariff.uomCode1,
          quantity2: optNum(tariff.quantity2Hundredths, 'quantity2Hundredths'),
          uomCode2: tariff.uomCode2,
          quantity3: optNum(tariff.quantity3Hundredths, 'quantity3Hundredths'),
          uomCode3: tariff.uomCode3,
        })
      );
    }

    // PGA message set attaches directly after the 50-records (MS p.13:
    // "AE Entry Summary \u2192 50-record then PGA set").
    if (line.pga) {
      lines.push(...buildPgaLine(line.pga));
    }

    if (line.visaNumber) {
      lines.push(writeRecord(INPUT_51, { standardVisaNumber: line.visaNumber }));
    }
    if (line.license) {
      lines.push(
        writeRecord(INPUT_52, {
          licenseCertificatePermitTypeCode: line.license.typeCode,
          licenseCertificatePermitNumber: line.license.number,
        })
      );
    }

    if (line.adCvdCases && line.adCvdCases.length > 2) {
      fail(`lines[${index}].adCvdCases`, 'at most two AD/CVD cases per line item');
    }
    for (const adCvd of line.adCvdCases ?? []) {
      lines.push(
        writeRecord(INPUT_53, {
          caseNumber: adCvd.caseNumber,
          bondCashClaimCode: adCvd.bondCashClaimCode,
          caseDepositRate: num(adCvd.depositRateHundredths, 'depositRateHundredths'),
          caseRateTypeQualifierCode: adCvd.rateTypeQualifier,
          adCvdValueOfGoodsAmount: num(adCvd.valueOfGoodsDollars ?? 0, 'valueOfGoodsDollars'),
          adCvdQuantity: num(adCvd.quantityTenThousandths ?? 0, 'quantityTenThousandths'),
          adCvdDutyAmount: num(adCvd.dutyCents, 'adCvd.dutyCents'),
          adCvdNonReimbursementDeclarationId: adCvd.nonReimbursementDeclarationId,
        })
      );
    }

    for (const declaration of line.declarations ?? []) {
      lines.push(
        writeRecord(INPUT_54, {
          declarationTypeCode: declaration.typeCode,
          declarationInformation: declaration.information,
        })
      );
    }
    if (line.irTax) {
      lines.push(
        writeRecord(INPUT_60, {
          accountingClassCode: line.irTax.classCode,
          irTaxAmount: num(line.irTax.amountCents, 'irTax.amountCents'),
        })
      );
    }
    if (line.otherRevenue) {
      lines.push(
        writeRecord(INPUT_61, {
          accountingClassCode: line.otherRevenue.classCode,
          otherRevenueAmount: num(line.otherRevenue.amountCents, 'otherRevenue.amountCents'),
        })
      );
    }
    for (const fee of line.fees ?? []) {
      lines.push(
        writeRecord(INPUT_62, {
          accountingClassCode: fee.classCode,
          userFeeAmount: num(fee.amountCents, 'fees.amountCents'),
        })
      );
    }

    if (line.pscReasonCodes && line.pscReasonCodes.length > 0) {
      if (line.pscReasonCodes.length > 5) {
        fail(`lines[${index}].pscReasonCodes`, 'at most five PSC line reason codes');
      }
      const values: Record<string, string> = {};
      line.pscReasonCodes.forEach((code, i) => {
        values[`postSummaryCorrectionLineReasonCode${i + 1}`] = code;
      });
      lines.push(writeRecord(INPUT_63, values));
    }

    if (line.censusOverrides && line.censusOverrides.length > 0) {
      if (line.censusOverrides.length > 7) {
        fail(`lines[${index}].censusOverrides`, 'at most seven census override pairs');
      }
      const values: Record<string, string> = {};
      line.censusOverrides.forEach((pair, i) => {
        values[`censusWarningConditionCode${i + 1}`] = pair.conditionCode;
        values[`censusWarningConditionOverrideCode${i + 1}`] = pair.overrideCode;
      });
      lines.push(writeRecord(INPUT_CW02, values));
    }
  });

  if (input.adCvdTotals) {
    lines.push(
      writeRecord(INPUT_88, {
        totalBondedAdDutyAmount: num(input.adCvdTotals.bondedAdCents ?? 0, 'bondedAdCents'),
        totalCashDepositAdDutyAmount: num(input.adCvdTotals.cashAdCents ?? 0, 'cashAdCents'),
        totalBondedCvDutyAmount: num(input.adCvdTotals.bondedCvCents ?? 0, 'bondedCvCents'),
        totalCashDepositCvDutyAmount: num(input.adCvdTotals.cashCvCents ?? 0, 'cashCvCents'),
      })
    );
  }

  for (const group of chunk(input.feeTotals ?? [], 5)) {
    const values: Record<string, string> = {};
    group.forEach((fee, i) => {
      values[`accountingClassCode${i + 1}`] = fee.classCode;
      values[`totalFeeAmount${i + 1}`] = num(fee.amountCents, 'feeTotals.amountCents');
    });
    lines.push(writeRecord(INPUT_89, values));
  }

  // Grand totals are mandatory on Add/Replace; report $0.00 where free (ESF-133).
  if (!input.grandTotals) {
    fail('grandTotals', 'grand totals (90-Record) are mandatory on Add/Replace');
  }
  lines.push(
    writeRecord(INPUT_90, {
      grandTotalDutyAmount: num(input.grandTotals.dutyCents, 'grandTotals.dutyCents'),
      grandTotalUserFeeAmount: num(input.grandTotals.userFeeCents, 'grandTotals.userFeeCents'),
      grandTotalIrTaxAmount: num(input.grandTotals.irTaxCents, 'grandTotals.irTaxCents'),
      grandTotalAdDutyAmount: num(input.grandTotals.adDutyCents, 'grandTotals.adDutyCents'),
      grandTotalCvDutyAmount: num(input.grandTotals.cvDutyCents, 'grandTotals.cvDutyCents'),
      grandTotalOtherRevenueAmount: num(input.grandTotals.otherRevenueCents ?? 0, 'grandTotals.otherRevenueCents'),
    })
  );

  return lines;
}
