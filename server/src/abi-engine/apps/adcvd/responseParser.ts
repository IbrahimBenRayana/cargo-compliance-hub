/**
 * AD/CVD Case Information Query response (AC) parser — "AD/CVD Case
 * Information Query" chapter, July 9, 2026, ADQ-15..30.
 *
 * Within a response block, each matched case comes back as an RA..RJ
 * grouping (ADQ-15 output structure map); failed queries come back as RX
 * records. Every detail record repeats the 10-digit case number, so the
 * parser keys cases by case number rather than relying purely on record
 * order.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import {
  OUTPUT_RA,
  OUTPUT_RB,
  OUTPUT_RC,
  OUTPUT_RD,
  OUTPUT_RE,
  OUTPUT_RF,
  OUTPUT_RG,
  OUTPUT_RH,
  OUTPUT_RI,
  OUTPUT_RJ,
  OUTPUT_RX,
} from './recordDefs.js';

// ── Result types ───────────────────────────────────────────

export interface AdCvdNamedParty {
  /** MID; conditional on the wire (RC/RD 14-28). */
  identificationCode?: string;
  /** Full name, reassembled from sequence-1/2 continuation records. */
  name: string;
}

export interface AdCvdContact {
  office: string;
  name: string;
  telephone1: string;
  telephone1Extension?: string;
  telephone2: string;
  telephone2Extension?: string;
}

export interface AdCvdDepositRate {
  /** MMDDYY the rate took effect. */
  effectiveDate: string;
  /** Ad valorem percentage, 2 implied decimals (10.17% → 1017; ADQ-23 Note 1). */
  adValoremRateHundredths?: number;
  /** Specific rate in cents per unit ($110.25 → 11025; ADQ-23 Note 2). */
  specificRateCents?: number;
  /** UOM the specific rate applies to (Table 1, ADQ-31). */
  unitOfMeasure?: string;
  /** Free-text UOM description when unitOfMeasure is OTH. */
  otherUnitOfMeasure?: string;
  addedDate: string;
  inactivatedDate?: string;
}

export interface AdCvdCaseEvent {
  effectiveDate: string;
  event: string;
  determination?: string;
  federalRegisterCitation?: string;
  addedDate: string;
  inactivatedDate?: string;
}

export interface AdCvdBondCashDetail {
  effectiveDate: string;
  /** BOND OR CA | CASH ONLY | N/A (ADQ-25). */
  indicator: string;
  addedDate: string;
  inactivatedDate?: string;
}

export interface AdCvdTariffDetail {
  /** 10-digit HTS or 7-digit TSUSA number. */
  tariffNumber: string;
  addedDate?: string;
  inactivatedDate?: string;
}

export interface AdCvdSuspensionDetail {
  effectiveDate: string;
  /** START | STOP (ADQ-28). */
  action: string;
  addedDate: string;
  inactivatedDate?: string;
}

export interface AdCvdCaseResult {
  /** 10-digit DOC case number (RA 3-12). */
  caseNumber: string;
  /** Related AD↔CVD case, 7 or 10 digits. */
  relatedCaseNumber?: string;
  shortDescription?: string;
  countryCode?: string;
  /** AC active; IC/ID/IF/IL/IO/IS/IT/IX inactive variants (ADQ-16..17). */
  companyCaseStatus?: string;
  companyCaseStatusEffectiveDate?: string;
  /** Reassembled from up to five RB records (≤320 chars, ADQ-18). */
  officialCaseName?: string;
  manufacturers: AdCvdNamedParty[];
  foreignExporters: AdCvdNamedParty[];
  contacts: AdCvdContact[];
  /** Most-current-first per the chapter (ADQ-22). */
  depositRates: AdCvdDepositRate[];
  events: AdCvdCaseEvent[];
  bondCashDetails: AdCvdBondCashDetail[];
  tariffs: AdCvdTariffDetail[];
  suspensions: AdCvdSuspensionDetail[];
}

export interface AdCvdFailedQuery {
  /** Q1C | Q1E | Q2C (ADQ-30 Note 1). */
  referenceType: string;
  /** Relative position of the failing request/case within the filing. */
  occurrence: number;
  /** On Q1E: the AD/CVD case number that failed. */
  referenceText?: string;
  conditionCode: string;
  narrative: string;
}

export interface AdCvdQueryResponse {
  cases: AdCvdCaseResult[];
  failures: AdCvdFailedQuery[];
}

// ── Parser ─────────────────────────────────────────────────

