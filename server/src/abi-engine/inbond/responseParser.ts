/**
 * In-Bond response (QT), In-Bond Event response (WT) and Status
 * Notification (NS) parsers — CATAIR "In-Bond" chapter, Amendment 51,
 * April 2026 (INB-n page numbers in comments).
 *
 * QT (output usage map INB-15..17): each In-Bond Grouping opens with the
 * echoed QP10; the echoed input records come back as originally input,
 * each followed by up to 10 QT95 Error/Warning messages. A grouping-level
 * QT95 Accept/Reject closes each QP10 when the action was 'D' (Note 1A)
 * or each QP30 Bill of Lading Grouping when the action was 'A'/'B'
 * (Note 1B).
 *
 * WT (INB-17): WP10 and WP20 echoed with up to 10 WT95s each, closed by
 * one mandatory WT95 Accept/Reject.
 *
 * NS (INB-17..18): each notification begins with either NS05 (bill status
 * unrelated to a QP in-bond — returned to the nominated Customs Broker)
 * or NS10 (QP in-bond status), then NS30, optional NS40, ≤2 NS50 remarks
 * and ≤999 NS60 containers.
 *
 * EA/EB/EY/EZ (INB-69..72) are control-record / EDI-profile rejects
 * returned in QT and WT when the transmission structure is in error.
 */
import { parseRecord, type RecordDef } from '../records/codec.js';
import { parseBatch, type ParsedCondition } from '../envelope/batch.js';
import {
  QP10, QP20, QP30, QP32, QP33, QP40, QP50, QP51, QP52, QP55, QP56, QP57,
  QP60, QP61, QP62, QP65, QP70, QP71, QP72, QP75, QP76, QT95,
  WP10, WP20, WT95, NS05, NS10, NS30, NS40, NS50, NS60,
  NARRATIVE_MESSAGE_TYPES,
  IN_BOND_ENTRY_TYPES,
} from './recordDefs.js';

// ── Shared: QT95/WT95 messages and EA/EB/EY/EZ rejects ─────

export interface InbondMessage {
  /** 01 rejection | 02 acceptance | 03 acceptance with warning (INB-53). */
  typeCode: string;
  /** 3AN narrative message identifier. */
  messageId: string;
  narrative: string;
  /** Meaning from the narrative-message-type table, when known. */
  meaning?: string;
  accepted: boolean;
}

function parseMessage(def: RecordDef, line: string): InbondMessage {
  const rec = parseRecord(def, line);
  const typeCode = rec.values.narrativeMessageTypeCode ?? '';
  return {
    typeCode,
    messageId: rec.values.narrativeMessageId ?? '',
    narrative: rec.values.narrativeMessage ?? '',
    meaning: NARRATIVE_MESSAGE_TYPES[typeCode],
    accepted: typeCode === '02' || typeCode === '03',
  };
}

export interface InbondStructureReject {
  /** EA transaction header | EB block header | EY block trailer | EZ transaction trailer. */
  recordId: 'EA' | 'EB' | 'EY' | 'EZ';
  narrative: string;
}

/**
 * Detect EA/EB/EY/EZ control-record and EDI-profile reject lines
 * (INB-69..72). The narrative occupies positions 3-42.
 */
export function parseInbondStructureRejects(lines: string[]): InbondStructureReject[] {
  const rejects: InbondStructureReject[] = [];
  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === 'EA' || id === 'EB' || id === 'EY' || id === 'EZ') {
      rejects.push({ recordId: id, narrative: line.slice(2, 42).trimEnd() });
    }
  }
  return rejects;
}

export interface InbondEchoedRecord {
  /** Chapter record name, e.g. 'QP30' (wire lines carry only the 2-digit type). */
  recordId: string;
  raw: string;
  /** Field values parsed with the input record def. */
  values: Record<string, string>;
  /** QT95/WT95 messages that followed this record (≤10, INB-15). */
  messages: InbondMessage[];
}

// ── QT response ────────────────────────────────────────────

/** Echoed input defs by wire record type, labeled with chapter names. */
const QT_ECHO_DEFS: Record<string, { name: string; def: RecordDef }> = {
  '10': { name: 'QP10', def: QP10 },
  '20': { name: 'QP20', def: QP20 },
  '30': { name: 'QP30', def: QP30 },
  '32': { name: 'QP32', def: QP32 },
  '33': { name: 'QP33', def: QP33 },
  '40': { name: 'QP40', def: QP40 },
  '50': { name: 'QP50', def: QP50 },
  '51': { name: 'QP51', def: QP51 },
  '52': { name: 'QP52', def: QP52 },
  '55': { name: 'QP55', def: QP55 },
  '56': { name: 'QP56', def: QP56 },
  '57': { name: 'QP57', def: QP57 },
  '60': { name: 'QP60', def: QP60 },
  '61': { name: 'QP61', def: QP61 },
  '62': { name: 'QP62', def: QP62 },
  '65': { name: 'QP65', def: QP65 },
  '70': { name: 'QP70', def: QP70 },
  '71': { name: 'QP71', def: QP71 },
  '72': { name: 'QP72', def: QP72 },
  '75': { name: 'QP75', def: QP75 },
  '76': { name: 'QP76', def: QP76 },
};

