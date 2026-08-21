/**
 * HTS Query response (HY) parser — "Harmonized Tariff Schedule (HTS)"
 * chapter, March 2023, HTS-8 and HTS-47..79.
 *
 * Within a response block, each W request yields conditional detail records
 * (W1..W9, WA..WL) followed by the mandatory W0 record that echoes the
 * query and carries the narrative message (HTS-47): either the number of
 * tariff numbers in the range, RANGE EXCEEDS 100, or a system-generated
 * error message when a mandatory input element was in error or the number
 * is not on file. The W0 record therefore CLOSES a query result grouping;
 * every detail record carries its tariff number, which groups multi-record
 * data (a range query interleaves several tariff numbers per grouping).
 *
 * All 12-digit rate fields carry 8 implied decimals; the 10-digit
 * value/quantity bounds carry 5 (HTS-49..54). Narrative and condition text
 * is surfaced verbatim.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import {
  OUTPUT_W0,
  OUTPUT_W1,
  OUTPUT_W2,
  OUTPUT_W3,
  OUTPUT_W4,
  OUTPUT_WD,
  OUTPUT_WL,
  OUTPUT_SPECIAL_RATE_TAX_FEE,
  OUTPUT_SPECIAL_RATE_ONLY,
} from './recordDefs.js';

// ── Result types ───────────────────────────────────────────

/** One special-rate/tax-fee grouping from a W5..WC or WE..WK record. */
export interface HtsSpecialRate {
  /** Source record identifier (W5..W9, WA..WC, WE..WK), in arrival order. */
  recordId: string;
  /** ISO country code; also E/J/R + space program codes (HTS-55). */
  isoCountryCode?: string;
  /** Special-column specific rate of duty (8 implied decimals applied). */
  specificRate?: number;
  /** Special-column ad valorem rate of duty (8 implied decimals applied). */
  adValoremRate?: number;
  /** Special-column rate that is neither specific nor ad valorem. */
  otherRate?: number;
  /** Tax/fee class code, Appendix B (W5..WC only). */
  taxFeeClassCode?: string;
  /** Tax/fee computation formula code, Appendix F (W5..WC only). */
  taxFeeComputationCode?: string;
  /** 1 = tax/fee required, 2 = tax/fee may be required (W5..WC only). */
  taxFeeFlag?: string;
  /** Specific rate used to compute taxes/fees (8 implied decimals). */
  taxFeeSpecificRate?: number;
  /** Ad valorem rate used to compute taxes/fees (8 implied decimals). */
  taxFeeAdValoremRate?: number;
}

/** W4 value edit (V4 Note 1 codes; bounds have 5 implied decimals). */
export interface HtsValueEdit {
  code: string;
  lowBounds?: number;
  highBounds?: number;
}

/** W4 entry date restriction (V4 Note 2 codes; dates are MMDD). */
export interface HtsDateRestriction {
  code: string;
  beginDate?: string;
  endDate?: string;
}

/** W4 quantity edit (V4 Note 3 codes; bounds have 5 implied decimals). */
export interface HtsQuantityEdit {
  code: string;
  lowBounds?: number;
  highBounds?: number;
}

/** Everything ACE returned for one tariff number (W1..WL records). */
export interface HtsTariffResult {
  tariffNumber: string;
  /** MMDDYY record begin effective date — when the number becomes valid. */
  beginEffectiveDate?: string;
  /** MMDDYY record end effective date — last date the number is valid. */
  endEffectiveDate?: string;
  /** Census reporting unit count (0-3). */
  numberOfReportingUnits?: number;
  /** Units of measure 1-3 in order (Appendix C codes; X = none required). */
  unitsOfMeasure: string[];
  /** Duty computation formula code, Appendix F; X = complex rate (HTS-9). */
  dutyComputationCode?: string;
  commodityDescription?: string;
  /** General-column specific rate (8 implied decimals applied). */
  column1SpecificRate?: number;
  /** B when the column 1 rate is a base rate. */
  baseRateIndicator?: string;
  column1AdValoremRate?: number;
  column1OtherRate?: number;
  column2SpecificRate?: number;
  column2AdValoremRate?: number;
  column2OtherRate?: number;
  /** 1 = subject to countervailing duty. */
  countervailingDutyFlag?: string;
  /** R = an additional tariff number may be required. */
  additionalTariffNumberIndicator?: string;
  /** Miscellaneous permit/license code (V2 Note 1, HTS-13). */
  miscPermitLicenseIndicator?: string;
  /** ISO codes of countries excluded from GSP preference. */
  gspExcludedCountries: string[];
  /** 1 = subject to antidumping duty. */
  antidumpingDutyFlag?: string;
  /** 1 = subject to quota. */
  quotaIndicator?: string;
  /** Textile category number. */
  categoryNumber?: string;
  /** SPI codes from W3 plus any WD continuation (V3 Note 2 codes). */
  spiCodes: string[];
  valueEdit?: HtsValueEdit;
  dateRestrictions: HtsDateRestriction[];
  /** ISO code, or 01 (column 1 eligible) / 02 (column 2, GN 3(a)(iv)(b)). */
  isoCountryOfOriginEditCode?: string;
  quantityEdit?: HtsQuantityEdit;
  /** Special rates / taxes / fees from W5..WC and WE..WK, in order. */
  specialRates: HtsSpecialRate[];
  /** PGA indicator codes from WL (EP2/EP3/EP4/FS3/FS4…, HTS-79). */
  pgaCodes: string[];
}

