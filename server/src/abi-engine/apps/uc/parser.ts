/**
 * Entry Summary Status Notification (UC) parser — V30 June 2025, ESS-14..33.
 *
 * UC is inbound-only (CBP → filer); there is no builder. A UC batch holds a
 * single block with a single notification grouping (ESS-14): one E1, then
 * conditionally an E2 (CBP user/action id), E3 remarks (≤7 records, ≤500
 * chars total), E4 quota-line statuses, and repeating SO70 PGA groupings
 * each with SO71 reviews and SO72 comments.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import {
  UC_E1,
  UC_E2,
  UC_E3,
  UC_E4,
  UC_SO70,
  UC_SO71,
  UC_SO72,
  UC_DISPOSITION_TYPE_CODES,
  UC_NOTIFICATION_REASON_CODES,
  UC_QUOTA_LINE_STATUS_CODES,
} from './recordDefs.js';

// ── Typed notification ─────────────────────────────────────

export interface UcCbpAction {
  cbpUser?: string;
  telephoneNumber?: string;
  telephoneExtension?: string;
  /** Equals the entry summary number; document-upload reference (E2 Note 4). */
  actionIdentificationNumber?: string;
}

export interface UcQuotaLine {
  /** Filer line id; CBP-added lines contain an asterisk. */
  lineItemIdentifier?: string;
  statusCode?: string;
  /** Narrative from the wire, falling back to the chapter's Note 1 table. */
  statusDescription?: string;
  /** Two implied decimals (hundredths). */
  requestedQuantityHundredths?: number;
  requestedUomCode?: string;
  reservedQuantityHundredths?: number;
  reservedUomCode?: string;
}

export interface UcPgaReview {
  referenceIdQualifier?: string;
  referenceIdNumber?: string;
  referenceIdReceiptDate?: string;
  referenceIdReceiptTime?: string;
  /** SO71 sub-reason codes 1-10, in wire order, empties dropped. */
  subReasonCodes: string[];
  referenceIdQualifier2?: string;
  referenceIdNumber2?: string;
}

export interface UcPgaGroup {
  agencyCode?: string;
  agencyProgramCode?: string;
  statusActionDate?: string;
  statusActionTime?: string;
  entryLevelStatusCode?: string;
  entryLevelStatusMessage?: string;
  lineLevelStatusCode?: string;
  statusReasonCode?: string;
  beginningCbpLine?: string;
  beginningTariffPosition?: string;
  /** '000' when a 1USG-only PGA reviewed without a message set (Note 9). */
  beginningPgaLine?: string;
  endingCbpLine?: string;
  endingTariffPosition?: string;
  endingPgaLine?: string;
  documentTypeCode?: string;
  /** 1 = hold set by CBP for the agency, 2 = set by the agency (Note 6). */
  entryHoldType?: string;
  processingGroupVersion?: string;
  reviews: UcPgaReview[];
  comments: string[];
}

export interface UcNotification {
  /**
   * E1 disposition type (Note 1): 1-3 document requests, 4 rejected,
   * 5 inactivated, 6 canceled, 8 PSC presented by another filer (the
   * ownership-change notification the AE chapter references), P PGA,
   * Q quota, E TIB extension denied, R PSC reverted, C detention
   * cancelled, D detained.
   */
  dispositionTypeCode: string;
  dispositionDescription?: string;
  /** True when created manually by a CBP user (source code 1). */
  manual: boolean;
  importSpecialistTeam?: string;
  notificationReasonCode?: string;
  notificationReasonDescription?: string;
  dateOfAction?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  lineItemIdentifier?: string;
  brokerReferenceNumber?: string;
  cbpAction?: UcCbpAction;
  /** E3 remarks concatenated in wire order (each record trimmed at end). */
  remarks?: string;
  quotaLines: UcQuotaLine[];
  pgaGroups: UcPgaGroup[];
}

// ── Parser ─────────────────────────────────────────────────

