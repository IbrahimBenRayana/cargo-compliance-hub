/**
 * Entry Summary Query (EQ/ER) record definitions — transcribed from the ACE
 * ABI CATAIR "Entry Summary Query" chapter, V26 May 2026
 * (docs/abi-engine/specs/entry-summary/es-query-v26-2026-05.pdf).
 *
 * Input records: J0 (detail return request), J1 (entry number query, up to
 * five entries per record), J2 (criteria query). Output records: JA (criteria
 * echo), JB..JN (per-summary status grouping), JZ (returned condition), and
 * 4A (CBP line number prefacing each output 40-record of the detail
 * grouping). The detail grouping itself (10- through 90-Records) is not
 * re-described by the chapter — it reuses the AE input records (ESQ-52).
 * Page references in comments are to the chapter's ESQ-n page numbers.
 *
 * Transcription notes (ambiguities resolved):
 * - The J1 filler at 3-5 is printed with a blank Designation column
 *   (ESQ-18); treated as a mandatory space filler like every other filler.
 * - Several output data elements are designated M by the spec yet are
 *   documented as "space fill" in some states (e.g. JB PSC Indicator, JC
 *   Invoice Status Code). Designations are transcribed as printed; this is
 *   harmless because these records are parse-only (parseRecord never
 *   enforces designations).
 * - JD/JE/JL/JM amount fields are class N/AN on paper but may carry a
 *   leading negative sign per JD Note 3 / JE Note 1 / JL Note 2 / JM Note 2.
 *   parseRecord does not class-validate on read, so the sign survives to the
 *   parser, which handles it.
 * - The JN "Ending Tariff Position"-style blank designation does not occur,
 *   but the JN 612 Report Date and surety fields follow ESQ-48 as printed.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

// ── Input records ──────────────────────────────────────────

/** Detail Return Request — input J0-Record (ESQ-17). */
export const INPUT_J0: RecordDef = {
  id: 'J0',
  name: 'DetailReturnRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'J0' },
    { name: 'returnDetailRequestIndicator', start: 3, end: 3, class: 'AN', designation: 'M' }, // 'Y'
    { name: 'filler', start: 4, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Number Query Request — input J1-Record (ESQ-18). */
export const INPUT_J1: RecordDef = {
  id: 'J1',
  name: 'EntryNumberQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'J1' },
    { name: 'filler', start: 3, end: 5, class: 'S', designation: 'M' },
    { name: 'entryFilerCode1', start: 6, end: 8, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 9, end: 10, class: 'S', designation: 'M' },
    { name: 'entryNumber1', start: 11, end: 18, class: 'AN', designation: 'M' },
    { name: 'entryFilerCode2', start: 19, end: 21, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 22, end: 23, class: 'S', designation: 'M' },
    { name: 'entryNumber2', start: 24, end: 31, class: 'AN', designation: 'C' },
    { name: 'entryFilerCode3', start: 32, end: 34, class: 'AN', designation: 'C' },
    { name: 'filler4', start: 35, end: 36, class: 'S', designation: 'M' },
    { name: 'entryNumber3', start: 37, end: 44, class: 'AN', designation: 'C' },
    { name: 'entryFilerCode4', start: 45, end: 47, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 48, end: 49, class: 'S', designation: 'M' },
    { name: 'entryNumber4', start: 50, end: 57, class: 'AN', designation: 'C' },
    { name: 'entryFilerCode5', start: 58, end: 60, class: 'AN', designation: 'C' },
    { name: 'filler6', start: 61, end: 62, class: 'S', designation: 'M' },
    { name: 'entryNumber5', start: 63, end: 70, class: 'AN', designation: 'C' },
    { name: 'filler7', start: 71, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Criteria Query Request — input J2-Record (ESQ-19..21). */
export const INPUT_J2: RecordDef = {
  id: 'J2',
  name: 'EntrySummaryCriteriaQueryRequest',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'J2' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'criteriaQueryTypeCode', start: 4, end: 6, class: 'AN', designation: 'M' }, // AII|DOC|RCN|PSC|LIQ|NLQ|EES
    { name: 'filler2', start: 7, end: 7, class: 'S', designation: 'M' },
    { name: 'requestedFromDateTime', start: 8, end: 21, class: 'AN', designation: 'M' }, // MMDDYYHHMMSSXX
    { name: 'requestedToDateTime', start: 22, end: 35, class: 'AN', designation: 'M' },
    { name: 'filler3', start: 36, end: 36, class: 'S', designation: 'M' },
    { name: 'entrySummariesFlag', start: 37, end: 37, class: 'AN', designation: 'O' }, // 'Y'
    { name: 'ftaReconSummariesFlag', start: 38, end: 38, class: 'AN', designation: 'O' },
    { name: 'otherReconSummariesFlag', start: 39, end: 39, class: 'AN', designation: 'O' },
    { name: 'drawbackSummariesFlag', start: 40, end: 40, class: 'AN', designation: 'O' },
    { name: 'dutyDeferralSummariesFlag', start: 41, end: 41, class: 'AN', designation: 'O' },
    { name: 'collectionBillInformationCode', start: 42, end: 42, class: 'N', designation: 'O' }, // 1-6, Note 5
    { name: 'filler4', start: 43, end: 80, class: 'S', designation: 'M' },
  ],
};

// ── Output records ─────────────────────────────────────────

/** Criteria Query Response Header — output JA-Record (ESQ-24). */
export const OUTPUT_JA: RecordDef = {
  id: 'JA',
  name: 'CriteriaQueryResponseHeader',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JA' },
    { name: 'filler', start: 3, end: 3, class: 'S', designation: 'M' },
    { name: 'criteriaQueryTypeCode', start: 4, end: 6, class: 'AN', designation: 'M' },
    { name: 'filler2', start: 7, end: 7, class: 'S', designation: 'M' },
    { name: 'requestedFromDateTime', start: 8, end: 21, class: 'AN', designation: 'M' },
    { name: 'requestedToDateTime', start: 22, end: 35, class: 'AN', designation: 'M' },
    { name: 'filler3', start: 36, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JB-Record (ESQ-25..26). */
export const OUTPUT_JB: RecordDef = {
  id: 'JB',
  name: 'EntrySummaryStatusJB',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JB' },
    { name: 'entryFilerCode', start: 3, end: 5, class: 'AN', designation: 'M' },
    { name: 'filler', start: 6, end: 7, class: 'S', designation: 'M' },
    { name: 'entryNumber', start: 8, end: 15, class: 'AN', designation: 'M' },
    { name: 'versionNumber', start: 16, end: 20, class: 'AN', designation: 'M' }, // 3 major + 2 minor (Note 3)
    { name: 'acceptDateTime', start: 21, end: 34, class: 'AN', designation: 'M' }, // MMDDYYHHMMSSXX
    { name: 'pscIndicator', start: 35, end: 35, class: 'AN', designation: 'M' }, // 'Y' | space
    { name: 'pscAcceptDate', start: 36, end: 41, class: 'D', designation: 'C' },
    { name: 'ownershipDataReturnedIndicator', start: 42, end: 42, class: 'AN', designation: 'M' }, // 'Y'
    { name: 'liquidationStatusCode', start: 43, end: 43, class: 'AN', designation: 'M' }, // 1|2|3 (Note 4)
    { name: 'liquidationDate', start: 44, end: 49, class: 'D', designation: 'C' },
    { name: 'filler2', start: 50, end: 50, class: 'S', designation: 'M' },
    { name: 'centerId', start: 51, end: 56, class: 'AN', designation: 'M' }, // CEE001.. (Note 5)
    { name: 'filler3', start: 57, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JC-Record (ESQ-28..32). */
export const OUTPUT_JC: RecordDef = {
  id: 'JC',
  name: 'EntrySummaryStatusJC',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JC' },
    { name: 'entrySummaryControlStatus', start: 3, end: 3, class: 'AN', designation: 'M' }, // 1 trade, 2 CBP, 3 inactive
    { name: 'entrySummaryStatusCode', start: 4, end: 4, class: 'AN', designation: 'M' }, // 1 accepted, 2 rejected, 3 canceled
    { name: 'entrySummaryStatusDate', start: 5, end: 10, class: 'D', designation: 'M' },
    { name: 'lateFilingStatusCode', start: 11, end: 11, class: 'AN', designation: 'M' }, // 0 | 1
    { name: 'releaseStatusCode', start: 12, end: 12, class: 'AN', designation: 'C' }, // 0|1|2 (Note 1)
    { name: 'releaseDate', start: 13, end: 18, class: 'D', designation: 'C' },
    { name: 'filler', start: 19, end: 19, class: 'S', designation: 'M' },
    { name: 'collectionStatusCode', start: 20, end: 20, class: 'AN', designation: 'M' }, // 0,2,3,5,6
    { name: 'collectionDate', start: 21, end: 26, class: 'D', designation: 'C' },
    { name: 'filler2', start: 27, end: 27, class: 'S', designation: 'M' },
    { name: 'extensionSuspensionDate', start: 28, end: 33, class: 'D', designation: 'C' },
    { name: 'extensionSuspensionNoticeDate', start: 34, end: 39, class: 'D', designation: 'C' },
    { name: 'censusHeaderStatusCode', start: 40, end: 40, class: 'AN', designation: 'M' }, // 0|1|6
    { name: 'invoiceStatusCode', start: 41, end: 41, class: 'AN', designation: 'M' }, // space|1..4
    { name: 'protestStatusCode', start: 42, end: 43, class: 'AN', designation: 'M' }, // YS | NO
    { name: 'quotaStatusCode', start: 44, end: 44, class: 'AN', designation: 'M' }, // space | 1
    { name: 'tradeAgreementReconciliationFilerCode', start: 45, end: 47, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 48, end: 49, class: 'S', designation: 'M' },
    { name: 'tradeAgreementReconciliationEntryNumber', start: 50, end: 57, class: 'AN', designation: 'C' },
    { name: 'otherReconciliationFilerCode', start: 58, end: 60, class: 'AN', designation: 'C' },
    { name: 'filler4', start: 61, end: 62, class: 'S', designation: 'M' },
    { name: 'otherReconciliationEntryNumber', start: 63, end: 70, class: 'AN', designation: 'C' },
    { name: 'extensionSuspensionStatusCode1', start: 71, end: 72, class: 'AN', designation: 'C' }, // 43..66
    { name: 'extensionSuspensionStatusCode2', start: 73, end: 74, class: 'AN', designation: 'O' },
    { name: 'extensionSuspensionStatusCode3', start: 75, end: 76, class: 'AN', designation: 'O' },
    { name: 'extensionSuspensionStatusCode4', start: 77, end: 78, class: 'AN', designation: 'O' },
    { name: 'filler5', start: 79, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JD-Record (ESQ-33..34). */
export const OUTPUT_JD: RecordDef = {
  id: 'JD',
  name: 'EntrySummaryStatusJD',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JD' },
    { name: 'cbpReviewIndicator', start: 3, end: 3, class: 'AN', designation: 'M' }, // 1 under review, 2 not
    { name: 'entryDate', start: 4, end: 9, class: 'D', designation: 'C' },
    // Amounts are 12N, two implied decimals; may carry a leading '-' (Note 3).
    { name: 'liquidatedDuty', start: 10, end: 21, class: 'X', designation: 'C', justify: 'right' },
    { name: 'liquidatedTax', start: 22, end: 33, class: 'X', designation: 'C', justify: 'right' },
    { name: 'liquidatedFees', start: 34, end: 45, class: 'X', designation: 'C', justify: 'right' },
    { name: 'liquidatedInterest', start: 46, end: 57, class: 'X', designation: 'C', justify: 'right' },
    { name: 'liquidatedAdCvd', start: 58, end: 69, class: 'X', designation: 'C', justify: 'right' }, // never negative
    { name: 'liquidationReasonCode1', start: 70, end: 71, class: 'AN', designation: 'C' }, // Note 2
    { name: 'liquidationReasonCode2', start: 72, end: 73, class: 'AN', designation: 'C' },
    { name: 'liquidationReasonCode3', start: 74, end: 75, class: 'AN', designation: 'C' },
    { name: 'immediateDeliveryIndicator', start: 76, end: 76, class: 'AN', designation: 'M' }, // Y | N
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JE-Record (ESQ-35). */
export const OUTPUT_JE: RecordDef = {
  id: 'JE',
  name: 'EntrySummaryStatusJE',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JE' },
    // 13AN, two implied decimals; recon summaries may be negative (Note 1).
    { name: 'estimatedDuty', start: 3, end: 15, class: 'X', designation: 'C', justify: 'right' },
    { name: 'estimatedTax', start: 16, end: 28, class: 'X', designation: 'C', justify: 'right' },
    { name: 'estimatedFees', start: 29, end: 41, class: 'X', designation: 'C', justify: 'right' },
    { name: 'estimatedInterest', start: 42, end: 54, class: 'X', designation: 'C', justify: 'right' },
    { name: 'estimatedAdCvd', start: 55, end: 67, class: 'X', designation: 'C', justify: 'right' },
    { name: 'filler', start: 68, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JF-Record (ESQ-36). */
export const OUTPUT_JF: RecordDef = {
  id: 'JF',
  name: 'EntrySummaryStatusJF',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JF' },
    { name: 'importerOfRecordNumber', start: 3, end: 14, class: 'X', designation: 'C' }, // Note 1 formats
    { name: 'entryType', start: 15, end: 16, class: 'N', designation: 'C' },
    { name: 'rejectDate', start: 17, end: 22, class: 'D', designation: 'C' },
    { name: 'acceleratedDrawbackIndicator', start: 23, end: 23, class: 'N', designation: 'C' }, // 1|2|3
    { name: 'electronicInvoiceIndicator', start: 24, end: 24, class: 'A', designation: 'C' }, // 'E' | space
    { name: 'districtPortOfEntry', start: 25, end: 28, class: 'AN', designation: 'M' },
    { name: 'entrySummaryFilingDate', start: 29, end: 34, class: 'D', designation: 'C' },
    { name: 'filler', start: 35, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JG-Record (ESQ-38). */
export const OUTPUT_JG: RecordDef = {
  id: 'JG',
  name: 'EntrySummaryStatusJG',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JG' },
    { name: 'numberOfWithdrawals', start: 3, end: 5, class: 'N', designation: 'C' }, // entry types 21/22 only
    { name: 'warehouseFinalWithdrawalIndicator', start: 6, end: 6, class: 'A', designation: 'C' }, // Y/N
    { name: 'importSpecialistTeam', start: 7, end: 9, class: 'AN', designation: 'C' },
    { name: 'centerId', start: 10, end: 15, class: 'AN', designation: 'C' },
    { name: 'numberOfLineItems', start: 16, end: 18, class: 'N', designation: 'C' },
    { name: 'filler', start: 19, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information — output JH-Record (ESQ-39). */
export const OUTPUT_JH: RecordDef = {
  id: 'JH',
  name: 'EntrySummaryStatusJH',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JH' },
    { name: 'cbpForm4811ReferenceNumber', start: 3, end: 14, class: 'X', designation: 'C' },
    { name: 'preliminaryStatementPrintDate', start: 15, end: 20, class: 'D', designation: 'C' },
    { name: 'brokerReferenceNumber', start: 21, end: 29, class: 'X', designation: 'C' },
    { name: 'filler', start: 30, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Bond/Surety) — output JI-Record (ESQ-40..41). */
export const OUTPUT_JI: RecordDef = {
  id: 'JI',
  name: 'EntrySummaryStatusJI',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JI' },
    { name: 'suretyCode', start: 3, end: 5, class: 'N', designation: 'C' },
    { name: 'primarySuretyIndicator', start: 6, end: 6, class: 'AN', designation: 'C' }, // Y/N
    { name: 'bondTypeCode', start: 7, end: 7, class: 'N', designation: 'C' }, // 0|8|9
    { name: 'bondDesignationTypeCode', start: 8, end: 8, class: 'AN', designation: 'C' }, // N,A,V,R,B,U,T,C,E
    { name: 'multipleBondsIndicator', start: 9, end: 9, class: 'AN', designation: 'C' }, // Y/N/null
    { name: 'bondNumber', start: 10, end: 18, class: 'AN', designation: 'C' },
    { name: 'singleEntryBondAmount', start: 19, end: 33, class: 'N', designation: 'C' }, // 15N, 2 implied decimals
    { name: 'suretyLiabilityAmount', start: 34, end: 43, class: 'N', designation: 'C' }, // 10N, whole dollars
    { name: 'filler', start: 44, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Protest) — output JJ-Record (ESQ-42). */
export const OUTPUT_JJ: RecordDef = {
  id: 'JJ',
  name: 'EntrySummaryStatusJJ',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JJ' },
    { name: 'protestNumber', start: 3, end: 14, class: 'N', designation: 'C' },
    { name: 'protestType', start: 15, end: 15, class: 'N', designation: 'C' }, // 1..4
    { name: 'protestStatus', start: 16, end: 17, class: 'A', designation: 'C' }, // OP,AP,DN,NP,SP,PD,WD,UT
    { name: 'protestDecisionDate', start: 18, end: 23, class: 'D', designation: 'C' },
    { name: 'summonsIndicator', start: 24, end: 24, class: 'N', designation: 'C' }, // 1 | 0
    { name: 'filler', start: 25, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Bills) — output JK-Record (ESQ-43..44). */
export const OUTPUT_JK: RecordDef = {
  id: 'JK',
  name: 'EntrySummaryStatusJK',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JK' },
    { name: 'billNumber', start: 3, end: 13, class: 'AN', designation: 'M' }, // 11AN (rev 23 change from N)
    { name: 'billDate', start: 14, end: 19, class: 'D', designation: 'M' },
    { name: 'billType', start: 20, end: 20, class: 'N', designation: 'M' }, // 1..7
    { name: 'billCollectionStatus', start: 21, end: 22, class: 'N', designation: 'M' }, // 01..11
    { name: 'totalBillAmount', start: 23, end: 33, class: 'N', designation: 'M' }, // 11N, 2 implied decimals
    { name: 'paidAmount', start: 34, end: 44, class: 'N', designation: 'C' },
    { name: 'principalAmount', start: 45, end: 55, class: 'N', designation: 'C' },
    { name: 'interestAmount', start: 56, end: 66, class: 'N', designation: 'C' },
    { name: 'filler', start: 67, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Collections) — output JL-Record (ESQ-45). */
export const OUTPUT_JL: RecordDef = {
  id: 'JL',
  name: 'EntrySummaryStatusJL',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JL' },
    { name: 'collectionDate', start: 3, end: 8, class: 'D', designation: 'M' },
    { name: 'totalAmount', start: 9, end: 19, class: 'X', designation: 'M', justify: 'right' }, // 11N; may be negative (Note 2)
    { name: 'filler', start: 20, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Class Codes) — output JM-Record (ESQ-46..47). */
export const OUTPUT_JM: RecordDef = {
  id: 'JM',
  name: 'EntrySummaryStatusJM',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JM' },
    { name: 'classCode', start: 3, end: 5, class: 'N', designation: 'C' }, // Note 1 table (001, 499, 501, …)
    { name: 'classCodeAmount', start: 6, end: 16, class: 'X', designation: 'C', justify: 'right' }, // 11N; may be negative (Note 2)
    { name: 'filler', start: 17, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Entry Summary Status Information (Surety Bills) — output JN-Record (ESQ-48..49). */
export const OUTPUT_JN: RecordDef = {
  id: 'JN',
  name: 'EntrySummaryStatusJN',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JN' },
    { name: 'suretyCode', start: 3, end: 5, class: 'N', designation: 'C' },
    { name: 'primarySuretyIndicator', start: 6, end: 6, class: 'AN', designation: 'C' },
    { name: 'report612Date', start: 7, end: 12, class: 'D', designation: 'C' },
    { name: 'billNumber', start: 13, end: 23, class: 'N', designation: 'M' }, // 11N
    { name: 'billDate', start: 24, end: 29, class: 'D', designation: 'M' },
    { name: 'billType', start: 30, end: 30, class: 'N', designation: 'M' }, // 1..7
    { name: 'billCollectionStatus', start: 31, end: 32, class: 'N', designation: 'M' }, // 01..11
    { name: 'totalBillAmount', start: 33, end: 43, class: 'N', designation: 'M' },
    { name: 'paidAmount', start: 44, end: 54, class: 'N', designation: 'C' },
    { name: 'principalAmount', start: 55, end: 65, class: 'N', designation: 'C' },
    { name: 'interestAmount', start: 66, end: 76, class: 'N', designation: 'C' },
    { name: 'filler', start: 77, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Returned Condition — output JZ-Record (ESQ-50..51). */
export const OUTPUT_JZ: RecordDef = {
  id: 'JZ',
  name: 'ReturnedCondition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'JZ' },
    { name: 'conditionCode', start: 3, end: 5, class: 'AN', designation: 'M' }, // Note 1 (X34.., 001..017)
    { name: 'reasonCode', start: 6, end: 8, class: 'AN', designation: 'C' }, // CBP internal
    // Printed 40AN, but Note 1 narratives contain ';' and '<' — class X.
    { name: 'narrativeText', start: 9, end: 48, class: 'X', designation: 'M' },
    { name: 'filler', start: 49, end: 49, class: 'S', designation: 'M' },
    { name: 'entryFilerCode', start: 50, end: 52, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 53, end: 54, class: 'S', designation: 'C' },
    { name: 'entryNumber', start: 55, end: 62, class: 'AN', designation: 'C' },
    { name: 'filler3', start: 63, end: 64, class: 'S', designation: 'M' },
    { name: 'districtPortOfEntry', start: 65, end: 68, class: 'AN', designation: 'M' },
    { name: 'filler4', start: 69, end: 80, class: 'S', designation: 'M' },
  ],
};

/** CBP Line Number — output 4A-Record, prefaces each detail 40-record (ESQ-53). */
export const OUTPUT_4A: RecordDef = {
  id: '4A',
  name: 'CbpLineNumber',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: '4A' },
    { name: 'cbpLineNumber', start: 3, end: 7, class: 'N', designation: 'M' }, // right justified, zero fill
    { name: 'filler', start: 8, end: 80, class: 'S', designation: 'M' },
  ],
};

/** Criteria query type codes (input J2-Record, ESQ-19). */
export const ES_QUERY_CRITERIA_TYPES = ['AII', 'DOC', 'RCN', 'PSC', 'LIQ', 'NLQ', 'EES'] as const;
export type EsQueryCriteriaType = (typeof ES_QUERY_CRITERIA_TYPES)[number];

/** JZ condition codes and narratives (Output JZ-Record, Note 1, ESQ-50..51). */
export const ES_QUERY_CONDITION_CODES: Record<string, string> = {
  X34: 'UNKNOWN RECORD ID FOUND IN GROUPING',
  X35: 'OUT OF SEQUENCE RECORD FOUND IN GROUPING',
  X37: 'MISSING DATA RECORD FOUND IN GROUPING',
  X38: 'NON-CONTIGUOUS ITEM FOUND IN GROUPING',
  X39: 'DATA FOUND IN FILLER',
  X41: 'MULTIPLE QUERIES IN BATCH NOT ALLOWED',
  '001': 'RETURN DETAIL REQUEST IND MUST BE Y',
  '002': 'QUERY REQUEST MISSING',
  '003': 'ENTRY FILER CODE MISSING',
  '004': 'ENTRY NUMBER MISSING',
  '005': 'CRITERIA QUERY TYPE CODE MISSING',
  '006': 'CRITERIA QUERY TYPE CODE UNKNOWN',
  '007': 'REQUESTED FROM DATE TIME MISSING',
  '008': 'REQUESTED FROM DATE TIME UNKNOWN',
  '009': 'REQUESTED TO DATE TIME MISSING',
  '010': 'REQUESTED TO DATE TIME UNKNOWN',
  '011': 'REQUESTED TO DATE < REQUESTED FROM DATE',
  '012': 'DATE RANGE DAY LIMIT EXCEEDED',
  '013': 'ENTRY SUMMARY NOT FOUND FOR QUERY',
  '014': 'QUERY NOT PERMITTED FOR ENTRY NUMBER',
  '015': 'QUERY COMPLETE - NO SUMMARIES FOUND',
  '016': 'OUTPUT LIMIT REACHED; ADDTNL ES FOUND',
  '017': 'FUTURE REQUESTED TO DATE NOT ALLOWED',
};

for (const def of [
  INPUT_J0,
  INPUT_J1,
  INPUT_J2,
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
  OUTPUT_4A,
]) {
  assertRecordDef(def);
}
