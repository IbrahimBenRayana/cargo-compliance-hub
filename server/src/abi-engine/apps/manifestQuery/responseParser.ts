/**
 * Cargo Manifest/In-bond/Entry Status Query response (C1) parser — chapter
 * revision 21, September 9, 2025, ACMQ-15..43 and ACMQ-64.
 *
 * A question answers with either one error record (WR0 entry, WSA in-bond or
 * surface bill, WSB air waybill) or result loops (ACMQ-15 Note 3):
 *
 *   - Surface: a WR1 (conveyance) opens a loop; WR2, WR4 (the bill, repeated
 *     per in-bond), WR5 (dispositions), WN0 and WN1 fill it. A master bill
 *     comes first with each house in its own following loop; a queried house
 *     comes first with its master second.
 *   - Air: one WR1/WR2, then a WSC/WSD/WN0/WN1 group for the master and one
 *     for each house air waybill. A WSC repeats per in-bond on the same bill.
 *   - In-bond: WS4 (before the WR4s) or WS5 (after each WR4) carries the
 *     in-bond status.
 *
 * The WO10..WO72 entry-status records are returned raw in entryStatusLines.
 */
import { parseRecord } from '../../records/codec.js';
import { parseBatch } from '../../envelope/batch.js';
import {
  OUTPUT_WR0,
  OUTPUT_WSA,
  OUTPUT_WSB,
  OUTPUT_WR1,
  OUTPUT_WR2,
  OUTPUT_WS4,
  OUTPUT_WS5,
  OUTPUT_WR4,
  OUTPUT_WSC,
  OUTPUT_WSD,
  OUTPUT_WR5,
  OUTPUT_WN0,
  OUTPUT_WN1,
} from './recordDefs.js';

// ── Result types ───────────────────────────────────────────

export interface ManifestQueryError {
  /** Which error record carried it: WR0 entry, WSA in-bond / surface bill, WSB air waybill. */
  scope: 'entry' | 'bill' | 'airWaybill';
  /** CQ_ERROR_CODES (ACMQ-64), e.g. 122 BILL NBR NOT ON FILE. */
  code: string;
  narrative: string;
  entryFilerCode?: string;
  entryNumber?: string;
  inbondNumber?: string;
  billIssuerCode?: string;
  billNumber?: string;
  airWaybillNumber?: string;
  houseAirWaybillNumber?: string;
}

export interface ManifestInbond {
  inbondNumber?: string;
  /** INBOND_STATUS_CODES: AR, CN, ER, EX, IF, IU, UA, OF. */
  status?: string;
  /** MMDDYY. */
  arrivalDate?: string;
  /** MMDDYY. */
  exportDate?: string;
  /** 61 IT, 62 T&E, 63 IE, 69, 70. */
  entryType?: string;
}

export interface ManifestDisposition {
  /** MMDDYY. */
  date: string;
  /** HHMM (surface, WR5) or HHMMSS (air, WSD). */
  time: string;
  /** Ocean CAMIR Appendix D (surface) or Air CAMIR Appendix A (air) code. */
  code: string;
  narrative: string;
  /** MMDDYY; only with disposition 22 (surface). */
  releaseDate?: string;
  /** RELEASE_ORIGIN_CODES; only with disposition 22 (surface). */
  releaseOrigin?: string;
  quantity?: number;
  sequence?: number;
  /** The in-bond or entry the disposition relates to (air). */
  inbondOrEntryNumber?: string;
}

export interface ManifestPorts {
  inbondNumber?: string;
  manifestedPortOfUnlading?: string;
  actualPortOfUnlading?: string;
  actualPortOfUnladingVesselDiversion?: string;
  inbondOriginatingPort?: string;
  manifestedInbondDestinationPort?: string;
  actualInbondDestinationManualDiversion?: string;
  actualInbondDestinationEdiDiversion?: string;
  /** Schedule K foreign port. */
  vesselDeparturePort?: string;
  /** MMDDYY. */
  vesselDepartureDate?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
}

export interface ManifestBill {
  kind: 'surface' | 'air';

