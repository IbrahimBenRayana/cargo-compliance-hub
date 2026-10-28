/**
 * ABI payload schema v2 — versioned, CATAIR-aligned document format
 * (MIGRATION_PLAN.md decision D2).
 *
 * v1 payloads (AbiDocumentBody, services/abi/types.ts) mirror the
 * CustomsCity API and can express only a narrow slice of an entry summary
 * (types 01/11/86, one HTS per item, no duty amounts, no AD/CVD, no fees).
 * v2 is a superset aligned to the Entry Summary Create/Update chapter: its
 * `entrySummary` section maps 1:1 onto the AE builder's input, while
 * `commercial` retains invoice/party context that does not ride on AE
 * records (SKUs, addresses, currencies) for the UI and future cargo
 * release work.
 *
 * Storage stays JSONB on AbiDocument; `schemaVersion` discriminates.
 * Dates are stored as YYYYMMDD (century-unambiguous) and converted to the
 * wire's MMDDYY by the mapper (toAeInput.ts).
 */
import { z } from 'zod';

// ── Scalars ────────────────────────────────────────────────

/** YYYYMMDD storage date. */
export const zDate8 = z.string().regex(/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/, 'expected YYYYMMDD');

const zMoneyCents = z.number().int().nonnegative();
const zMoneyDollars = z.number().int().nonnegative();

const zFee = z.object({
  classCode: z.string().min(3).max(3),
  amountCents: zMoneyCents,
});

// ── Entry summary section (maps 1:1 onto AeEntrySummaryInput) ──

export const zTariffV2 = z.object({
  htsNumber: z.string().regex(/^\d{8}(\d{2})?$/, 'expected 8- or 10-digit HTS number'),
  /** Estimated duty in cents. Absent = not yet computed (duty engine fills it). */
  dutyCents: zMoneyCents.optional(),
  valueDollars: zMoneyDollars,
  // Optional since Aug 2026: zero-reporting-unit tariffs (e.g. 9999.00.84)
  // must omit UOM entirely — CERT rejects any code on them (F441/F442).
  uomCode1: z.string().min(1).max(3).optional(),
  quantity1Hundredths: z.number().int().nonnegative().optional(),
  uomCode2: z.string().max(3).optional(),
  quantity2Hundredths: z.number().int().nonnegative().optional(),
  uomCode3: z.string().max(3).optional(),
  quantity3Hundredths: z.number().int().nonnegative().optional(),
});

export const zAdCvdCaseV2 = z.object({
  caseNumber: z.string().regex(/^[A-Z0-9]{10}$/i, 'expected 10-char case number without hyphens'),
  bondCashClaimCode: z.enum(['B', 'C']),
  depositRateHundredths: z.number().int().nonnegative(),
  rateTypeQualifier: z.enum(['A', 'S']),
  valueOfGoodsDollars: zMoneyDollars.optional(),
  quantityTenThousandths: z.number().int().nonnegative().optional(),
  dutyCents: zMoneyCents,
  nonReimbursementDeclarationId: z.string().max(10).optional(),
});

export const zArticlePartyV2 = z.object({
  /** M manufacturer/supplier, C delivered-to, S sold-to, E foreign exporter. */
  type: z.enum(['M', 'C', 'S', 'E']),
  identifier: z.string().min(1).max(15),
});

