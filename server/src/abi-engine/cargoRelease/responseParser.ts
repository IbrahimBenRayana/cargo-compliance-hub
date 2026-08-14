/**
 * ACE Cargo Release response (SX) and Status Notification (SO) parsers.
 *
 * SX response (CR chapter v40, output usage map CR p.28-29 / SE-26..27):
 * within a response block each transaction opens with the echoed SE10.
 * "The Output transaction will always return the SE10 and SE15 records,
 * as well as any record on which an error occurs. Each record that has
 * an error will be followed by one or more SE90 error record… A final
 * transaction-level SE90 record is returned at the end of the
 * transaction indicating the overall acceptance or rejection" (CR p.20,
 * SE-18). Record-level SE90s carry message types 11/13 (≤9 per record);
 * the transaction-level SE90 carries types 01/02/03/04 (CR p.85, SE-83).
 *
 * SO status notification (SO chapter rev 36, usage map SO p.20 / SO-30):
 * each notification opens with the SO10 status header, followed by SO20
 * references (CR/RSN/CMT/RRN), SO30 line items, Bill of Lading
 * Information Groupings (SO40 ×≤2 [M+H], SO42 in-bond legs ×≤99, one
 * SO50 bill-match disposition), SO60 release dispositions ×≤999, and PGA
 * Processing Groupings (SO70 + SO71 ×≤99 + SO72 ×≤99).
 *
 * SO70 line-range fields are version-aware: the rev-36 printed layout
 * carries the PGA Processing Group Version 04 sizes (CBP Line 3N, Tariff
 * Position 2N), while records tagged space/01/02/03 in positions 79-80 —
 * including the chapter's own printed Note-8 examples (SO p.35) — use
 * the pre-04 sizes (CBP Line 4N, Tariff Position 1N) over the same
 * 57-72 span, parsed here with SO70_PRE04.
 */
import { parseRecord, type RecordDef } from '../records/codec.js';
import { parseBatch, type ParsedCondition } from '../envelope/batch.js';
import {
  SE10, SE11, SE13, SE15, SE16, SE17, SE20, SE30, SE31, SE35, SE36,
  SE40, SE41, SE50, SE51, SE55, SE56, SE60, SE61, SE90,
  SO10, SO20, SO30, SO40, SO42, SO50, SO60, SO70, SO70_PRE04, SO71, SO72,
  SE90_MESSAGE_TYPES,
  SO20_REFERENCE_QUALIFIERS,
  SO20_RSN_REASON_CODES,
  SO50_DISPOSITION_CODES,
  SO60_DISPOSITION_CODES,
  RELEASE_ORIGIN_CODES,
} from './recordDefs.js';

// ── SX response ────────────────────────────────────────────

export interface SeRecordError {
  /** 11 = Record Rejected, 13 = Record Accepted with a Warning (CR p.85). */
  messageTypeCode: string;
  /** Cargo Release Condition Code (message identifier). */
  errorCode?: string;
  narrative: string;
}

export interface SeEchoedRecord {
  /** Control identifier of the echoed input record, e.g. 'SE15'. */
  recordId: string;
  raw: string;
  /** Field values parsed with the input record def. */
  values: Record<string, string>;
  /** Record-level SE90s (types 11/13, ≤9) that followed this record. */
  errors: SeRecordError[];
}

export interface SeDisposition {
  /** 01 rejected | 02 accepted | 03 accepted with warning(s) | 04 referred to human review. */
  messageTypeCode: string;
  accepted: boolean;
  errorCode?: string;
  narrative: string;
  /** Meaning from the SE90 message-type table. */
  meaning?: string;
}

export interface CargoReleaseResponse {
  /** From the echoed SE10. */
  actionCode?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  entryType?: string;
  /** Echoed submission records in wire order, with attached errors. */
  echoedRecords: SeEchoedRecord[];
  /** Record-level SE90s seen before any echoed record (should not occur). */
  unattachedErrors: SeRecordError[];
  /** Final transaction-level SE90 (types 01/02/03/04) — the filing disposition. */
  disposition?: SeDisposition;
  /** True when the disposition message type is 02 or 03. */
  accepted: boolean;
}

const ECHOED_RECORD_DEFS: Record<string, RecordDef> = {
  SE10, SE11, SE13, SE15, SE16, SE17, SE20, SE30, SE31, SE35, SE36,
  SE40, SE41, SE50, SE51, SE55, SE56, SE60, SE61,
};