  // Surface (WR4)
  masterBillNumber?: string;
  houseBillNumber?: string;
  subHouseBillNumber?: string;
  masterBillIssuerCode?: string;
  houseBillIssuerCode?: string;
  unit?: string;
  /** 0 regular, M master, H house, F FROB. */
  billOfLadingType?: string;
  /** Ocean only: whether an Importer Security Filing is on file against the bill. */
  isfOnFile?: boolean;
  /** 1 ocean, 2 rail, 3 truck. */
  modeOfTransportCode?: string;

  // Air (WSC)
  airWaybillNumber?: string;
  houseAirWaybillNumber?: string;
  importingCarrierCode?: string;
  flightNumber?: string;
  /** MMDDYY. */
  scheduledArrivalDate?: string;
  partIndicator?: string;
  boardedQuantity?: number;
  housePartIndicator?: string;
  houseManifestQuantity?: number;
  houseBoardedQuantity?: number;

  /** The bill's manifested quantity (the master air waybill's, for air). */
  manifestQuantity?: number;
  /** In-bonds posted to the bill, latest first. */
  inbonds: ManifestInbond[];
  /** In CBP's order. */
  dispositions: ManifestDisposition[];
  amendedQuantities?: { master?: number; house?: number };
  ports: ManifestPorts[];
}

/** One WR1 loop: a conveyance and the bill(s) reported under it. */
export interface ManifestConveyance {
  carrierCode?: string;
  /** Vessel name; carrier + flight + arrival date for air; absent for truck. */
  conveyanceName?: string;
  voyageFlightTripNumber?: string;
  /** MMDDYY, estimated. */
  dateOfArrival?: string;
  truckTripNumber?: string;
  /** Location of the air cargo. */
  firmsCode?: string;
  /** Entry fields, returned only on entry queries by the entry's own filer. */
  districtPortOfEntry?: string;
  entryFilerCode?: string;
  entryNumber?: string;
  entryTypeCode?: string;
  importerOfRecordNumber?: string;
  brokerReferenceNumber?: string;
  /** In-bond status reported at the in-bond level (WS4). */
  inbondStatus?: ManifestInbond;
  bills: ManifestBill[];
}

export interface ManifestQueryResponse {
  errors: ManifestQueryError[];
  conveyances: ManifestConveyance[];
  /** WO10..WO72 entry-status records, unparsed. */
  entryStatusLines: string[];
}

// ── Parser ─────────────────────────────────────────────────

