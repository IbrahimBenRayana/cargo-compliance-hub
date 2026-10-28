/**
 * Entry Summary Status Notification (UC) record definitions — transcribed
 * from the "ACE Entry Summary Status Notification" chapter, V30 June 2025
 * (docs/abi-engine/specs/entry-summary/uc-status-notification-v30-2025-06.pdf).
 *
 * UC is INBOUND-ONLY: CBP → filer unsolicited messages. There are no input
 * records (ESS-12) and therefore no builder — parse only. A UC batch
 * contains a single block with a single notification grouping: E1, then
 * conditionally E2, E3 (≤7), E4 (≤998), and SO70/SO71/SO72 PGA groupings
 * (structure map, ESS-14). Page references in comments are ESS-n.
 *
 * Naming note: the UC chapter's E1-record is a DIFFERENT layout from the
 * AX response E1-record (ae/responseDefs.ts OUTPUT_E1); these defs are
 * prefixed UC_ to keep the two apart.
 *
 * Transcription notes (ambiguities resolved):
 * - SO70 Status Action Date is printed as 6N (not 6D); transcribed as N.
 * - SO70 "Ending Tariff Position" (68-69) is printed with a blank Status
 *   column; treated as conditional like its Beginning counterpart.
 * - SO70 "PGA Entry Hold Type" occupies the single position 78 (printed
 *   "78" rather than a range).
 * - E2 Note 2: an automated-source E2 may be blank except for the control
 *   identifier — every data field is conditional, so this parses cleanly.
 */
import type { RecordDef } from '../../records/codec.js';
import { assertRecordDef } from '../../records/codec.js';

/** Entry Summary Notification — output E1-Record (ESS-15..17). */
export const UC_E1: RecordDef = {
  id: 'E1',
  name: 'UcEntrySummaryNotification',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E1' },
    { name: 'dispositionTypeCode', start: 3, end: 3, class: 'AN', designation: 'M' }, // see UC_DISPOSITION_TYPE_CODES
    { name: 'sourceOfActionCode', start: 4, end: 4, class: 'AN', designation: 'M' }, // 1 manual, 2 automated
    { name: 'importSpecialistTeam', start: 5, end: 7, class: 'AN', designation: 'C' }, // Note 5: only when an ES is on file
    { name: 'notificationReasonCode', start: 8, end: 10, class: 'AN', designation: 'C' }, // Note 2; types 4/R only
    { name: 'dateOfAction', start: 11, end: 16, class: 'D', designation: 'M' },
    { name: 'filler', start: 17, end: 17, class: 'S', designation: 'M' },
    { name: 'filler2', start: 18, end: 23, class: 'S', designation: 'M' }, // reserved: future Due Date
    { name: 'filler3', start: 24, end: 50, class: 'S', designation: 'M' },
    { name: 'entryFilerCode', start: 51, end: 53, class: 'AN', designation: 'M' },
    { name: 'filler4', start: 54, end: 55, class: 'S', designation: 'M' }, // reserved: filer/entry expansion
    { name: 'entryNumber', start: 56, end: 63, class: 'AN', designation: 'M' },
    { name: 'filler5', start: 64, end: 65, class: 'S', designation: 'M' }, // reserved: line id expansion
    { name: 'lineItemIdentifier', start: 66, end: 68, class: 'X', designation: 'C' },
    { name: 'brokerReferenceNumber', start: 69, end: 77, class: 'X', designation: 'C' },
    { name: 'filler6', start: 78, end: 80, class: 'S', designation: 'M' }, // reserved: broker ref expansion
  ],
};

/** CBP User & Action Identifier — output E2-Record (ESS-22..23). */
export const UC_E2: RecordDef = {
  id: 'E2',
  name: 'UcCbpUserActionIdentifier',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E2' },
    { name: 'filler', start: 3, end: 4, class: 'S', designation: 'M' },
    { name: 'cbpUser', start: 5, end: 34, class: 'X', designation: 'C' }, // last, first
    { name: 'filler2', start: 35, end: 36, class: 'S', designation: 'M' },
    { name: 'telephoneNumber', start: 37, end: 46, class: 'AN', designation: 'C' }, // disposition 4 only; no dashes
    { name: 'filler3', start: 47, end: 48, class: 'S', designation: 'M' },
    { name: 'actionIdentificationNumber', start: 49, end: 60, class: 'AN', designation: 'C' }, // = ES number (Note 4)
    { name: 'filler4', start: 61, end: 61, class: 'S', designation: 'M' },
    { name: 'telephoneExtensionNumber', start: 62, end: 65, class: 'AN', designation: 'C' },
    { name: 'filler5', start: 66, end: 80, class: 'S', designation: 'M' },
  ],
};