/** One query result grouping, closed by its W0 record (HTS-47). */
export interface HtsQueryResult {
  /** Queried (from) tariff number, echoed by ACE. */
  fromTariffNumber: string;
  /** MMDDYY as-of date echo; absent when the current date was assumed. */
  asOfDate?: string;
  /** Range end echo; absent for single-number queries. */
  toTariffNumber?: string;
  /**
   * Verbatim W0 narrative: the number of tariff numbers in the range on
   * success, RANGE EXCEEDS 100, or the system-generated error message.
   * When tariffs is empty this text is the error/no-match condition.
   */
  narrativeMessage: string;
  /** Tariff data preceding this W0, one entry per tariff number. */
  tariffs: HtsTariffResult[];
}

export interface HtsQueryResponse {
  queries: HtsQueryResult[];
}

// ── Helpers ────────────────────────────────────────────────

const SPECIAL_RATE_TAX_FEE = new Set(Object.keys(OUTPUT_SPECIAL_RATE_TAX_FEE));
const SPECIAL_RATE_ONLY = new Set(Object.keys(OUTPUT_SPECIAL_RATE_ONLY));

/** Apply the chapter's implied decimal places to a numeric field. */
function implied(value: string | undefined, places: number): number | undefined {
  return value === undefined ? undefined : Number(value) / 10 ** places;
}

/** Split a left-justified run of fixed-width codes into individual codes. */
function chunkCodes(raw: string | undefined, size: number): string[] {
  if (!raw) return [];
  const codes: string[] = [];
  for (let i = 0; i < raw.length; i += size) {
    const code = raw.slice(i, i + size).trim();
    if (code !== '') codes.push(code);
  }
  return codes;
}

function emptyTariff(tariffNumber: string): HtsTariffResult {
  return {
    tariffNumber,
    unitsOfMeasure: [],
    gspExcludedCountries: [],
    spiCodes: [],
    dateRestrictions: [],
    specialRates: [],
    pgaCodes: [],
  };
}

// ── Parser ─────────────────────────────────────────────────

/**
 * Parse the W0..WL lines of an HY response (the transaction lines of a
 * response block) into per-query results. Detail records are grouped by
 * their tariff number; each W0 closes the current query grouping.
 */