/**
 * Parse the SE lines of an SX response block into per-transaction
 * results. Each echoed SE10 starts a new SE Header Grouping (≤999 per
 * block, CR p.28); the transaction-level SE90 closes it. Echoed PGA
 * lines (OI/PG…) are not SE records and are skipped.
 */
export function parseCargoReleaseResponse(lines: string[]): CargoReleaseResponse[] {
  const responses: CargoReleaseResponse[] = [];
  let current: CargoReleaseResponse | null = null;
  let lastRecord: SeEchoedRecord | null = null;

  const ensureCurrent = (): CargoReleaseResponse => {
    if (!current) {
      current = { echoedRecords: [], unattachedErrors: [], accepted: false };
      responses.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 4);
    if (id === 'SE90') {
      const rec = parseRecord(SE90, line);
      const messageTypeCode = rec.values.messageTypeCode ?? '';
      if (messageTypeCode === '11' || messageTypeCode === '13') {
        const error: SeRecordError = {
          messageTypeCode,
          errorCode: rec.values.messageIdentifierCode,
          narrative: rec.values.narrativeMessageText ?? '',
        };
        if (lastRecord) lastRecord.errors.push(error);
        else ensureCurrent().unattachedErrors.push(error);
      } else {
        // Transaction-level SE90 (01/02/03/04) — the filing disposition
        // (CR p.20/29). It closes the transaction; a following SE10
        // starts a new one.
        const response = ensureCurrent();
        response.disposition = {
          messageTypeCode,
          accepted: messageTypeCode === '02' || messageTypeCode === '03',
          errorCode: rec.values.messageIdentifierCode,
          narrative: rec.values.narrativeMessageText ?? '',
          meaning: SE90_MESSAGE_TYPES[messageTypeCode],
        };
        response.accepted = response.disposition.accepted;
        lastRecord = null;
      }
      continue;
    }

    const def = ECHOED_RECORD_DEFS[id];
    if (!def) continue; // envelope, PGA and unknown lines are skipped
    const rec = parseRecord(def, line);
    lastRecord = { recordId: id, raw: line.padEnd(80, ' '), values: rec.values, errors: [] };
    if (id === 'SE10') {
      current = {
        actionCode: rec.values.actionCode,
        entryFilerCode: rec.values.entryFilerCode,
        entryNumber: rec.values.entryNumber,
        entryType: rec.values.entryType,
        echoedRecords: [lastRecord],
        unattachedErrors: [],
        accepted: false,
      };
      responses.push(current);
    } else {
      ensureCurrent().echoedRecords.push(lastRecord);
    }
  }

  return responses;
}

export interface CargoReleaseResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ParsedCondition[];
  transactions: CargoReleaseResponse[];
}

/** Parse a complete SX wire response (A/B…Y/Z envelope included). */
export function parseCargoReleaseResponseBatch(lines: string[]): CargoReleaseResponseBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    transactions: batch.blocks.flatMap((b) => parseCargoReleaseResponse(b.transactionLines)),
  };
}

// ── SO status notification ─────────────────────────────────

export interface SoReference {
  /** CR / RSN / CMT / RRN (SO p.23 Note 1). */
  qualifier: string;
  value: string;
  /** Qualifier meaning, plus the RSN reason meaning when applicable. */
  meaning?: string;
}

export interface SoLine {
  lineNumber: string;
  countryOfOrigin?: string;
  htsNumber?: string;
}

export interface SoBill {
  /** R / M / H / S (future) / T (SO p.26). */
  billType: string;
  issuerCode?: string;
  billNumber: string;
  /** Entered quantity (boarded quantity for split air bills, Note 1). */
  quantity?: string;
  unitOfMeasure?: string;
  manifestedQuantity?: string;
}

export interface SoInBondLeg {
  inBondNumber: string;
  entryType?: string;
  portOfDeparture?: string;
  portOfArrival?: string;
  /** MMDDYY. */
  createDate?: string;
  /** MMDDYY. */
  arrivalDate?: string;
  /** Only present when less than the full bill quantity (SO p.27). */
  quantity?: string;
}

export interface SoBillMatch {
  /** MMDDYY. */
  date: string;
  /** HHMM. */
  time: string;
  /** 91-95 / 51-59 / 61-63 / 74 (SO p.29 Note 1). */
  dispositionCode: string;
  narrative: string;
  meaning?: string;
  split: boolean;
  /** Populated only for split or partial shipments (Note 2). */
  carrierCode?: string;
  voyageFlightTrip?: string;
  dateOfArrival?: string;
  portOfArrival?: string;
}