/** CBP User Remarks — output E3-Record, repeats ≤7 for ≤500 chars (ESS-24). */
export const UC_E3: RecordDef = {
  id: 'E3',
  name: 'UcCbpUserRemarks',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E3' },
    { name: 'remarks', start: 3, end: 80, class: 'X', designation: 'M' },
  ],
};

/** Quota Line Status — output E4-Record, repeats per quota line (ESS-25..26). */
export const UC_E4: RecordDef = {
  id: 'E4',
  name: 'UcQuotaLineStatus',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'E4' },
    { name: 'lineItemIdentifier', start: 3, end: 5, class: 'X', designation: 'M' }, // CBP-added lines contain '*'
    { name: 'quotaLineStatusCode', start: 6, end: 8, class: 'AN', designation: 'M' }, // Note 1 (Q01..Q28)
    { name: 'filler', start: 9, end: 11, class: 'S', designation: 'M' },
    // Printed 30AN, but the Note 1 narratives contain '/' and '>' — class X.
    { name: 'quotaLineStatusDescription', start: 12, end: 41, class: 'X', designation: 'M' },
    { name: 'requestedQuotaQuantity', start: 42, end: 53, class: 'N', designation: 'M' }, // 2 implied decimals
    { name: 'quotaRequestedUomCode', start: 54, end: 56, class: 'AN', designation: 'M' },
    { name: 'reservedQuotaQuantity', start: 57, end: 68, class: 'N', designation: 'C' }, // 2 implied decimals
    { name: 'reservedQuotaUomCode', start: 69, end: 71, class: 'AN', designation: 'C' },
    { name: 'filler2', start: 72, end: 80, class: 'S', designation: 'M' },
  ],
};

/** PGA Processing Disposition — output SO70-Record (ESS-27..30). */
export const UC_SO70: RecordDef = {
  id: 'SO70',
  name: 'UcPgaProcessingDisposition',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO70' },
    { name: 'governmentAgencyCode', start: 5, end: 7, class: 'AN', designation: 'M' }, // Appendix V
    { name: 'governmentAgencyProgramCode', start: 8, end: 10, class: 'AN', designation: 'C' },
    { name: 'statusActionDate', start: 11, end: 16, class: 'N', designation: 'C' }, // MMDDYY, printed as 6N
    { name: 'statusActionTime', start: 17, end: 20, class: 'N', designation: 'C' }, // HHMM military (Note 8)
    { name: 'pgaEntryLevelStatusCode', start: 21, end: 22, class: 'AN', designation: 'C' }, // Note 1
    { name: 'pgaEntryLevelStatusMessage', start: 23, end: 50, class: 'X', designation: 'C' },
    { name: 'entryLineLevelStatusCode', start: 51, end: 52, class: 'AN', designation: 'C' }, // FUTURE USE
    { name: 'pgaLineLevelStatusCode', start: 53, end: 54, class: 'AN', designation: 'C' }, // Note 2
    { name: 'statusReasonCode', start: 55, end: 56, class: 'AN', designation: 'C' }, // Note 3
    { name: 'beginningCbpLine', start: 57, end: 59, class: 'N', designation: 'C' },
    { name: 'beginningTariffPosition', start: 60, end: 61, class: 'N', designation: 'C' }, // Note 4
    { name: 'beginningPgaLine', start: 62, end: 64, class: 'N', designation: 'C' }, // Note 9: '000' for 1USG-only PGAs
    { name: 'endingCbpLine', start: 65, end: 67, class: 'N', designation: 'C' },
    { name: 'endingTariffPosition', start: 68, end: 69, class: 'N', designation: 'C' },
    { name: 'endingPgaLine', start: 70, end: 72, class: 'N', designation: 'C' },
    { name: 'documentTypeCode', start: 73, end: 77, class: 'AN', designation: 'C' }, // Note 5 (SO60 table)
    { name: 'pgaEntryHoldType', start: 78, end: 78, class: 'X', designation: 'C' }, // Note 6: 1 CBP-set, 2 PGA-set
    { name: 'pgaProcessingGroupVersion', start: 79, end: 80, class: 'N', designation: 'C' }, // Note 7: space|01..04
  ],
};