export function parseHtsQueryResponse(lines: string[]): HtsQueryResponse {
  const queries: HtsQueryResult[] = [];
  let pending: HtsTariffResult[] = [];
  let byTariff = new Map<string, HtsTariffResult>();

  const tariffFor = (tariffNumber: string): HtsTariffResult => {
    let tariff = byTariff.get(tariffNumber);
    if (!tariff) {
      tariff = emptyTariff(tariffNumber);
      byTariff.set(tariffNumber, tariff);
      pending.push(tariff);
    }
    return tariff;
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    switch (id) {
      case 'W0': {
        const { values } = parseRecord(OUTPUT_W0, line);
        queries.push({
          fromTariffNumber: values.fromTariffNumber ?? '',
          asOfDate: values.asOfDate,
          toTariffNumber: values.toTariffNumber,
          narrativeMessage: values.narrativeMessage ?? '',
          tariffs: pending,
        });
        pending = [];
        byTariff = new Map();
        break;
      }
      case 'W1': {
        const { values } = parseRecord(OUTPUT_W1, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        tariff.beginEffectiveDate = values.recordBeginEffectiveDate;
        tariff.endEffectiveDate = values.recordEndEffectiveDate;
        tariff.numberOfReportingUnits =
          values.numberOfReportingUnits === undefined ? undefined : Number(values.numberOfReportingUnits);
        tariff.unitsOfMeasure = [values.unit1, values.unit2, values.unit3].filter(
          (unit): unit is string => unit !== undefined
        );
        tariff.dutyComputationCode = values.dutyComputationCode;
        tariff.commodityDescription = values.commodityDescription;
        tariff.column1SpecificRate = implied(values.column1SpecificRate, 8);
        tariff.baseRateIndicator = values.baseRateIndicator;
        break;
      }
      case 'W2': {
        const { values } = parseRecord(OUTPUT_W2, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        tariff.column1AdValoremRate = implied(values.column1RateAdValorem, 8);
        tariff.column1OtherRate = implied(values.column1RateOther, 8);
        tariff.column2SpecificRate = implied(values.column2RateSpecific, 8);
        tariff.column2AdValoremRate = implied(values.column2RateAdValorem, 8);
        tariff.column2OtherRate = implied(values.column2RateOther, 8);
        tariff.countervailingDutyFlag = values.countervailingDutyFlag;
        tariff.additionalTariffNumberIndicator = values.additionalTariffNumberIndicator;
        tariff.miscPermitLicenseIndicator = values.miscPermitLicenseIndicator;
        break;
      }
      case 'W3': {
        const { values } = parseRecord(OUTPUT_W3, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        tariff.gspExcludedCountries = chunkCodes(values.gspExcludedCountries, 2);
        tariff.antidumpingDutyFlag = values.antidumpingDutyFlag;
        tariff.quotaIndicator = values.quotaIndicator;
        tariff.categoryNumber = values.categoryNumber;
        tariff.spiCodes = [...chunkCodes(values.spiCodes, 2), ...tariff.spiCodes];
        break;
      }
      case 'W4': {
        const { values } = parseRecord(OUTPUT_W4, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        if (values.valueEditCode !== undefined) {
          tariff.valueEdit = {
            code: values.valueEditCode,
            lowBounds: implied(values.valueLowBounds, 5),
            highBounds: implied(values.valueHighBounds, 5),
          };
        }
        if (values.entryDateRestrictionCode1 !== undefined || values.beginRestrictionDate1 !== undefined) {
          tariff.dateRestrictions.push({
            code: values.entryDateRestrictionCode1 ?? '',
            beginDate: values.beginRestrictionDate1,
            endDate: values.endRestrictionDate1,
          });
        }
        if (values.entryDateRestrictionCode2 !== undefined || values.beginRestrictionDate2 !== undefined) {
          tariff.dateRestrictions.push({
            code: values.entryDateRestrictionCode2 ?? '',
            beginDate: values.beginRestrictionDate2,
            endDate: values.endRestrictionDate2,
          });
        }
        tariff.isoCountryOfOriginEditCode = values.isoCountryOfOriginEditCode;
        if (values.quantityEditCode !== undefined) {
          tariff.quantityEdit = {
            code: values.quantityEditCode,
            lowBounds: implied(values.quantityEditLowBounds, 5),
            highBounds: implied(values.quantityEditHighBounds, 5),
          };
        }
        break;
      }
      case 'WD': {
        const { values } = parseRecord(OUTPUT_WD, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        tariff.spiCodes.push(...chunkCodes(values.spiCodes, 2));
        break;
      }
      case 'WL': {
        const { values } = parseRecord(OUTPUT_WL, line);
        const tariff = tariffFor(values.tariffNumber ?? '');
        tariff.pgaCodes = chunkCodes(values.pgaCodes, 3);
        break;
      }
      default: {
        if (SPECIAL_RATE_TAX_FEE.has(id) || SPECIAL_RATE_ONLY.has(id)) {
          const def = SPECIAL_RATE_TAX_FEE.has(id)
            ? OUTPUT_SPECIAL_RATE_TAX_FEE[id]
            : OUTPUT_SPECIAL_RATE_ONLY[id];
          const { values } = parseRecord(def, line);
          const tariff = tariffFor(values.tariffNumber ?? '');
          tariff.specialRates.push({
            recordId: id,
            isoCountryCode: values.isoCountryCode,
            specificRate: implied(values.specificSpecialRate, 8),
            adValoremRate: implied(values.adValoremSpecialRate, 8),
            otherRate: implied(values.otherSpecialRate, 8),
            taxFeeClassCode: values.taxFeeClassCode,
            taxFeeComputationCode: values.taxFeeComputationCode,
            taxFeeFlag: values.taxFeeFlag,
            taxFeeSpecificRate: implied(values.taxFeeSpecificRate, 8),
            taxFeeAdValoremRate: implied(values.taxFeeAdValoremRate, 8),
          });
        }
        // Non-HTS lines (application-specific extras) are ignored.
        break;
      }
    }
  }

  return { queries };
}

export interface HtsQueryResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  response: HtsQueryResponse;
}

/** Parse a complete HY wire response (A/B…Y/Z envelope included). */
export function parseHtsQueryResponseBatch(lines: string[]): HtsQueryResponseBatch {
  const batch = parseBatch(lines);
  const transactionLines = batch.blocks.flatMap((b) => b.transactionLines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    response: parseHtsQueryResponse(transactionLines),
  };
}