export const zLineV2 = z.object({
  id: z.string().max(3).optional(),
  articleSetIndicator: z.enum(['X', 'V']).optional(),
  countryOfOrigin: z.string().min(2).max(2),
  countryOfExport: z.string().length(2).optional(),
  /** YYYYMMDD. */
  dateOfExportation: zDate8.optional(),
  textileExportDate: zDate8.optional(),
  spiClaimCode: z.string().max(2).optional(),
  chargesDollars: zMoneyDollars.optional(),
  foreignPortOfLading: z.string().max(5).optional(),
  grossWeightKg: z.number().int().nonnegative().optional(),
  textileCategoryCode: z.string().max(3).optional(),
  productClaimCode: z.string().max(1).optional(),
  relatedPartyIndicator: z.enum(['Y', 'N']).optional(),
  naftaNetCostIndicator: z.literal('Y').optional(),
  feeExemptionCode: z.string().max(1).optional(),
  adNonReimbursementStatement: z.literal('Y').optional(),
  ftz: z
    .object({
      statusCode: z.enum(['P', 'N', 'D']),
      privilegedFilingDate: zDate8.optional(),
      quantity: z.number().int().nonnegative(),
    })
    .optional(),
  ruling: z.object({ typeCode: z.enum(['C', 'P', 'R']), number: z.string().max(6).optional() }).optional(),
  descriptions: z.array(z.string().min(1).max(70)).optional(),
  parties: z.array(zArticlePartyV2).optional(),
  tariffs: z.array(zTariffV2).min(1).max(32),
  visaNumber: z.string().max(9).optional(),
  license: z.object({ typeCode: z.string().length(2), number: z.string().min(1).max(10) }).optional(),
  adCvdCases: z.array(zAdCvdCaseV2).max(2).optional(),
  declarations: z
    .array(z.object({ typeCode: z.string().length(2), information: z.string().min(1).max(76) }))
    .max(9)
    .optional(),
  irTax: zFee.optional(),
  otherRevenue: zFee.optional(),
  fees: z.array(zFee).max(9).optional(),
  censusOverrides: z
    .array(z.object({ conditionCode: z.string().max(3), overrideCode: z.string().max(2) }))
    .max(7)
    .optional(),
  /** Line-level PSC reason codes (max 5, PSC filings only). */
  pscReasonCodes: z.array(z.string().max(3)).max(5).optional(),
  /** Commercial context (not transmitted on AE records). */
  sku: z.string().optional(),
});