/** PGA Review — output SO71-Record, repeats per SO70 (ESS-31..32). */
export const UC_SO71: RecordDef = {
  id: 'SO71',
  name: 'UcPgaReview',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO71' },
    { name: 'referenceIdQualifier', start: 5, end: 6, class: 'AN', designation: 'C' }, // Note 1
    { name: 'referenceIdNumber', start: 7, end: 18, class: 'X', designation: 'C' }, // e.g. FDA prior notice (Note 2)
    { name: 'referenceIdReceiptDate', start: 19, end: 24, class: 'N', designation: 'C' }, // MMDDYY (Note 3)
    { name: 'referenceIdReceiptTime', start: 25, end: 30, class: 'N', designation: 'C' }, // HHMMSS military
    { name: 'subReasonCode1', start: 31, end: 33, class: 'AN', designation: 'C' }, // Note 4
    { name: 'subReasonCode2', start: 34, end: 36, class: 'AN', designation: 'C' },
    { name: 'subReasonCode3', start: 37, end: 39, class: 'AN', designation: 'C' },
    { name: 'subReasonCode4', start: 40, end: 42, class: 'AN', designation: 'C' },
    { name: 'subReasonCode5', start: 43, end: 45, class: 'AN', designation: 'C' },
    { name: 'subReasonCode6', start: 46, end: 48, class: 'AN', designation: 'C' },
    { name: 'subReasonCode7', start: 49, end: 51, class: 'AN', designation: 'C' },
    { name: 'subReasonCode8', start: 52, end: 54, class: 'AN', designation: 'C' },
    { name: 'subReasonCode9', start: 55, end: 57, class: 'AN', designation: 'C' },
    { name: 'subReasonCode10', start: 58, end: 60, class: 'AN', designation: 'C' },
    { name: 'referenceIdQualifier2', start: 61, end: 62, class: 'AN', designation: 'C' }, // added rev 18 (>12X ids)
    { name: 'referenceIdNumber2', start: 63, end: 80, class: 'X', designation: 'C' },
  ],
};

/** PGA Comment — output SO72-Record, repeats per SO70 (ESS-33). */
export const UC_SO72: RecordDef = {
  id: 'SO72',
  name: 'UcPgaComment',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 4, class: 'AN', designation: 'M', constant: 'SO72' },
    { name: 'commentsToTrade', start: 5, end: 80, class: 'X', designation: 'M' },
  ],
};

/**
 * E1 Disposition Type Codes (ESS-15, Note 1). Code 8 — a PSC presented by
 * another filer — is the ownership-change notification cross-referenced by
 * the AE chapter's 'PSC and Entry Summary "Ownership" Considerations'
 * (Entry Summary Filing — Usage Notes, section gg).
 */
export const UC_DISPOSITION_TYPE_CODES: Record<string, string> = {
  '1': 'Request for electronic invoice data only',
  '2': 'Request for the entry summary package',
  '3': 'Request for specific documents',
  '4': 'Entry summary rejected/PSC rejected',
  '5': 'ACE entry summary inactivated',
  '6': 'Entry summary canceled',
  '8': 'A Post Summary Correction (PSC) has been presented by another filer',
  P: 'PGA processing status information',
  Q: 'Quota status',
  E: 'TIB extension denied',
  R: 'A Post Summary Correction (PSC) filed was reverted',
  C: 'Detention cancelled',
  D: 'Detained',
};

/** E1 Notification Reason Codes for rejections, types 4/R (ESS-19, Note 2). */
export const UC_NOTIFICATION_REASON_CODES: Record<string, string> = {
  '001': 'ES Header Change Required',
  '002': 'Entry Type Change Required',
  '003': 'Classification',
  '004': 'Special Program Indicator',
  '005': 'Value - Line Value',
  '006': 'Value - Currency Conversion',
  '007': 'Line Change - Duty',
  '008': 'Line Change - Country of Origin',
  '009': 'Line Change - Country of Export',
  '010': 'AD/CVD Required',
  '011': 'AD/CVD - Cash Deposit Required',
  '012': 'AD/CVD - Scope Change',
  '013': 'AD/CVD - Non-Reimbursement Statement Missing',
  '014': 'Single Transaction Bond',
  '015': 'Continuous Bond',
  '016': 'Missing Invoice',
  '017': 'Insufficient Invoice Description',
  '018': 'OGA Certificate Required',
  '019': 'Visa Required',
  '020': 'Incorrect Fee',
  '021': 'Incorrect Tax',
  '022': 'Quota Issue',
  '023': 'Recon Reject',
  '998': 'Other',
};

/** E4 Quota Line Status Codes (ESS-26, Note 1). */
export const UC_QUOTA_LINE_STATUS_CODES: Record<string, string> = {
  Q01: 'Quota Processed / Accepted',
  Q02: 'Quota Apportioned',
  Q03: 'Quota Filled',
  Q04: 'Quota Filled or Expired',
  Q05: 'Banned Import',
  Q15: 'QTA Quantity must be > 0',
  Q17: 'Quota Line Pending > 10 days',
  Q25: 'Licenses Filled',
  Q26: 'License Expired',
  Q27: 'Licenses Processed / Accepted',
  Q28: 'License Line Pending > 10 days',
};

for (const def of [UC_E1, UC_E2, UC_E3, UC_E4, UC_SO70, UC_SO71, UC_SO72]) {
  assertRecordDef(def);
}
