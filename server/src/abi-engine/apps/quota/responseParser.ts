/**
 * Quota Query response (QB) parser — "Quota Query" chapter, April 30, 2015,
 * QA-9 and QA-12..19.
 *
 * Within a response block, each Q1 request yields either one or more
 * Q2/Q3/Q4 results groupings or exactly one Q5 error record — never both
 * per Q1 (QA-9). A Q2 record opens a result; the following Q3 and Q4 fill
 * in the remainder of that grouping.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import { OUTPUT_Q2, OUTPUT_Q3, OUTPUT_Q4, OUTPUT_Q5 } from './recordDefs.js';

// ── Result types ───────────────────────────────────────────

export interface QuotaStatusResult {
  /** R = tariff number, X = textile category number. */
  typeCode: string;
  /** The queried HTS number or textile category, as echoed by ACE. */
  queryId: string;
  /** 9-char CBP quota/category identifier (QA-14 Note 1). */
  quotaId: string;
  /** ISO country code; 99 = all countries / aggregate record. */
  countryOfOrigin: string;
  /** Absent when the queried record has no quota limit (QA-13). */
  quotaLimit?: number;
  unitOfMeasureCode: string;
  /** Textile conversion factor in thousandths (NNN.NNN, 3 implied decimals). */
  textileConversionFactorThousandths?: number;
  /** MMDDYY quota period bounds. */
  beginningPeriodDate: string;
  endingPeriodDate: string;
  /** YY + period-within-year, e.g. 1501 (QA-13). */
  quotaPeriod: string;
  /** Quota level at which automated release stops ("going on hold"). */
  thresholdQuantity: number;
  /** 99 when the tariff number is reported by more than one country. */
  globalIndicator?: string;
  /** PD/ED + OPEN|POTF|FILL|EXPD|BAND|HOLD|EXCL (QA-15). */
  periodProcessingIndicator?: string;
  description?: string;
  /** TRQ | TPL | ABS | STA. */
  quotaType?: string;
  /** Total charged against the quota to date. */
  quantityToDate?: number;
  /** Ordinal of the result record within the response (0001, 0002, …). */
  recordNumber?: number;
  secondTariffNumber?: string;
  /** MMDDYY; absent when there have been no quota transactions (QA-17). */
  lastQuotaTransactionDate?: string;
  /** MMDDYY the query was processed. */
  dateOfStatus?: string;
  /** HHMM military time the query was processed. */
  timeOfStatus?: string;
}

export interface QuotaQueryError {
  typeCode: string;
  queryId: string;
  countryOfOrigin: string;
  /** Q05..Q50 (QUOTA_CONDITION_CODES, QA-19). */
  conditionCode: string;
  narrative: string;
}

export interface QuotaQueryResponse {
  results: QuotaStatusResult[];
  errors: QuotaQueryError[];
}

// ── Parser ─────────────────────────────────────────────────

function optNum(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/**
 * Parse the Q2/Q3/Q4/Q5 lines of a QB response (the transaction lines of a
 * response block) into quota results and per-request errors.
 */
export function parseQuotaResponse(lines: string[]): QuotaQueryResponse {
  const results: QuotaStatusResult[] = [];
  const errors: QuotaQueryError[] = [];
  let current: QuotaStatusResult | null = null;

  for (const line of lines) {
    const id = line.slice(0, 2);
    switch (id) {
      case 'Q2': {
        const { values } = parseRecord(OUTPUT_Q2, line);
        current = {
          typeCode: values.quotaQueryIdTypeCode ?? '',
          queryId: values.quotaQueryId ?? '',
          quotaId: values.quotaId ?? '',
          countryOfOrigin: values.countryOfOrigin ?? '',
          quotaLimit: optNum(values.quotaLimit),
          unitOfMeasureCode: values.unitOfMeasureCode ?? '',
          textileConversionFactorThousandths: optNum(values.textileConversionFactor),
          beginningPeriodDate: values.beginningPeriodDate ?? '',
          endingPeriodDate: values.endingPeriodDate ?? '',
          quotaPeriod: values.quotaPeriod ?? '',
          thresholdQuantity: Number(values.thresholdQuantity ?? '0'),
        };
        results.push(current);
        break;
      }
      case 'Q3': {
        if (!current) break; // stray Q3 without its Q2 signpost
        const { values } = parseRecord(OUTPUT_Q3, line);
        current.globalIndicator = values.globalIndicator;
        current.periodProcessingIndicator = values.periodProcessingIndicator;
        current.description = values.description;
        current.quotaType = values.quotaType;
        current.quantityToDate = optNum(values.quantityToDate);
        current.recordNumber = optNum(values.recordNumber);
        current.secondTariffNumber = values.secondTariffNumber;
        break;
      }
      case 'Q4': {
        if (!current) break;
        const { values } = parseRecord(OUTPUT_Q4, line);
        current.lastQuotaTransactionDate = values.lastQuotaTransactionDate;
        current.dateOfStatus = values.dateOfStatus;
        current.timeOfStatus = values.timeOfStatus;
        current = null; // Q4 closes the results grouping (QA-9)
        break;
      }
      case 'Q5': {
        const { values } = parseRecord(OUTPUT_Q5, line);
        errors.push({
          typeCode: values.quotaQueryIdTypeCode ?? '',
          queryId: values.quotaQueryId ?? '',
          countryOfOrigin: values.countryOfOrigin ?? '',
          conditionCode: values.conditionCode ?? '',
          narrative: values.narrativeText ?? '',
        });
        current = null;
        break;
      }
      default:
        // Non-quota lines (application-specific extras) are ignored.
        break;
    }
  }

  return { results, errors };
}

export interface QuotaResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  response: QuotaQueryResponse;
}

/** Parse a complete QB wire response (A/B…Y/Z envelope included). */
export function parseQuotaResponseBatch(lines: string[]): QuotaResponseBatch {
  const batch = parseBatch(lines);
  const transactionLines = batch.blocks.flatMap((b) => b.transactionLines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    response: parseQuotaResponse(transactionLines),
  };
}
