/**
 * Payload v2 → AE builder input.
 *
 * The v2 `entrySummary` section is deliberately shaped like
 * AeEntrySummaryInput; this mapper's real work is date conversion
 * (storage YYYYMMDD → wire MMDDYY) and the build-time completeness checks
 * that storage intentionally defers (duty amounts, grand totals).
 */
import { RecordCodecError, type CodecIssue } from '../records/codec.js';
import type { AeEntrySummaryInput, AeLine, AeTariff } from '../ae/builder.js';
import type { AbiPayloadV2, LineV2, TariffV2 } from './schemaV2.js';

function fail(field: string, message: string): never {
  const issue: CodecIssue = { record: 'PayloadV2', field, message };
  throw new RecordCodecError([issue]);
}

/** YYYYMMDD → MMDDYY (wire format, Record Layout Key class D). */
export function toWireDate(date8: string): string {
  return date8.slice(4, 8) + date8.slice(2, 4);
}

function optWireDate(date8: string | undefined): string | undefined {
  return date8 === undefined ? undefined : toWireDate(date8);
}

function toAeTariff(tariff: TariffV2, path: string): AeTariff {
  if (tariff.dutyCents === undefined) {
    fail(`${path}.dutyCents`, 'duty amount not computed — run the duty engine before building');
  }
  return {
    htsNumber: tariff.htsNumber,
    dutyCents: tariff.dutyCents,
    valueDollars: tariff.valueDollars,
    uomCode1: tariff.uomCode1,
    quantity1Hundredths: tariff.quantity1Hundredths,
    uomCode2: tariff.uomCode2,
    quantity2Hundredths: tariff.quantity2Hundredths,
    uomCode3: tariff.uomCode3,
    quantity3Hundredths: tariff.quantity3Hundredths,
  };
}

function toAeLine(line: LineV2, index: number): AeLine {
  return {
    id: line.id,
    articleSetIndicator: line.articleSetIndicator,
    countryOfOrigin: line.countryOfOrigin,
    countryOfExport: line.countryOfExport,
    dateOfExportation: optWireDate(line.dateOfExportation),
    textileExportDate: optWireDate(line.textileExportDate),
    spiClaimCode: line.spiClaimCode,
    chargesDollars: line.chargesDollars,
    foreignPortOfLading: line.foreignPortOfLading,
    grossWeightKg: line.grossWeightKg,
    textileCategoryCode: line.textileCategoryCode,
    productClaimCode: line.productClaimCode,
    relatedPartyIndicator: line.relatedPartyIndicator,
    naftaNetCostIndicator: line.naftaNetCostIndicator,
    feeExemptionCode: line.feeExemptionCode,
    adNonReimbursementStatement: line.adNonReimbursementStatement,
    ftz: line.ftz
      ? {
          statusCode: line.ftz.statusCode,
          privilegedFilingDate: optWireDate(line.ftz.privilegedFilingDate),
          quantity: line.ftz.quantity,
        }
      : undefined,
    ruling: line.ruling,
    descriptions: line.descriptions,
    parties: line.parties,
    tariffs: line.tariffs.map((t, i) => toAeTariff(t, `lines[${index}].tariffs[${i}]`)),
    visaNumber: line.visaNumber,
    license: line.license,
    adCvdCases: line.adCvdCases,
    declarations: line.declarations,
    irTax: line.irTax,
    otherRevenue: line.otherRevenue,
    fees: line.fees,
    censusOverrides: line.censusOverrides,
  };
}

/**
 * Map a validated v2 payload to the AE builder input for a given filing
 * action. Delete needs only the identity fields and skips completeness
 * checks (the builder emits the bare 10-record).
 */
export function toAeEntrySummaryInput(payload: AbiPayloadV2, action: 'A' | 'R' | 'D'): AeEntrySummaryInput {
  const es = payload.entrySummary;

  const base: AeEntrySummaryInput = {
    action,
    filerCode: es.filerCode,
    entryNumber: es.entryNumber,
    districtPortOfEntry: es.districtPortOfEntry,
    brokerReferenceNumber: es.brokerReferenceNumber,
    entryTypeCode: es.entryTypeCode,
  };
  if (action === 'D') return base;

  if (!es.grandTotals) {
    fail('entrySummary.grandTotals', 'grand totals not computed — run the duty engine before building');
  }

  return {
    ...base,
    motCode: es.motCode,
    bondWaiver: es.bondWaiver,
    cargoReleaseCertification: es.cargoReleaseCertification,
    indicators: es.indicators,
    payment: es.payment
      ? {
          typeCode: es.payment.typeCode,
          preliminaryStatementPrintDate: optWireDate(es.payment.preliminaryStatementPrintDate),
          periodicStatementMonth: es.payment.periodicStatementMonth,
          statementClientBranchId: es.payment.statementClientBranchId,
        }
      : undefined,
    header: {
      importerOfRecordNumber: es.importerOfRecord.number,
      consigneeNumber: es.consigneeNumber,
      designatedNotifyPartyNumber: es.designatedNotifyPartyNumber,
      estimatedEntryDate: optWireDate(es.dates?.estimatedEntry),
      dateOfImportation: optWireDate(es.dates?.importation),
      usStateOfDestination: es.usStateOfDestination,
      foreignTradeZoneId: es.foreignTradeZoneId,
    },
    cargo:
      es.cargo || es.dates?.estimatedArrival || es.dates?.inBond
        ? {
            carrierCode: es.cargo?.carrierCode,
            districtPortOfUnlading: es.cargo?.districtPortOfUnlading,
            estimatedDateOfArrival: optWireDate(es.dates?.estimatedArrival),
            locationOfGoodsCode: es.cargo?.locationOfGoodsCode,
            conveyanceName: es.cargo?.conveyanceName,
            vesselCode: es.cargo?.vesselCode,
            designatedExamPortCode: es.cargo?.designatedExamPortCode,
            inBondDate: optWireDate(es.dates?.inBond),
          }
        : undefined,
    tripIdentifier: es.tripIdentifier,
    manifests: es.manifests,
    warehouse: es.warehouse,
    bonds: es.bonds,
    releases: es.releases,
    missingDocumentCodes: es.missingDocumentCodes,
    headerFees: es.headerFees,
    psc: es.psc,
    lines: es.lines.map((line, i) => toAeLine(line, i)),
    adCvdTotals: es.adCvdTotals,
    feeTotals: es.feeTotals,
    grandTotals: es.grandTotals,
  };
}
