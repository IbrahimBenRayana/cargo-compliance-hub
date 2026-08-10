/**
 * Entry Summary Query response (ER) parser — "Entry Summary Query" chapter,
 * V26 May 2026, ESQ-23..53.
 *
 * Within a response block, an optional JA-record echoes the J2 criteria,
 * then each entry summary comes back as a grouping opened by a JB-record
 * followed by JC..JN status records, an optional 10-90 detail grouping
 * (raw AE records plus 4A CBP line numbers), and JZ condition records for
 * query-level problems (ESQ-23 structure map).
 *
 * Amounts named *Cents carry the wire's two implied decimals; whole-dollar
 * fields are named *Dollars (JI Surety Liability Amount only). Negative
 * amounts arrive as a '-' in the position adjacent to the value (JD Note 3
 * etc.) and parse to negative numbers here.
 *
 * "Data not on file" sentinel lines (JI Note 1, JK Note 1, JL Note 1, JN
 * Note 1) are free-text messages sharing the record ids; they are detected
 * by their fixed narrative text and surfaced as flags instead of being
 * force-fit into the record layouts.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import {
  OUTPUT_JA,
  OUTPUT_JB,
  OUTPUT_JC,
  OUTPUT_JD,
  OUTPUT_JE,
  OUTPUT_JF,
  OUTPUT_JG,
  OUTPUT_JH,
  OUTPUT_JI,
  OUTPUT_JJ,
  OUTPUT_JK,
  OUTPUT_JL,
  OUTPUT_JM,
  OUTPUT_JN,
  OUTPUT_JZ,
  ES_QUERY_CONDITION_CODES,
} from './recordDefs.js';

// ── Typed reply ────────────────────────────────────────────

export interface EsQueryCriteriaEcho {
  type: string;
  fromDateTime: string;
  toDateTime: string;
}

export interface EsQueryStatus {
  /** JC 3: 1 trade control, 2 CBP control, 3 inactive. */
  controlStatusCode?: string;
  /** JC 4: 1 accepted, 2 rejected, 3 canceled. */
  statusCode?: string;
  statusDate?: string;
  /** JC 11: 0 not late, 1 late. */
  lateFilingStatusCode?: string;
  releaseStatusCode?: string;
  releaseDate?: string;
  collectionStatusCode?: string;
  collectionDate?: string;
  extensionSuspensionDate?: string;
  extensionSuspensionNoticeDate?: string;
  censusHeaderStatusCode?: string;
  invoiceStatusCode?: string;
  /** YS | NO. */
  protestStatusCode?: string;
  quotaStatusCode?: string;
  tradeAgreementReconciliation?: { filerCode?: string; entryNumber?: string };
  otherReconciliation?: { filerCode?: string; entryNumber?: string };
  extensionSuspensionStatusCodes: string[];
}

export interface EsQueryLiquidation {
  /** JD 3: 1 under CBP review, 2 not under review. */
  cbpReviewIndicator?: string;
  entryDate?: string;
  liquidatedDutyCents?: number;
  liquidatedTaxCents?: number;
  liquidatedFeesCents?: number;
  liquidatedInterestCents?: number;
  liquidatedAdCvdCents?: number;
  liquidationReasonCodes: string[];
  /** Y | N. */
  immediateDeliveryIndicator?: string;
}

export interface EsQueryEstimates {
  estimatedDutyCents?: number;
  estimatedTaxCents?: number;
  estimatedFeesCents?: number;
  estimatedInterestCents?: number;
  estimatedAdCvdCents?: number;
}

export interface EsQueryBond {
  suretyCode?: string;
  primarySurety?: boolean;
  bondTypeCode?: string;
  bondDesignationTypeCode?: string;
  multipleBonds?: boolean;
  bondNumber?: string;
  singleEntryBondAmountCents?: number;
  suretyLiabilityAmountDollars?: number;
}

export interface EsQueryProtest {
  protestNumber?: string;
  protestType?: string;
  protestStatus?: string;
  protestDecisionDate?: string;
  summons?: boolean;
}

export interface EsQueryBill {
  /** JN only: surety identity for surety-specific bills. */
  suretyCode?: string;
  primarySurety?: boolean;
  /** JN only: CBP Report 612 formal-demand date. */
  report612Date?: string;
  billNumber?: string;
  billDate?: string;
  billType?: string;
  billCollectionStatus?: string;
  totalBillAmountCents?: number;
  paidAmountCents?: number;
  principalAmountCents?: number;
  interestAmountCents?: number;
}

export interface EsQueryCollection {
  collectionDate?: string;
  totalAmountCents?: number;
}

export interface EsQueryClassAmount {
  classCode?: string;
  amountCents?: number;
}