/** One Bill of Lading Information Grouping (SO40 ×≤2 + SO42 ×≤99 + SO50). */
export interface SoBillGroupingStatus {
  /** 1-2 SO40 records (a Master and its House bill arrive as a pair). */
  bills: SoBill[];
  /** SO42 in-bond legs associated with the bill(s). */
  inBonds: SoInBondLeg[];
  /** The grouping's SO50 bill-match disposition. */
  match?: SoBillMatch;
}

export interface SoReleaseDisposition {
  /** MMDDYY. */
  date: string;
  /** HHMM. */
  time: string;
  /** SO60 Note 1 codes, incl. 98 RELEASED / 01 ONEUSG. */
  code: string;
  narrative: string;
  meaning?: string;
  /** MMDDYY — only returned when the code is 22 or 98. */
  releaseDate?: string;
  /** Only returned when the code is 22 or 98 (SO p.32 Note 2). */
  releaseOrigin?: { code: string; meaning?: string };
  documentType?: string;
}

export interface SoPgaDetail {
  referenceQualifier?: string;
  referenceNumber?: string;
  /** MMDDYY. */
  receiptDate?: string;
  /** HHMMSS. */
  receiptTime?: string;
  /** The ten PGA Line Sub Reason Code slots, populated ones only, in order. */
  subReasonCodes: string[];
  /** Second reference pair (≥ group version 03) for identifiers > 12X. */
  secondReferenceQualifier?: string;
  secondReferenceNumber?: string;
}

export interface SoPgaStatus {
  agencyCode: string;
  programCode?: string;
  /** MMDDYY. */
  statusActionDate?: string;
  /** HHMM — compare when duplicate statuses arrive (SO p.35 Note 8). */
  statusActionTime?: string;
  entryLevelStatusCode?: string;
  entryLevelStatusMessage?: string;
  lineLevelStatusCode?: string;
  statusReasonCode?: string;
  beginningCbpLine?: string;
  beginningTariffPosition?: string;
  /** '000' when a PGA participates in 1USG without a message set (Note 9). */
  beginningPgaLine?: string;
  endingCbpLine?: string;
  endingTariffPosition?: string;
  endingPgaLine?: string;
  documentTypeCode?: string;
  /** 1 = set by CBP for the agency, 2 = set by the agency (Note 6). */
  entryHoldType?: string;
  /** Space/01/02/03/04 — layout version of the SO70/71/72 grouping (Note 7). */
  processingGroupVersion?: string;
  /** SO71 records for this SO70 (≤99). */
  details: SoPgaDetail[];
  /** SO72 comments to trade (≤99). */
  comments: string[];
}

export interface CargoReleaseStatusNotification {
  /** From the SO10 header. */
  portOfEntry?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  entryType?: string;
  importerOfRecordNumber?: string;
  carrierCode?: string;
  vesselName?: string;
  voyageFlightTrip?: string;
  /** MMDDYY. */
  estimatedDateOfArrival?: string;
  splitShipmentReleaseCode?: string;
  /** True when the SO is a response to a PGA CA (correction) request ('P'). */
  correctionResponse: boolean;
  references: SoReference[];
  lines: SoLine[];
  billGroupings: SoBillGroupingStatus[];
  releaseDispositions: SoReleaseDisposition[];
  pgaStatuses: SoPgaStatus[];
}

function referenceMeaning(qualifier: string, value: string): string | undefined {
  const base = SO20_REFERENCE_QUALIFIERS[qualifier];
  if (qualifier === 'RSN') {
    const reason = SO20_RSN_REASON_CODES[value.trim()];
    return reason ?? base;
  }
  return base;
}

/** Pre-04 PGA Processing Group versions (SO p.35 Note 7). */
function isPre04Version(version: string | undefined): boolean {
  return version === undefined || version === '01' || version === '02' || version === '03';
}

/**
 * Parse the SO lines of a status-notification block. Each SO10 starts a
 * new notification (usage map, SO p.20).
 */