export const zEntrySummaryV2 = z.object({
  filerCode: z.string().regex(/^[A-Z0-9]{3}$/i),
  /** 7-digit sequence (check digit computed at build) or full 8 chars. */
  entryNumber: z.string().regex(/^\d{7,8}$/),
  districtPortOfEntry: z.string().min(4).max(4),
  brokerReferenceNumber: z.string().max(9).optional(),
  entryTypeCode: z.string().length(2),
  motCode: z.string().length(2).optional(),
  dates: z
    .object({
      estimatedEntry: zDate8.optional(),
      importation: zDate8.optional(),
      estimatedArrival: zDate8.optional(),
      inBond: zDate8.optional(),
    })
    .optional(),
  importerOfRecord: z.object({ number: z.string().min(1).max(12), name: z.string().optional() }),
  consigneeNumber: z.string().max(12).optional(),
  designatedNotifyPartyNumber: z.string().max(12).optional(),
  usStateOfDestination: z.string().length(2).optional(),
  foreignTradeZoneId: z.string().max(9).optional(),
  bondWaiver: z.object({ reasonCode: z.string().max(3).optional() }).optional(),
  bonds: z
    .array(
      z.object({
        bondTypeCode: z.enum(['8', '9']),
        designationTypeCode: z.enum(['B', 'A', 'U', 'E']),
        continuousBondIndicator: z.enum(['Y', 'S']).optional(),
        suretyCompanyCode: z.string().min(3).max(3),
        stbAmountDollars: zMoneyDollars.optional(),
        stbProducerAccountNumber: z.string().max(10).optional(),
      })
    )
    .max(2)
    .optional(),
  payment: z
    .object({
      typeCode: z.enum(['1', '2', '3', '5', '6', '7', '8']),
      /** YYYYMMDD. */
      preliminaryStatementPrintDate: zDate8.optional(),
      periodicStatementMonth: z.string().length(2).optional(),
      statementClientBranchId: z.string().max(2).optional(),
    })
    .optional(),
  cargo: z
    .object({
      carrierCode: z.string().max(4).optional(),
      districtPortOfUnlading: z.string().max(4).optional(),
      locationOfGoodsCode: z.string().max(4).optional(),
      conveyanceName: z.string().max(20).optional(),
      vesselCode: z.string().max(7).optional(),
      designatedExamPortCode: z.string().max(4).optional(),
    })
    .optional(),
  tripIdentifier: z.string().max(5).optional(),
  manifests: z
    .array(
      z.object({
        manifestedQuantity: z.number().int().positive(),
        uomCode: z.string().min(1).max(5),
        bills: z
          .array(
            z.object({
              type: z.enum(['I', 'M', 'H', 'S']),
              issuerCode: z.string().max(4).optional(),
              identifier: z.string().min(1).max(12),
            })
          )
          .min(1)
          .max(4),
      })
    )
    .optional(),
  warehouse: z
    .object({
      filerCode: z.string().length(3),
      entryNumber: z.string().length(8),
      districtPortCode: z.string().length(4),
      finalWithdrawal: z.boolean().optional(),
    })
    .optional(),
  releases: z.array(z.object({ filerCode: z.string().length(3), entryNumber: z.string().length(8) })).optional(),
  missingDocumentCodes: z.array(z.string().length(2)).max(2).optional(),
  headerFees: z.array(zFee).max(2).optional(),
  psc: z
    .object({
      headerReasonCodes: z.array(z.string().max(3)).max(5),
      explanationLines: z.array(z.string().min(1).max(75)).min(1),
    })
    .optional(),
  indicators: z
    .object({
      electronicInvoice: z.boolean().optional(),
      consolidatedSummary: z.boolean().optional(),
      shipmentUsageTypeCode: z.enum(['P', 'X']).optional(),
      liveEntry: z.boolean().optional(),
      deferredTaxPaymentCode: z.enum(['1', '2']).optional(),
      tradeAgreementReconciliation: z.boolean().optional(),
      reconciliationIssueCode: z.string().max(3).optional(),
      postSummaryCorrection: z.boolean().optional(),
      acceleratedLiquidation: z.boolean().optional(),
      knownImporter: z.boolean().optional(),
      pgaDataIncluded: z.enum(['Y', 'F']).optional(),
      tibDeclaration: z.boolean().optional(),
      consolidatedExpressInformal: z.boolean().optional(),
    })
    .optional(),
  cargoReleaseCertification: z.boolean().optional(),
  lines: z.array(zLineV2).min(1),
  adCvdTotals: z
    .object({
      bondedAdCents: zMoneyCents.optional(),
      cashAdCents: zMoneyCents.optional(),
      bondedCvCents: zMoneyCents.optional(),
      cashCvCents: zMoneyCents.optional(),
    })
    .optional(),
  feeTotals: z.array(zFee).optional(),
  /** Optional in storage (duty engine fills it); mandatory at build time. */
  grandTotals: z
    .object({
      dutyCents: zMoneyCents,
      userFeeCents: zMoneyCents,
      irTaxCents: zMoneyCents,
      adDutyCents: zMoneyCents,
      cvDutyCents: zMoneyCents,
      otherRevenueCents: zMoneyCents.optional(),
    })
    .optional(),
});

// ── Commercial context (not expressible on AE records) ─────

export const zCommercialV2 = z.object({
  consignee: z
    .object({
      name: z.string().optional(),
      taxId: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  invoices: z
    .array(
      z.object({
        invoiceNumber: z.string().optional(),
        purchaseOrder: z.string().optional(),
        exportDate: zDate8.optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().optional(),
        relatedParties: z.enum(['Y', 'N']).optional(),
        itemSkus: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

// ── Document root ──────────────────────────────────────────

export const zAbiPayloadV2 = z.object({
  schemaVersion: z.literal(2),
  entrySummary: zEntrySummaryV2,
  commercial: zCommercialV2.optional(),
});

export type AbiPayloadV2 = z.infer<typeof zAbiPayloadV2>;
export type EntrySummaryV2 = z.infer<typeof zEntrySummaryV2>;
export type LineV2 = z.infer<typeof zLineV2>;
export type TariffV2 = z.infer<typeof zTariffV2>;

/** Parse/validate an unknown stored payload as v2 (throws ZodError). */
export function parseAbiPayloadV2(payload: unknown): AbiPayloadV2 {
  return zAbiPayloadV2.parse(payload);
}

/** True when a stored JSONB payload claims schema v2. */
export function isAbiPayloadV2(payload: unknown): payload is { schemaVersion: 2 } {
  return typeof payload === 'object' && payload !== null && (payload as { schemaVersion?: unknown }).schemaVersion === 2;
}