function optNum(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/**
 * Parse the RA..RJ/RX lines of an AC response (the transaction lines of a
 * response block) into per-case results and failed-query conditions.
 */
export function parseAdCvdResponse(lines: string[]): AdCvdQueryResponse {
  const cases: AdCvdCaseResult[] = [];
  const byCaseNumber = new Map<string, AdCvdCaseResult>();
  const failures: AdCvdFailedQuery[] = [];

  const caseFor = (caseNumber: string): AdCvdCaseResult => {
    let result = byCaseNumber.get(caseNumber);
    if (!result) {
      result = {
        caseNumber,
        manufacturers: [],
        foreignExporters: [],
        contacts: [],
        depositRates: [],
        events: [],
        bondCashDetails: [],
        tariffs: [],
        suspensions: [],
      };
      byCaseNumber.set(caseNumber, result);
      cases.push(result);
    }
    return result;
  };

  /** Append a name chunk: sequence 1 starts a name, 2 continues it (ADQ-19/20). */
  const addNameChunk = (
    parties: AdCvdNamedParty[],
    sequence: string | undefined,
    identificationCode: string | undefined,
    chunkText: string | undefined
  ): void => {
    const text = chunkText ?? '';
    const last = parties[parties.length - 1];
    if (sequence === '2' && last) {
      last.name += text;
    } else {
      parties.push({ identificationCode, name: text });
    }
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    switch (id) {
      case 'RA': {
        const { values } = parseRecord(OUTPUT_RA, line);
        const result = caseFor(values.caseNumber ?? '');
        result.relatedCaseNumber = values.relatedCaseNumber;
        result.shortDescription = values.shortDescription;
        result.countryCode = values.countryCode;
        result.companyCaseStatus = values.companyCaseStatus;
        result.companyCaseStatusEffectiveDate = values.companyCaseStatusEffectiveDate;
        break;
      }
      case 'RB': {
        const { values } = parseRecord(OUTPUT_RB, line);
        const result = caseFor(values.caseNumber ?? '');
        // RB segments arrive in Record Sequence order 1..5 (ADQ-18); each
        // carries up to 65 chars of the official name.
        result.officialCaseName = (result.officialCaseName ?? '') + (values.officialCaseName ?? '');
        break;
      }
      case 'RC': {
        const { values } = parseRecord(OUTPUT_RC, line);
        addNameChunk(
          caseFor(values.caseNumber ?? '').manufacturers,
          values.recordSequence,
          values.manufacturerIdentificationCode,
          values.manufacturerName
        );
        break;
      }
      case 'RD': {
        const { values } = parseRecord(OUTPUT_RD, line);
        addNameChunk(
          caseFor(values.caseNumber ?? '').foreignExporters,
          values.recordSequence,
          values.foreignExporterIdentificationCode,
          values.foreignExporterName
        );
        break;
      }
      case 'RE': {
        const { values } = parseRecord(OUTPUT_RE, line);
        caseFor(values.caseNumber ?? '').contacts.push({
          office: values.contactOffice ?? '',
          name: values.contactName ?? '',
          telephone1: values.contactTelephoneNumber1 ?? '',
          telephone1Extension: values.contactTelephoneNumber1Extension,
          telephone2: values.contactTelephoneNumber2 ?? '',
          telephone2Extension: values.contactTelephoneNumber2Extension,
        });
        break;
      }
      case 'RF': {
        const { values } = parseRecord(OUTPUT_RF, line);
        caseFor(values.caseNumber ?? '').depositRates.push({
          effectiveDate: values.depositRateEffectiveDate ?? '',
          adValoremRateHundredths: optNum(values.adValoremDepositRate),
          specificRateCents: optNum(values.specificDepositRate),
          unitOfMeasure: values.unitOfMeasure,
          otherUnitOfMeasure: values.otherUnitOfMeasure,
          addedDate: values.rateAddedDate ?? '',
          inactivatedDate: values.rateInactivatedDate,
        });
        break;
      }
      case 'RG': {
        const { values } = parseRecord(OUTPUT_RG, line);
        caseFor(values.caseNumber ?? '').events.push({
          effectiveDate: values.eventEffectiveDate ?? '',
          event: values.event ?? '',
          determination: values.determination,
          federalRegisterCitation: values.federalRegisterCitation,
          addedDate: values.eventAddedDate ?? '',
          inactivatedDate: values.eventInactivatedDate,
        });
        break;
      }
      case 'RH': {
        const { values } = parseRecord(OUTPUT_RH, line);
        caseFor(values.caseNumber ?? '').bondCashDetails.push({
          effectiveDate: values.bondCashEffectiveDate ?? '',
          indicator: values.bondCashIndicator ?? '',
          addedDate: values.bondCashIndicatorAddedDate ?? '',
          inactivatedDate: values.bondCashIndicatorInactivatedDate,
        });
        break;
      }
      case 'RI': {
        const { values } = parseRecord(OUTPUT_RI, line);
        const result = caseFor(values.caseNumber ?? '');
        for (const n of [1, 2, 3] as const) {
          const tariffNumber = values[`tariffNumber${n}`];
          if (tariffNumber === undefined) continue;
          result.tariffs.push({
            tariffNumber,
            addedDate: values[`addedDate${n}`],
            inactivatedDate: values[`inactivatedDate${n}`],
          });
        }
        break;
      }
      case 'RJ': {
        const { values } = parseRecord(OUTPUT_RJ, line);
        caseFor(values.caseNumber ?? '').suspensions.push({
          effectiveDate: values.suspensionActionEffectiveDate ?? '',
          action: values.suspensionAction ?? '',
          addedDate: values.suspensionActionAddedDate ?? '',
          inactivatedDate: values.suspensionActionInactivatedDate,
        });
        break;
      }
      case 'RX': {
        const { values } = parseRecord(OUTPUT_RX, line);
        failures.push({
          referenceType: values.referenceDataTypeCode ?? '',
          occurrence: Number(values.occurrencePosition ?? '0'),
          referenceText: values.referenceDataText,
          conditionCode: values.conditionCode ?? '',
          narrative: values.narrativeText ?? '',
        });
        break;
      }
      default:
        // Non-AD/CVD lines (envelope records already stripped) are ignored.
        break;
    }
  }

  return { cases, failures };
}

export interface AdCvdResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  response: AdCvdQueryResponse;
}

/** Parse a complete AC wire response (A/B…Y/Z envelope included). */
export function parseAdCvdResponseBatch(lines: string[]): AdCvdResponseBatch {
  const batch = parseBatch(lines);
  const transactionLines = batch.blocks.flatMap((b) => b.transactionLines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    response: parseAdCvdResponse(transactionLines),
  };
}