export interface InbondBillResult {
  issuerCode?: string;
  billNumber?: string;
  /** Echoed from the QP30 input when provided (INB-26). */
  sequenceNumber?: string;
  /** QP30 and any echoed bill-level records, in wire order. */
  echoedRecords: InbondEchoedRecord[];
  /** Grouping-level Accept/Reject: the last QT95 in the bill grouping (Note 1B, INB-17). */
  disposition?: InbondMessage;
  accepted: boolean;
}

export interface InbondResponse {
  /** A / B / D from the echoed QP10. */
  actionCode?: string;
  inBondNumber?: string;
  entryType?: string;
  /** Meaning from the entry-type table, when known. */
  entryTypeMeaning?: string;
  /** Echoed QP10/QP20 header records with attached messages. */
  headerRecords: InbondEchoedRecord[];
  /** Bill of Lading Groupings (absent for a whole-in-bond delete). */
  bills: InbondBillResult[];
  /**
   * Grouping-level Accept/Reject following the QP10 when the action was
   * 'D' (Note 1A, INB-17); for 'A'/'B' the dispositions live on the bills.
   */
  disposition?: InbondMessage;
  /** True when every disposition is 02/03 and no 01 message appears. */
  accepted: boolean;
}

/**
 * Parse the transaction lines of a QT response block into per-in-bond
 * results. Each echoed QP10 starts a new In-Bond Grouping (≤999 per
 * block, INB-15); each echoed QP30 starts a Bill of Lading Grouping.
 */
export function parseInbondResponse(lines: string[]): InbondResponse[] {
  const responses: InbondResponse[] = [];
  let current: InbondResponse | null = null;
  let currentBill: InbondBillResult | null = null;
  let lastRecord: InbondEchoedRecord | null = null;

  const finalizeBill = () => {
    if (!currentBill) return;
    // The bill grouping's Accept/Reject is the LAST QT95 within it
    // (Note 1B); earlier QT95s are record-level errors/warnings.
    let disposition: InbondMessage | undefined;
    for (const rec of currentBill.echoedRecords) {
      for (const msg of rec.messages) disposition = msg;
    }
    currentBill.disposition = disposition;
    currentBill.accepted =
      disposition !== undefined &&
      disposition.accepted &&
      currentBill.echoedRecords.every((r) => r.messages.every((m) => m.typeCode !== '01'));
    currentBill = null;
  };

  const finalizeResponse = () => {
    if (!current) return;
    finalizeBill();
    if (current.bills.length === 0) {
      // Whole-in-bond delete: Accept/Reject follows the QP10 (Note 1A).
      let disposition: InbondMessage | undefined;
      for (const rec of current.headerRecords) {
        for (const msg of rec.messages) disposition = msg;
      }
      current.disposition = disposition;
      current.accepted =
        disposition !== undefined &&
        disposition.accepted &&
        current.headerRecords.every((r) => r.messages.every((m) => m.typeCode !== '01'));
    } else {
      current.accepted =
        current.bills.every((b) => b.accepted) &&
        current.headerRecords.every((r) => r.messages.every((m) => m.typeCode !== '01'));
    }
    current = null;
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === '95') {
      const message = parseMessage(QT95, line);
      if (lastRecord) lastRecord.messages.push(message);
      continue;
    }
    const echo = QT_ECHO_DEFS[id];
    if (!echo) continue; // envelope and unknown lines are ignored

    const rec = parseRecord(echo.def, line);
    lastRecord = { recordId: echo.name, raw: line.padEnd(80, ' '), values: rec.values, messages: [] };

    if (id === '10') {
      finalizeResponse();
      current = {
        actionCode: rec.values.actionCode,
        inBondNumber: rec.values.inBondNumber,
        entryType: rec.values.inBondEntryType,
        entryTypeMeaning: IN_BOND_ENTRY_TYPES[rec.values.inBondEntryType ?? ''],
        headerRecords: [lastRecord],
        bills: [],
        accepted: false,
      };
      responses.push(current);
    } else if (id === '20' && currentBill === null) {
      current?.headerRecords.push(lastRecord);
    } else if (id === '30') {
      finalizeBill();
      currentBill = {
        issuerCode: rec.values.billIssuerCode,
        billNumber: rec.values.billNumber,
        sequenceNumber: rec.values.sequenceNumber,
        echoedRecords: [lastRecord],
        accepted: false,
      };
      current?.bills.push(currentBill);
    } else if (currentBill) {
      currentBill.echoedRecords.push(lastRecord);
    } else {
      current?.headerRecords.push(lastRecord);
    }
  }
  finalizeResponse();
  return responses;
}