function num(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse the transaction lines of one UC notification block. Returns one
 * notification per E1-record (the spec sends a single grouping per batch,
 * but repeated groupings are tolerated).
 */
export function parseUcNotification(lines: string[]): UcNotification[] {
  const notifications: UcNotification[] = [];
  let current: UcNotification | null = null;
  let currentPga: UcPgaGroup | null = null;
  const remarks: string[] = [];

  const flushRemarks = () => {
    if (current && remarks.length > 0) {
      current.remarks = remarks.join('');
      remarks.length = 0;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.padEnd(80, ' ');
    const id2 = line.slice(0, 2);
    const id4 = line.slice(0, 4);

    if (id2 === 'E1') {
      flushRemarks();
      const v = parseRecord(UC_E1, line).values;
      const code = v.dispositionTypeCode ?? '';
      current = {
        dispositionTypeCode: code,
        dispositionDescription: UC_DISPOSITION_TYPE_CODES[code],
        manual: v.sourceOfActionCode === '1',
        importSpecialistTeam: v.importSpecialistTeam,
        notificationReasonCode: v.notificationReasonCode,
        notificationReasonDescription:
          v.notificationReasonCode !== undefined ? UC_NOTIFICATION_REASON_CODES[v.notificationReasonCode] : undefined,
        dateOfAction: v.dateOfAction,
        entryFilerCode: v.entryFilerCode,
        entryNumber: v.entryNumber,
        lineItemIdentifier: v.lineItemIdentifier,
        brokerReferenceNumber: v.brokerReferenceNumber,
        quotaLines: [],
        pgaGroups: [],
      };
      currentPga = null;
      notifications.push(current);
    } else if (id2 === 'E2' && current) {
      const v = parseRecord(UC_E2, line).values;
      // An automated-source E2 may be entirely blank (E2 Note 2).
      if (v.cbpUser || v.telephoneNumber || v.actionIdentificationNumber || v.telephoneExtensionNumber) {
        current.cbpAction = {
          cbpUser: v.cbpUser,
          telephoneNumber: v.telephoneNumber,
          telephoneExtension: v.telephoneExtensionNumber,
          actionIdentificationNumber: v.actionIdentificationNumber,
        };
      } else {
        current.cbpAction = {};
      }
    } else if (id2 === 'E3' && current) {
      const v = parseRecord(UC_E3, line).values;
      if (v.remarks !== undefined) remarks.push(v.remarks);
    } else if (id2 === 'E4' && current) {
      const v = parseRecord(UC_E4, line).values;
      const code = v.quotaLineStatusCode;
      current.quotaLines.push({
        lineItemIdentifier: v.lineItemIdentifier,
        statusCode: code,
        statusDescription: v.quotaLineStatusDescription ?? (code !== undefined ? UC_QUOTA_LINE_STATUS_CODES[code] : undefined),
        requestedQuantityHundredths: num(v.requestedQuotaQuantity),
        requestedUomCode: v.quotaRequestedUomCode,
        reservedQuantityHundredths: num(v.reservedQuotaQuantity),
        reservedUomCode: v.reservedQuotaUomCode,
      });
    } else if (id4 === 'SO70' && current) {
      const v = parseRecord(UC_SO70, line).values;
      currentPga = {
        agencyCode: v.governmentAgencyCode,
        agencyProgramCode: v.governmentAgencyProgramCode,
        statusActionDate: v.statusActionDate,
        statusActionTime: v.statusActionTime,
        entryLevelStatusCode: v.pgaEntryLevelStatusCode,
        entryLevelStatusMessage: v.pgaEntryLevelStatusMessage,
        lineLevelStatusCode: v.pgaLineLevelStatusCode,
        statusReasonCode: v.statusReasonCode,
        beginningCbpLine: v.beginningCbpLine,
        beginningTariffPosition: v.beginningTariffPosition,
        beginningPgaLine: v.beginningPgaLine,
        endingCbpLine: v.endingCbpLine,
        endingTariffPosition: v.endingTariffPosition,
        endingPgaLine: v.endingPgaLine,
        documentTypeCode: v.documentTypeCode,
        entryHoldType: v.pgaEntryHoldType,
        processingGroupVersion: v.pgaProcessingGroupVersion,
        reviews: [],
        comments: [],
      };
      current.pgaGroups.push(currentPga);
    } else if (id4 === 'SO71' && currentPga) {
      const v = parseRecord(UC_SO71, line).values;
      currentPga.reviews.push({
        referenceIdQualifier: v.referenceIdQualifier,
        referenceIdNumber: v.referenceIdNumber,
        referenceIdReceiptDate: v.referenceIdReceiptDate,
        referenceIdReceiptTime: v.referenceIdReceiptTime,
        subReasonCodes: [
          v.subReasonCode1,
          v.subReasonCode2,
          v.subReasonCode3,
          v.subReasonCode4,
          v.subReasonCode5,
          v.subReasonCode6,
          v.subReasonCode7,
          v.subReasonCode8,
          v.subReasonCode9,
          v.subReasonCode10,
        ].filter((c): c is string => c !== undefined),
        referenceIdQualifier2: v.referenceIdQualifier2,
        referenceIdNumber2: v.referenceIdNumber2,
      });
    } else if (id4 === 'SO72' && currentPga) {
      const v = parseRecord(UC_SO72, line).values;
      if (v.commentsToTrade !== undefined) currentPga.comments.push(v.commentsToTrade);
    }
    // Any other line (none are defined for UC) is ignored.
  }

  flushRemarks();
  return notifications;
}

export interface UcNotificationBatch {
  /** True when ACE flagged the batch at the envelope level. */
  batchRejected: boolean;
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  notifications: UcNotification[];
}

/** Parse a complete UC wire message (A/B…Y/Z envelope included). */
export function parseUcNotificationBatch(lines: string[]): UcNotificationBatch {
  const batch = parseBatch(lines);
  const notifications = batch.blocks.flatMap((b) => parseUcNotification(b.transactionLines));
  return { batchRejected: batch.rejected, envelopeConditions: batch.conditions, notifications };
}