function optNum(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/** CBP sends zeros where there is no date (ACMQ-32). */
function optDate(value: string | undefined): string | undefined {
  return value === undefined || /^0+$/.test(value) ? undefined : value;
}

function inbondStatus(values: Record<string, string>): ManifestInbond {
  return {
    status: values.inbondStatus,
    arrivalDate: optDate(values.inbondArrivalDate),
    exportDate: optDate(values.inbondExportDate),
    entryType: values.inbondEntryType,
  };
}

/**
 * Parse the lines of a C1 response (the transaction lines of a response
 * block) into errors and conveyance loops.
 */
export function parseManifestQueryResponse(lines: string[]): ManifestQueryResponse {
  const response: ManifestQueryResponse = { errors: [], conveyances: [], entryStatusLines: [] };
  const cur: {
    conveyance: ManifestConveyance | null;
    bill: ManifestBill | null;
    /** True once the current air bill has records of its own, so the next WSC is a new bill. */
    billHasDetail: boolean;
  } = { conveyance: null, bill: null, billHasDetail: false };

  const openConveyance = (): ManifestConveyance => {
    if (!cur.conveyance) {
      cur.conveyance = { bills: [] };
      response.conveyances.push(cur.conveyance);
    }
    return cur.conveyance;
  };
  const openBill = (kind: ManifestBill['kind']): ManifestBill => {
    if (!cur.bill) {
      cur.bill = { kind, inbonds: [], dispositions: [], ports: [] };
      cur.billHasDetail = false;
      openConveyance().bills.push(cur.bill);
    }
    return cur.bill;
  };

  for (const line of lines) {
    if (line.startsWith('WO')) {
      response.entryStatusLines.push(line);
      continue;
    }
    switch (line.slice(0, 3)) {
      case 'WR0': {
        const { values } = parseRecord(OUTPUT_WR0, line);
        response.errors.push({
          scope: 'entry',
          code: values.errorCode ?? '',
          narrative: values.narrative ?? '',
          entryFilerCode: values.entryFilerCode,
          entryNumber: values.entryNumber,
        });
        break;
      }
      case 'WSA': {
        const { values } = parseRecord(OUTPUT_WSA, line);
        response.errors.push({
          scope: 'bill',
          code: values.errorCode ?? '',
          narrative: values.narrative ?? '',
          inbondNumber: values.inbondNumber,
          billIssuerCode: values.billIssuerCode,
          billNumber: values.masterBillNumber,
        });
        break;
      }
      case 'WSB': {
        const { values } = parseRecord(OUTPUT_WSB, line);
        response.errors.push({
          scope: 'airWaybill',
          code: values.errorCode ?? '',
          narrative: values.narrative ?? '',
          airWaybillNumber: values.airWaybillNumber,
          houseAirWaybillNumber: values.houseAirWaybillNumber,
        });
        break;
      }
      case 'WR1': {
        const { values } = parseRecord(OUTPUT_WR1, line);
        cur.conveyance = {
          carrierCode: values.carrierCode,
          conveyanceName: values.conveyanceName,
          voyageFlightTripNumber: values.voyageFlightTripNumber,
          dateOfArrival: optDate(values.dateOfArrival),
          districtPortOfEntry: values.districtPortOfEntry,
          entryFilerCode: values.entryFilerCode,
          entryNumber: values.entryNumber,
          entryTypeCode: values.entryTypeCode,
          importerOfRecordNumber: values.importerOfRecordNumber,
          brokerReferenceNumber: values.brokerReferenceNumber,
          bills: [],
        };
        response.conveyances.push(cur.conveyance);
        cur.bill = null;
        break;
      }
      case 'WR2': {
        const { values } = parseRecord(OUTPUT_WR2, line);
        const c = openConveyance();
        c.truckTripNumber = values.tripNumber;
        c.firmsCode = values.firmsCode;
        break;
      }
      case 'WS4': {
        const { values } = parseRecord(OUTPUT_WS4, line);
        openConveyance().inbondStatus = inbondStatus(values);
        break;
      }
      case 'WR4': {
        const { values } = parseRecord(OUTPUT_WR4, line);
        // The record repeats per in-bond on the same bill; a different bill
        // number (in-bond queries, ACMQ-32 Note 1) starts another bill.
        const b = cur.bill;
        const sameBill =
          b !== null &&
          b.kind === 'surface' &&
          b.masterBillNumber === values.masterBillNumber &&
          b.houseBillNumber === values.houseBillNumber &&
          b.subHouseBillNumber === values.subHouseBillNumber;
        if (!sameBill) {
          cur.bill = null;
          Object.assign(openBill('surface'), {
            masterBillNumber: values.masterBillNumber,
            houseBillNumber: values.houseBillNumber,
            subHouseBillNumber: values.subHouseBillNumber,
            masterBillIssuerCode: values.masterBillIssuerCode,
            houseBillIssuerCode: values.houseBillIssuerCode,
            manifestQuantity: optNum(values.manifestQuantity),
            unit: values.unit,
            billOfLadingType: values.billOfLadingType,
            isfOnFile: values.isfIndicator === undefined ? undefined : values.isfIndicator === 'Y',
            modeOfTransportCode: values.modeOfTransportCode,
          } satisfies Partial<ManifestBill>);
        }
        if (values.inbondNumber) openBill('surface').inbonds.push({ inbondNumber: values.inbondNumber });
        break;
      }
      case 'WS5': {
        const { values } = parseRecord(OUTPUT_WS5, line);
        const b = openBill('surface');
        const last = b.inbonds[b.inbonds.length - 1];
        if (last && last.status === undefined) Object.assign(last, inbondStatus(values));
        else b.inbonds.push(inbondStatus(values));
        break;
      }
      case 'WSC': {
        const { values } = parseRecord(OUTPUT_WSC, line);
        const house = values.houseAirWaybillNumber?.trim() || undefined;
        const b = cur.bill;
        const sameBill =
          b !== null &&
          b.kind === 'air' &&
          !cur.billHasDetail &&
          b.airWaybillNumber === values.airWaybillNumber &&
          b.houseAirWaybillNumber === house &&
          b.partIndicator === values.partIndicator &&
          b.housePartIndicator === values.housePartIndicator;
        if (!sameBill) {
          cur.bill = null;
          Object.assign(openBill('air'), {
            airWaybillNumber: values.airWaybillNumber,
            houseAirWaybillNumber: house,
            importingCarrierCode: values.importingCarrierCode,
            flightNumber: values.flightNumber,
            scheduledArrivalDate: optDate(values.scheduledArrivalDate),
            partIndicator: values.partIndicator,
            manifestQuantity: optNum(values.manifestQuantity),
            boardedQuantity: optNum(values.boardedQuantity),
            housePartIndicator: values.housePartIndicator,
            houseManifestQuantity: optNum(values.houseManifestQuantity),
            houseBoardedQuantity: optNum(values.houseBoardedQuantity),
          } satisfies Partial<ManifestBill>);
        }
        if (values.inbondNumber) {
          openBill('air').inbonds.push({
            inbondNumber: values.inbondNumber,
            status: values.inbondStatus,
            entryType: values.inbondEntryType,
          });
        }
        break;
      }
      case 'WSD': {
        const { values } = parseRecord(OUTPUT_WSD, line);
        openBill('air').dispositions.push({
          date: values.dispositionActionDate ?? '',
          time: values.dispositionActionTime ?? '',
          code: values.dispositionCode ?? '',
          narrative: values.narrative ?? '',
          inbondOrEntryNumber: values.inbondOrEntryNumber,
        });
        cur.billHasDetail = true;
        break;
      }
      case 'WR5': {
        const { values } = parseRecord(OUTPUT_WR5, line);
        openBill('surface').dispositions.push({
          date: values.dispositionActionDate ?? '',
          time: values.dispositionActionTime ?? '',
          code: values.dispositionCode ?? '',
          narrative: values.narrative ?? '',
          releaseDate: optDate(values.releaseDate),
          releaseOrigin: values.releaseOrigin,
          quantity: optNum(values.quantity),
          sequence: optNum(values.sequence),
        });
        break;
      }
      case 'WN0': {
        const { values } = parseRecord(OUTPUT_WN0, line);
        openBill(cur.bill?.kind ?? 'surface').amendedQuantities = {
          master: optNum(values.masterBillAmendedQuantity),
          house: optNum(values.houseBillAmendedQuantity),
        };
        cur.billHasDetail = true;
        break;
      }
      case 'WN1': {
        const { values } = parseRecord(OUTPUT_WN1, line);
        const { controlIdentifier: _id, vesselDepartureDate, ...ports } = values;
        openBill(cur.bill?.kind ?? 'surface').ports.push({ ...ports, vesselDepartureDate: optDate(vesselDepartureDate) });
        cur.billHasDetail = true;
        break;
      }
      default:
        // WR3 is reserved and not returned; anything else is not ours.
        break;
    }
  }

  return response;
}

export interface ManifestQueryResponseBatch {
  /** True when ACE rejected the whole batch at the envelope level. */
  batchRejected: boolean;
  /** Envelope-level conditions (X1), e.g. 999 BATCH REJECTED. */
  envelopeConditions: ReturnType<typeof parseBatch>['conditions'];
  response: ManifestQueryResponse;
}

/** Parse a complete C1 wire response (A/B…Y/Z envelope included). */
export function parseManifestQueryResponseBatch(lines: string[]): ManifestQueryResponseBatch {
  const batch = parseBatch(lines);
  const transactionLines = batch.blocks.flatMap((b) => b.transactionLines);
  return {
    batchRejected: batch.rejected,
    envelopeConditions: batch.conditions,
    response: parseManifestQueryResponse(transactionLines),
  };
}