export interface InbondResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ParsedCondition[];
  /** EA/EB/EY/EZ control-record / EDI-profile rejects (INB-69..72). */
  structureRejects: InbondStructureReject[];
  inBonds: InbondResponse[];
}

/** Parse a complete QT wire response (A/B…Y/Z envelope included). */
export function parseInbondResponseBatch(lines: string[]): InbondResponseBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    structureRejects: parseInbondStructureRejects(lines),
    inBonds: batch.blocks.flatMap((b) => parseInbondResponse(b.transactionLines)),
  };
}

// ── WT response ────────────────────────────────────────────

export interface InbondEventResponse {
  /** WP action code from the echoed WP10. */
  actionCode?: string;
  /** Meaning from the WP action-code table is intentionally not repeated here; see WP_ACTION_CODES. */
  inBondNumber?: string;
  billIssuerCode?: string;
  billNumber?: string;
  containerNumber?: string;
  /** Echoed WP10/WP20 with attached WT95s. */
  echoedRecords: InbondEchoedRecord[];
  /** The mandatory closing WT95 Accept/Reject (INB-17). */
  disposition?: InbondMessage;
  accepted: boolean;
}

/**
 * Parse the transaction lines of a WT response block. Each echoed WP10
 * starts a new In-bond Event Grouping (INB-17 Note 2); the last WT95 of
 * the grouping is its Accept/Reject.
 */
export function parseInbondEventResponse(lines: string[]): InbondEventResponse[] {
  const responses: InbondEventResponse[] = [];
  let current: InbondEventResponse | null = null;
  let lastRecord: InbondEchoedRecord | null = null;

  const finalize = () => {
    if (!current) return;
    let disposition: InbondMessage | undefined;
    for (const rec of current.echoedRecords) {
      for (const msg of rec.messages) disposition = msg;
    }
    current.disposition = disposition;
    current.accepted =
      disposition !== undefined &&
      disposition.accepted &&
      current.echoedRecords.every((r) => r.messages.every((m) => m.typeCode !== '01'));
    current = null;
  };

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === '95') {
      const message = parseMessage(WT95, line);
      if (lastRecord) lastRecord.messages.push(message);
      continue;
    }
    if (id === '10') {
      finalize();
      const rec = parseRecord(WP10, line);
      lastRecord = { recordId: 'WP10', raw: line.padEnd(80, ' '), values: rec.values, messages: [] };
      current = {
        actionCode: rec.values.actionCode,
        inBondNumber: rec.values.inBondNumber,
        billIssuerCode: rec.values.billIssuerCode,
        billNumber: rec.values.billNumber,
        containerNumber: rec.values.containerNumber,
        echoedRecords: [lastRecord],
        accepted: false,
      };
      responses.push(current);
    } else if (id === '20') {
      const rec = parseRecord(WP20, line);
      lastRecord = { recordId: 'WP20', raw: line.padEnd(80, ' '), values: rec.values, messages: [] };
      current?.echoedRecords.push(lastRecord);
    }
  }
  finalize();
  return responses;
}

export interface InbondEventResponseBatch {
  batchRejected: boolean;
  envelopeConditions: ParsedCondition[];
  structureRejects: InbondStructureReject[];
  events: InbondEventResponse[];
}

/** Parse a complete WT wire response (A/B…Y/Z envelope included). */
export function parseInbondEventResponseBatch(lines: string[]): InbondEventResponseBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    structureRejects: parseInbondStructureRejects(lines),
    events: batch.blocks.flatMap((b) => parseInbondEventResponse(b.transactionLines)),
  };
}

// ── NS status notification ─────────────────────────────────

/** NS05 header — bill status unrelated to a QP in-bond (INB-60). */
export interface InbondStatusConveyanceHeader {
  kind: 'conveyance';
  conveyanceName: string;
  voyageTripNumber?: string;
  /** Schedule D district/port of arrival. */
  port?: string;
  /** YYMMDD. */
  estimatedDateOfArrival?: string;
  /** HHMMSS, Eastern time. */
  estimatedTimeOfArrival?: string;
}

/** NS10 header — status for a QP in-bond (INB-61). */
export interface InbondStatusInbondHeader {
  kind: 'inbond';
  entryType: string;
  entryTypeMeaning?: string;
  inBondNumber: string;
  usPortOfDestination?: string;
  /** Schedule K; space filled for IT 61 (Note 1, INB-61). */
  foreignDestination?: string;
}

export interface InbondStatusContainer {
  /** True when the NS30 disposition is a container-level action against this container (INB-68). */
  actionTakenAgainstContainer: boolean;
  containerNumber?: string;
  sealNumber1?: string;
  sealNumber2?: string;
}