export interface EsQuerySummary {
  entryFilerCode?: string;
  entryNumber?: string;
  /** 5-char version: 3-digit major + 2-digit minor (JB Note 3). */
  versionNumber?: string;
  acceptDateTime?: string;
  postSummaryCorrection: boolean;
  pscAcceptDate?: string;
  /** Requester is a current owner of the summary (semi-private vs full). */
  ownershipDataReturned: boolean;
  /** JB 43: 1 liquidated/closed, 2 not liquidated, 3 re-liquidated. */
  liquidationStatusCode?: string;
  liquidationDate?: string;
  centerId?: string;
  status?: EsQueryStatus;
  liquidation?: EsQueryLiquidation;
  estimates?: EsQueryEstimates;
  importerOfRecordNumber?: string;
  entryType?: string;
  rejectDate?: string;
  acceleratedDrawbackIndicator?: string;
  electronicInvoiceIndicator?: string;
  districtPortOfEntry?: string;
  entrySummaryFilingDate?: string;
  warehouse?: { numberOfWithdrawals?: number; finalWithdrawal?: boolean };
  /** JG: import specialist team number. */
  importSpecialistTeam?: string;
  numberOfLineItems?: number;
  cbpForm4811ReferenceNumber?: string;
  preliminaryStatementPrintDate?: string;
  brokerReferenceNumber?: string;
  bonds: EsQueryBond[];
  protests: EsQueryProtest[];
  bills: EsQueryBill[];
  collections: EsQueryCollection[];
  classAmounts: EsQueryClassAmount[];
  suretyBills: EsQueryBill[];
  /** JI Note 1: 'NO BOND ON FILE IN ACE EBOND' sentinel seen. */
  noBondOnFile: boolean;
  /** JK/JN Note 1: 'BILLING DATA NOT ON FILE' sentinel seen. */
  billingDataNotOnFile: boolean;
  /** JL Note 1: 'COLLECTION DATA NOT ON FILE' sentinel seen. */
  collectionDataNotOnFile: boolean;
  /** Raw 10-90 detail grouping lines (incl. 4A), when J0 was requested. */
  detailLines: string[];
}

export interface EsQueryCondition {
  conditionCode: string;
  /** Narrative from the wire, falling back to the chapter's Note 1 table. */
  narrative: string;
  entryFilerCode?: string;
  entryNumber?: string;
  districtPortOfEntry?: string;
}

export interface EsQueryResponse {
  criteria?: EsQueryCriteriaEcho;
  summaries: EsQuerySummary[];
  conditions: EsQueryCondition[];
}

// ── Helpers ────────────────────────────────────────────────

/** Parse a numeric wire value; tolerates the adjacent '-' sign convention. */
function amount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw.replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function int(raw: string | undefined): number | undefined {
  return amount(raw);
}

function newSummary(): EsQuerySummary {
  return {
    postSummaryCorrection: false,
    ownershipDataReturned: false,
    bonds: [],
    protests: [],
    bills: [],
    collections: [],
    classAmounts: [],
    suretyBills: [],
    noBondOnFile: false,
    billingDataNotOnFile: false,
    collectionDataNotOnFile: false,
    detailLines: [],
  };
}

// ── Parser ─────────────────────────────────────────────────

/**
 * Parse the transaction lines of an ER response block into a typed reply.
 */