export function parseCargoReleaseStatus(lines: string[]): CargoReleaseStatusNotification[] {
  const notifications: CargoReleaseStatusNotification[] = [];
  let current: CargoReleaseStatusNotification | null = null;
  let currentBillGrouping: SoBillGroupingStatus | null = null;
  let currentPga: SoPgaStatus | null = null;

  const ensureCurrent = (): CargoReleaseStatusNotification => {
    if (!current) {
      current = {
        correctionResponse: false,
        references: [],
        lines: [],
        billGroupings: [],
        releaseDispositions: [],
        pgaStatuses: [],
      };
      notifications.push(current);
    }
    return current;
  };

  for (const line of lines) {
    const id = line.slice(0, 4);
    if (id === 'SO10') {
      const rec = parseRecord(SO10, line);
      current = {
        portOfEntry: rec.values.districtPortOfEntry,
        entryFilerCode: rec.values.entryFilerCode,
        entryNumber: rec.values.entryNumber,
        entryType: rec.values.entryTypeCode,
        importerOfRecordNumber: rec.values.importerOfRecordNumber,
        carrierCode: rec.values.carrierCode,
        vesselName: rec.values.vesselName,
        voyageFlightTrip: rec.values.voyageFlightTripNumber,
        estimatedDateOfArrival: rec.values.estimatedDateOfArrival,
        splitShipmentReleaseCode: rec.values.splitShipmentReleaseCode,
        correctionResponse: rec.values.correctionResponseIndicator === 'P',
        references: [],
        lines: [],
        billGroupings: [],
        releaseDispositions: [],
        pgaStatuses: [],
      };
      notifications.push(current);
      currentBillGrouping = null;
      currentPga = null;
    } else if (id === 'SO20') {
      const rec = parseRecord(SO20, line);
      const qualifier = rec.values.referenceIdentifierQualifier ?? '';
      const value = rec.values.referenceIdentifier ?? '';
      ensureCurrent().references.push({ qualifier, value, meaning: referenceMeaning(qualifier, value) });
    } else if (id === 'SO30') {
      const rec = parseRecord(SO30, line);
      ensureCurrent().lines.push({
        lineNumber: rec.values.lineItemIdentifier ?? '',
        countryOfOrigin: rec.values.countryOfOrigin,
        htsNumber: rec.values.htsNumber,
      });
    } else if (id === 'SO40') {
      const rec = parseRecord(SO40, line);
      const bill: SoBill = {
        billType: rec.values.billTypeIndicator ?? '',
        issuerCode: rec.values.billIssuerCode,
        billNumber: rec.values.billOfLadingNumber ?? '',
        quantity: rec.values.quantity,
        unitOfMeasure: rec.values.unitOfMeasure,
        manifestedQuantity: rec.values.manifestedQuantity,
      };
      // SO40 max use is 2 per grouping (a Master + House pair); an SO42
      // or SO50 closes the run of SO40s (usage map, SO p.20).
      if (
        currentBillGrouping &&
        currentBillGrouping.bills.length < 2 &&
        currentBillGrouping.inBonds.length === 0 &&
        !currentBillGrouping.match
      ) {
        currentBillGrouping.bills.push(bill);
      } else {
        currentBillGrouping = { bills: [bill], inBonds: [] };
        ensureCurrent().billGroupings.push(currentBillGrouping);
      }
    } else if (id === 'SO42') {
      const rec = parseRecord(SO42, line);
      const leg: SoInBondLeg = {
        inBondNumber: rec.values.inBondNumber ?? '',
        entryType: rec.values.inBondEntryType,
        portOfDeparture: rec.values.portOfInBondDeparture,
        portOfArrival: rec.values.portOfInBondArrival,
        createDate: rec.values.inBondCreateDate,
        arrivalDate: rec.values.dateOfInBondArrival,
        quantity: rec.values.inBondQuantity,
      };
      if (!currentBillGrouping) {
        currentBillGrouping = { bills: [], inBonds: [] };
        ensureCurrent().billGroupings.push(currentBillGrouping);
      }
      currentBillGrouping.inBonds.push(leg);
    } else if (id === 'SO50') {
      const rec = parseRecord(SO50, line);
      const dispositionCode = rec.values.dispositionCode ?? '';
      const match: SoBillMatch = {
        date: rec.values.dispositionDate ?? '',
        time: rec.values.dispositionTime ?? '',
        dispositionCode,
        narrative: rec.values.narrativeMessage ?? '',
        meaning: SO50_DISPOSITION_CODES[dispositionCode],
        split: rec.values.splitIndicator === 'Y',
        carrierCode: rec.values.carrierCode,
        voyageFlightTrip: rec.values.voyageFlightTripNumber,
        dateOfArrival: rec.values.dateOfArrival,
        portOfArrival: rec.values.districtPortOfArrival,
      };
      if (!currentBillGrouping) {
        currentBillGrouping = { bills: [], inBonds: [] };
        ensureCurrent().billGroupings.push(currentBillGrouping);
      }
      currentBillGrouping.match = match;
      currentBillGrouping = null; // SO50 closes the grouping (map: M 1)
    } else if (id === 'SO60') {
      const rec = parseRecord(SO60, line);
      const code = rec.values.dispositionActionCode ?? '';
      const originCode = rec.values.releaseOriginCode;
      ensureCurrent().releaseDispositions.push({
        date: rec.values.dispositionActionDate ?? '',
        time: rec.values.dispositionActionTime ?? '',
        code,
        narrative: rec.values.narrativeMessage ?? '',
        meaning: SO60_DISPOSITION_CODES[code],
        releaseDate: rec.values.releaseDate,
        releaseOrigin: originCode === undefined ? undefined : { code: originCode, meaning: RELEASE_ORIGIN_CODES[originCode.replace(/^0/, '')] ?? RELEASE_ORIGIN_CODES[originCode] },
        documentType: rec.values.documentType,
      });
    } else if (id === 'SO70') {
      // Version-aware line-range parsing (see module header).
      let rec = parseRecord(SO70, line);
      if (isPre04Version(rec.values.pgaProcessingGroupVersion)) {
        rec = parseRecord(SO70_PRE04, line);
      }
      currentPga = {
        agencyCode: rec.values.governmentAgencyCode ?? '',
        programCode: rec.values.governmentAgencyProgramCode,
        statusActionDate: rec.values.statusActionDate,
        statusActionTime: rec.values.statusActionTime,
        entryLevelStatusCode: rec.values.entryLevelStatusCode,
        entryLevelStatusMessage: rec.values.entryLevelStatusMessage,
        lineLevelStatusCode: rec.values.lineLevelStatusCode,
        statusReasonCode: rec.values.statusReasonCode,
        beginningCbpLine: rec.values.beginningCbpLine,
        beginningTariffPosition: rec.values.beginningTariffPosition,
        beginningPgaLine: rec.values.beginningPgaLine,
        endingCbpLine: rec.values.endingCbpLine,
        endingTariffPosition: rec.values.endingTariffPosition,
        endingPgaLine: rec.values.endingPgaLine,
        documentTypeCode: rec.values.documentTypeCode,
        entryHoldType: rec.values.pgaEntryHoldType,
        processingGroupVersion: rec.values.pgaProcessingGroupVersion,
        details: [],
        comments: [],
      };
      ensureCurrent().pgaStatuses.push(currentPga);
    } else if (id === 'SO71') {
      const rec = parseRecord(SO71, line);
      const subReasonCodes: string[] = [];
      for (let slot = 1; slot <= 10; slot++) {
        const value = rec.values[`subReasonCode${slot}`];
        if (value !== undefined) subReasonCodes.push(value);
      }
      const detail: SoPgaDetail = {
        referenceQualifier: rec.values.referenceQualifier1,
        referenceNumber: rec.values.referenceNumber1,
        receiptDate: rec.values.receiptDate,
        receiptTime: rec.values.receiptTime,
        subReasonCodes,
        secondReferenceQualifier: rec.values.referenceQualifier2,
        secondReferenceNumber: rec.values.referenceNumber2,
      };
      // "If this record is used, an SO70 must be provided" (SO p.36).
      currentPga?.details.push(detail);
    } else if (id === 'SO72') {
      const rec = parseRecord(SO72, line);
      currentPga?.comments.push(rec.values.commentsToTrade ?? '');
    }
  }

  return notifications;
}

export interface CargoReleaseStatusBatch {
  batchRejected: boolean;
  envelopeConditions: ParsedCondition[];
  notifications: CargoReleaseStatusNotification[];
}

/** Parse a complete SO wire notification (A/B…Y/Z envelope included). */
export function parseCargoReleaseStatusBatch(lines: string[]): CargoReleaseStatusBatch {
  const batch = parseBatch(lines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    notifications: batch.blocks.flatMap((b) => parseCargoReleaseStatus(b.transactionLines)),
  };
}