export interface InbondStatusNotification {
  header?: InbondStatusConveyanceHeader | InbondStatusInbondHeader;
  /** NS30 disposition code (ACE Ocean Appendix D / Air Appendix A). */
  dispositionCode?: string;
  billIssuerCode?: string;
  billNumber?: string;
  /** Pieces affected by the disposition action. */
  quantity?: string;
  /** True when the NS30 negative indicator is N (dispositions 1A/1B/1C). */
  negative: boolean;
  /** YYMMDD. */
  actionDate?: string;
  /** HHMM, Eastern time. */
  actionTime?: string;
  inBondCarrierCode?: string;
  /** NS40 continuation, when returned (INB-66). */
  detail?: {
    entryType?: string;
    entryNumber?: string;
    port?: string;
    firmsCode?: string;
    /** Populated only for container-level notifications (Note 1, INB-66). */
    containerNumber?: string;
  };
  /** True when the NS40 carries a container number (Note 1, INB-66). */
  containerLevel: boolean;
  /** NS50 remarks (≤2 per NS30, INB-67). */
  remarks: string[];
  /** NS60 containers (≤999 per NS30, INB-68). */
  containers: InbondStatusContainer[];
}

/**
 * Parse the transaction lines of an NS block. Each notification begins
 * with either the NS05 or the NS10 header record (Note 4, INB-17..18).
 */
export function parseInbondStatus(lines: string[]): InbondStatusNotification[] {
  const notifications: InbondStatusNotification[] = [];
  let current: InbondStatusNotification | null = null;

  const start = (header?: InbondStatusNotification['header']): InbondStatusNotification => {
    current = { header, negative: false, containerLevel: false, remarks: [], containers: [] };
    notifications.push(current);
    return current;
  };
  const ensureCurrent = (): InbondStatusNotification => current ?? start();

  for (const line of lines) {
    const id = line.slice(0, 2);
    if (id === '05') {
      const rec = parseRecord(NS05, line);
      start({
        kind: 'conveyance',
        conveyanceName: rec.values.conveyanceName ?? '',
        voyageTripNumber: rec.values.voyageTripNumber,
        port: rec.values.districtPort,
        estimatedDateOfArrival: rec.values.estimatedDateOfArrival,
        estimatedTimeOfArrival: rec.values.estimatedTimeOfArrival,
      });
    } else if (id === '10') {
      const rec = parseRecord(NS10, line);
      start({
        kind: 'inbond',
        entryType: rec.values.inBondEntryType ?? '',
        entryTypeMeaning: IN_BOND_ENTRY_TYPES[rec.values.inBondEntryType ?? ''],
        inBondNumber: rec.values.inBondNumber ?? '',
        usPortOfDestination: rec.values.usPortOfDestination,
        foreignDestination: rec.values.foreignDestination,
      });
    } else if (id === '30') {
      const rec = parseRecord(NS30, line);
      const n = ensureCurrent();
      n.dispositionCode = rec.values.dispositionCode;
      n.billIssuerCode = rec.values.billIssuerCode;
      n.billNumber = rec.values.billNumber;
      n.quantity = rec.values.quantity;
      n.negative = rec.values.negativeIndicator === 'N';
      n.actionDate = rec.values.actionDate;
      n.actionTime = rec.values.actionTime;
      n.inBondCarrierCode = rec.values.inBondCarrierCode;
    } else if (id === '40') {
      const rec = parseRecord(NS40, line);
      const n = ensureCurrent();
      n.detail = {
        entryType: rec.values.entryType,
        entryNumber: rec.values.entryNumber,
        port: rec.values.districtPortOfTransaction,
        firmsCode: rec.values.firmsCode,
        containerNumber: rec.values.containerNumber,
      };
      n.containerLevel = rec.values.containerNumber !== undefined;
    } else if (id === '50') {
      const rec = parseRecord(NS50, line);
      ensureCurrent().remarks.push(rec.values.remarks ?? '');
    } else if (id === '60') {
      const rec = parseRecord(NS60, line);
      ensureCurrent().containers.push({
        actionTakenAgainstContainer: rec.values.actionIndicator === '1',
        containerNumber: rec.values.containerNumber,
        sealNumber1: rec.values.sealNumber1,
        sealNumber2: rec.values.sealNumber2,
      });
    }
  }
  return notifications;
}

export interface InbondStatusBatch {
  batchRejected: boolean;
  envelopeConditions: ParsedCondition[];
  notifications: InbondStatusNotification[];
}

/** Parse a complete NS wire notification (A/B…Y/Z envelope included). */
export function parseInbondStatusBatch(lines: string[]): InbondStatusBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    notifications: batch.blocks.flatMap((b) => parseInbondStatus(b.transactionLines)),
  };
}