export function parseEsQueryResponse(lines: string[]): EsQueryResponse {
  const response: EsQueryResponse = { summaries: [], conditions: [] };
  let current: EsQuerySummary | null = null;

  const ensure = (): EsQuerySummary => {
    if (!current) {
      current = newSummary();
      response.summaries.push(current);
    }
    return current;
  };

  for (const rawLine of lines) {
    const line = rawLine.padEnd(80, ' ');
    const id = line.slice(0, 2);

    if (id === 'JA') {
      const v = parseRecord(OUTPUT_JA, line).values;
      response.criteria = {
        type: v.criteriaQueryTypeCode ?? '',
        fromDateTime: v.requestedFromDateTime ?? '',
        toDateTime: v.requestedToDateTime ?? '',
      };
    } else if (id === 'JB') {
      const v = parseRecord(OUTPUT_JB, line).values;
      current = newSummary();
      current.entryFilerCode = v.entryFilerCode;
      current.entryNumber = v.entryNumber;
      current.versionNumber = v.versionNumber;
      current.acceptDateTime = v.acceptDateTime;
      current.postSummaryCorrection = v.pscIndicator === 'Y';
      current.pscAcceptDate = v.pscAcceptDate;
      current.ownershipDataReturned = v.ownershipDataReturnedIndicator === 'Y';
      current.liquidationStatusCode = v.liquidationStatusCode;
      current.liquidationDate = v.liquidationDate;
      current.centerId = v.centerId;
      response.summaries.push(current);
    } else if (id === 'JC') {
      const v = parseRecord(OUTPUT_JC, line).values;
      const s = ensure();
      s.status = {
        controlStatusCode: v.entrySummaryControlStatus,
        statusCode: v.entrySummaryStatusCode,
        statusDate: v.entrySummaryStatusDate,
        lateFilingStatusCode: v.lateFilingStatusCode,
        releaseStatusCode: v.releaseStatusCode,
        releaseDate: v.releaseDate,
        collectionStatusCode: v.collectionStatusCode,
        collectionDate: v.collectionDate,
        extensionSuspensionDate: v.extensionSuspensionDate,
        extensionSuspensionNoticeDate: v.extensionSuspensionNoticeDate,
        censusHeaderStatusCode: v.censusHeaderStatusCode,
        invoiceStatusCode: v.invoiceStatusCode,
        protestStatusCode: v.protestStatusCode,
        quotaStatusCode: v.quotaStatusCode,
        tradeAgreementReconciliation: v.tradeAgreementReconciliationFilerCode
          ? {
              filerCode: v.tradeAgreementReconciliationFilerCode,
              entryNumber: v.tradeAgreementReconciliationEntryNumber,
            }
          : undefined,
        otherReconciliation: v.otherReconciliationFilerCode
          ? { filerCode: v.otherReconciliationFilerCode, entryNumber: v.otherReconciliationEntryNumber }
          : undefined,
        extensionSuspensionStatusCodes: [
          v.extensionSuspensionStatusCode1,
          v.extensionSuspensionStatusCode2,
          v.extensionSuspensionStatusCode3,
          v.extensionSuspensionStatusCode4,
        ].filter((c): c is string => c !== undefined),
      };
    } else if (id === 'JD') {
      const v = parseRecord(OUTPUT_JD, line).values;
      const s = ensure();
      s.liquidation = {
        cbpReviewIndicator: v.cbpReviewIndicator,
        entryDate: v.entryDate,
        liquidatedDutyCents: amount(v.liquidatedDuty),
        liquidatedTaxCents: amount(v.liquidatedTax),
        liquidatedFeesCents: amount(v.liquidatedFees),
        liquidatedInterestCents: amount(v.liquidatedInterest),
        liquidatedAdCvdCents: amount(v.liquidatedAdCvd),
        liquidationReasonCodes: [v.liquidationReasonCode1, v.liquidationReasonCode2, v.liquidationReasonCode3].filter(
          (c): c is string => c !== undefined
        ),
        immediateDeliveryIndicator: v.immediateDeliveryIndicator,
      };
    } else if (id === 'JE') {
      const v = parseRecord(OUTPUT_JE, line).values;
      const s = ensure();
      s.estimates = {
        estimatedDutyCents: amount(v.estimatedDuty),
        estimatedTaxCents: amount(v.estimatedTax),
        estimatedFeesCents: amount(v.estimatedFees),
        estimatedInterestCents: amount(v.estimatedInterest),
        estimatedAdCvdCents: amount(v.estimatedAdCvd),
      };
    } else if (id === 'JF') {
      const v = parseRecord(OUTPUT_JF, line).values;
      const s = ensure();
      s.importerOfRecordNumber = v.importerOfRecordNumber;
      s.entryType = v.entryType;
      s.rejectDate = v.rejectDate;
      s.acceleratedDrawbackIndicator = v.acceleratedDrawbackIndicator;
      s.electronicInvoiceIndicator = v.electronicInvoiceIndicator;
      s.districtPortOfEntry = v.districtPortOfEntry;
      s.entrySummaryFilingDate = v.entrySummaryFilingDate;
    } else if (id === 'JG') {
      const v = parseRecord(OUTPUT_JG, line).values;
      const s = ensure();
      if (v.numberOfWithdrawals !== undefined || v.warehouseFinalWithdrawalIndicator !== undefined) {
        s.warehouse = {
          numberOfWithdrawals: int(v.numberOfWithdrawals),
          finalWithdrawal: v.warehouseFinalWithdrawalIndicator === 'Y',
        };
      }
      s.importSpecialistTeam = v.importSpecialistTeam;
      if (v.centerId !== undefined) s.centerId = v.centerId;
      s.numberOfLineItems = int(v.numberOfLineItems);
    } else if (id === 'JH') {
      const v = parseRecord(OUTPUT_JH, line).values;
      const s = ensure();
      s.cbpForm4811ReferenceNumber = v.cbpForm4811ReferenceNumber;
      s.preliminaryStatementPrintDate = v.preliminaryStatementPrintDate;
      s.brokerReferenceNumber = v.brokerReferenceNumber;
    } else if (id === 'JI') {
      const s = ensure();
      // JI Note 1 sentinel: positions 8-35 carry the fixed message.
      if (line.slice(7, 35).trimEnd() === 'NO BOND ON FILE IN ACE EBOND') {
        s.noBondOnFile = true;
        continue;
      }
      const v = parseRecord(OUTPUT_JI, line).values;
      s.bonds.push({
        suretyCode: v.suretyCode,
        primarySurety: v.primarySuretyIndicator === undefined ? undefined : v.primarySuretyIndicator === 'Y',
        bondTypeCode: v.bondTypeCode,
        bondDesignationTypeCode: v.bondDesignationTypeCode,
        multipleBonds: v.multipleBondsIndicator === undefined ? undefined : v.multipleBondsIndicator === 'Y',
        bondNumber: v.bondNumber,
        singleEntryBondAmountCents: amount(v.singleEntryBondAmount),
        suretyLiabilityAmountDollars: amount(v.suretyLiabilityAmount),
      });
    } else if (id === 'JJ') {
      const v = parseRecord(OUTPUT_JJ, line).values;
      ensure().protests.push({
        protestNumber: v.protestNumber,
        protestType: v.protestType,
        protestStatus: v.protestStatus,
        protestDecisionDate: v.protestDecisionDate,
        summons: v.summonsIndicator === undefined ? undefined : v.summonsIndicator === '1',
      });
    } else if (id === 'JK') {
      const s = ensure();
      // JK Note 1 sentinel: positions 4-27 carry the fixed message.
      if (line.slice(3, 27).trimEnd() === 'BILLING DATA NOT ON FILE') {
        s.billingDataNotOnFile = true;
        continue;
      }
      const v = parseRecord(OUTPUT_JK, line).values;
      s.bills.push({
        billNumber: v.billNumber,
        billDate: v.billDate,
        billType: v.billType,
        billCollectionStatus: v.billCollectionStatus,
        totalBillAmountCents: amount(v.totalBillAmount),
        paidAmountCents: amount(v.paidAmount),
        principalAmountCents: amount(v.principalAmount),
        interestAmountCents: amount(v.interestAmount),
      });
    } else if (id === 'JL') {
      const s = ensure();
      // JL Note 1 sentinel: positions 4-30 carry the fixed message.
      if (line.slice(3, 30).trimEnd() === 'COLLECTION DATA NOT ON FILE') {
        s.collectionDataNotOnFile = true;
        continue;
      }
      const v = parseRecord(OUTPUT_JL, line).values;
      s.collections.push({ collectionDate: v.collectionDate, totalAmountCents: amount(v.totalAmount) });
    } else if (id === 'JM') {
      const v = parseRecord(OUTPUT_JM, line).values;
      ensure().classAmounts.push({ classCode: v.classCode, amountCents: amount(v.classCodeAmount) });
    } else if (id === 'JN') {
      const s = ensure();
      // JN Note 1 sentinel: positions 10-33 carry the fixed message.
      if (line.slice(9, 33).trimEnd() === 'BILLING DATA NOT ON FILE') {
        s.billingDataNotOnFile = true;
        continue;
      }
      const v = parseRecord(OUTPUT_JN, line).values;
      s.suretyBills.push({
        suretyCode: v.suretyCode,
        primarySurety: v.primarySuretyIndicator === undefined ? undefined : v.primarySuretyIndicator === 'Y',
        report612Date: v.report612Date,
        billNumber: v.billNumber,
        billDate: v.billDate,
        billType: v.billType,
        billCollectionStatus: v.billCollectionStatus,
        totalBillAmountCents: amount(v.totalBillAmount),
        paidAmountCents: amount(v.paidAmount),
        principalAmountCents: amount(v.principalAmount),
        interestAmountCents: amount(v.interestAmount),
      });
    } else if (id === 'JZ') {
      const v = parseRecord(OUTPUT_JZ, line).values;
      const code = v.conditionCode ?? '';
      response.conditions.push({
        conditionCode: code,
        narrative: v.narrativeText ?? ES_QUERY_CONDITION_CODES[code] ?? '',
        entryFilerCode: v.entryFilerCode,
        entryNumber: v.entryNumber,
        districtPortOfEntry: v.districtPortOfEntry,
      });
    } else if (current) {
      // 10-90 detail grouping (incl. 4A) — kept raw; the AE chapter owns
      // these layouts (ESQ-52 Note 1).
      current.detailLines.push(line);
    }
  }

  return response;
}

export interface EsQueryResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  response: EsQueryResponse;
}

/** Parse a complete ER wire response (A/B…Y/Z envelope included). */
export function parseEsQueryResponseBatch(lines: string[]): EsQueryResponseBatch {
  const batch = parseBatch(lines);
  const merged: EsQueryResponse = { summaries: [], conditions: [] };
  for (const block of batch.blocks) {
    const r = parseEsQueryResponse(block.transactionLines);
    if (r.criteria) merged.criteria = r.criteria;
    merged.summaries.push(...r.summaries);
    merged.conditions.push(...r.conditions);
  }
  return { batchRejected: batch.rejected, envelopeConditions: batch.conditions, response: merged };
}
