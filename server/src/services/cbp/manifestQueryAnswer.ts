/**
 * Native manifest query, the pure part (docs/specs/native-manifest-query.md):
 * what a person typed becomes a CQ question, and CBP's C1 reply becomes the
 * answer stored on the manifest_queries row.
 *
 * The stored answer keeps the shape every reader already knows
 * (`data.response[0]` with carrierCode, houses[], dispositionMsg[],
 * errorMessage: the manifest query page, the ISF prefill and the entry
 * prefill), so nothing downstream changes. The full parsed reply sits next
 * to it under `native`.
 */
import type { ManifestQueryRequest } from '../../abi-engine/apps/manifestQuery/builder.js';
import {
  parseManifestQueryResponseBatch,
  type ManifestBill,
  type ManifestConveyance,
  type ManifestDisposition,
  type ManifestQueryResponse,
} from '../../abi-engine/apps/manifestQuery/responseParser.js';

export type ManifestBillType = 'BOLNUMBER' | 'AWBNUMBER';

/** The bill as typed cannot be asked of CBP; the message is for the person. */
export class ManifestQueryInputError extends Error {}

/**
 * Ocean bills are typed carrier code first (MAEU123456789): the first four
 * characters are the issuer, the rest the bill number, which CBP limits to
 * 12 characters. Related bills are always requested, since the houses are
 * what the page shows. An air waybill is 11 characters without the hyphen.
 */
export function manifestQueryRequestFor(input: {
  bolNumber: string;
  bolType: ManifestBillType;
  houseBOLNumber?: string | null;
}): ManifestQueryRequest {
  const bill = input.bolNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (input.bolType === 'AWBNUMBER') {
    if (bill.length !== 11) {
      throw new ManifestQueryInputError('An air waybill number is 11 characters: the 3-character carrier prefix and 8 digits.');
    }
    const house = input.houseBOLNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (house && house.length > 12) {
      throw new ManifestQueryInputError('A house air waybill number is at most 12 characters.');
    }
    return { type: 'airWaybill', airWaybillNumber: bill, houseAirWaybillNumber: house || undefined };
  }
  if (!/^[A-Z]{4}/.test(bill) || bill.length < 5) {
    throw new ManifestQueryInputError('Enter the bill with its 4-letter carrier code first, like MAEU123456789.');
  }
  if (bill.length > 16) {
    throw new ManifestQueryInputError('CBP accepts at most 12 characters after the 4-letter carrier code.');
  }
  return { type: 'bill', issuerCode: bill.slice(0, 4), billNumber: bill.slice(4), relatedBills: true };
}

// ── The stored answer ──────────────────────────────────────

interface AnswerDisposition {
  dispositionActionDate: string;
  dispositionActionTime: string;
  dispositionCode: string;
  /** CBP's own words for the code. */
  narrative: string;
  entryNumber?: string;
}

interface AnswerHouse {
  hawbNumber?: string;
  awbNumber?: string;
  flightNumber?: string;
  importingCarrierCode?: string;
  scheduledArrivalDate?: string;
  partIndicator?: string;
  manifestQty?: string;
  boardedQty?: string;
  manifestedPort?: string;
  isfOnFile?: boolean;
  dispositionMsg: AnswerDisposition[];
}

interface AnswerItem {
  errorMessage?: string;
  masterBOLNumber?: string;
  awbNumber?: string;
  carrierCode?: string;
  importingCarrierCode?: string;
  conveyanceName?: string;
  importingVesselCodeOrImpConveyanceName?: string;
  voyageFlightTripNo?: string;
  flightNumber?: string;
  wr1DateOfArrival?: string;
  scheduledArrivalDate?: string;
  modeOfTransport?: string;
  manifestQty?: string;
  manifestedPortOfUnlading?: string;
  actualPortOcean?: string;
  vesselDeparturePort?: string;
  vesselDepartureDate?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
  /** Ocean only: whether CBP has an ISF on file against the bill. */
  isfOnFile?: boolean;
  /** The queried bill's own status codes. */
  dispositionMsg?: AnswerDisposition[];
  houses?: AnswerHouse[];
}

export interface StoredManifestAnswer {
  provider: 'native';
  data: { type: ManifestBillType; masterBOLNumber: string; response: AnswerItem[] };
  native: ManifestQueryResponse;
}

export type ManifestAnswer =
  | { status: 'completed'; response: StoredManifestAnswer }
  | { status: 'failed'; errorMessage: string };

/** Error codes that mean "CBP has nothing on file for this", not "the query was refused" (ACMQ-64). */
const NOT_ON_FILE = new Set(['122', '123', '297', '950']);

const SURFACE_MODE: Record<string, string> = { '1': 'OCEAN', '2': 'RAIL', '3': 'TRUCK' };

const quantity = (n: number | undefined): string | undefined => (n === undefined ? undefined : String(n));

function dispositions(items: ManifestDisposition[]): AnswerDisposition[] {
  return items.map((d) => ({
    dispositionActionDate: d.date,
    dispositionActionTime: d.time,
    dispositionCode: d.code,
    narrative: d.narrative,
    entryNumber: d.inbondOrEntryNumber,
  }));
}

function surfaceItem(conveyances: ManifestConveyance[]): AnswerItem {
  const first = conveyances[0];
  const asked = first.bills[0] as ManifestBill | undefined;
  const ports = asked?.ports[0];
  const withConveyance = conveyances.flatMap((c) => c.bills.map((bill) => ({ bill, conveyance: c })));
  const houses = withConveyance.filter(({ bill }) => bill.kind === 'surface' && bill.billOfLadingType === 'H');
  return {
    masterBOLNumber: asked?.masterBillNumber ? `${asked.masterBillIssuerCode ?? ''}${asked.masterBillNumber}` : undefined,
    carrierCode: first.carrierCode ?? asked?.masterBillIssuerCode,
    conveyanceName: first.conveyanceName,
    importingVesselCodeOrImpConveyanceName: first.conveyanceName,
    voyageFlightTripNo: first.voyageFlightTripNumber,
    wr1DateOfArrival: first.dateOfArrival,
    scheduledArrivalDate: first.dateOfArrival,
    modeOfTransport: SURFACE_MODE[asked?.modeOfTransportCode ?? ''],
    manifestQty: quantity(asked?.manifestQuantity),
    manifestedPortOfUnlading: ports?.manifestedPortOfUnlading,
    actualPortOcean: ports?.actualPortOfUnladingVesselDiversion,
    vesselDeparturePort: ports?.vesselDeparturePort,
    vesselDepartureDate: ports?.vesselDepartureDate,
    containerLoadPort: ports?.containerLoadPort,
    containerLoadDate: ports?.containerLoadDate,
    isfOnFile: asked?.isfOnFile,
    dispositionMsg: dispositions(asked?.dispositions ?? []),
    houses: houses.map(({ bill, conveyance }) => ({
      hawbNumber: `${bill.houseBillIssuerCode ?? ''}${bill.houseBillNumber ?? ''}`,
      importingCarrierCode: bill.houseBillIssuerCode ?? conveyance.carrierCode,
      scheduledArrivalDate: conveyance.dateOfArrival,
      manifestQty: quantity(bill.manifestQuantity),
      manifestedPort: bill.ports[0]?.manifestedPortOfUnlading ?? ports?.manifestedPortOfUnlading,
      isfOnFile: bill.isfOnFile,
      dispositionMsg: dispositions(bill.dispositions),
    })),
  };
}

function airItem(conveyances: ManifestConveyance[]): AnswerItem {
  const first = conveyances[0];
  const bills = conveyances.flatMap((c) => c.bills).filter((b) => b.kind === 'air');
  const asked = bills[0];
  const port = bills.find((b) => b.ports.length)?.ports[0]?.manifestedPortOfUnlading;
  return {
    awbNumber: asked.airWaybillNumber,
    carrierCode: first.carrierCode ?? asked.importingCarrierCode,
    importingCarrierCode: asked.importingCarrierCode,
    conveyanceName: asked.flightNumber ? `${asked.importingCarrierCode ?? ''}${asked.flightNumber}` : first.conveyanceName,
    voyageFlightTripNo: first.voyageFlightTripNumber,
    flightNumber: asked.flightNumber,
    wr1DateOfArrival: first.dateOfArrival,
    scheduledArrivalDate: asked.scheduledArrivalDate ?? first.dateOfArrival,
    modeOfTransport: 'AIR',
    manifestQty: quantity(asked.manifestQuantity),
    manifestedPortOfUnlading: port,
    dispositionMsg: asked.houseAirWaybillNumber ? [] : dispositions(asked.dispositions),
    houses: bills
      .filter((b) => b.houseAirWaybillNumber)
      .map((b) => ({
        awbNumber: b.airWaybillNumber,
        hawbNumber: b.houseAirWaybillNumber,
        flightNumber: b.flightNumber,
        importingCarrierCode: b.importingCarrierCode,
        scheduledArrivalDate: b.scheduledArrivalDate,
        partIndicator: b.housePartIndicator,
        manifestQty: quantity(b.houseManifestQuantity),
        boardedQty: quantity(b.houseBoardedQuantity),
        manifestedPort: b.ports[0]?.manifestedPortOfUnlading ?? port,
        dispositionMsg: dispositions(b.dispositions),
      })),
  };
}

/** Turn CBP's complete C1 batch into the answer for the bill that was asked about. */
export function manifestAnswerFromWire(lines: string[], asked: { bolNumber: string; bolType: ManifestBillType }): ManifestAnswer {
  const batch = parseManifestQueryResponseBatch(lines);
  if (batch.batchRejected) {
    const why = batch.envelopeConditions.map((c) => `${c.conditionCode} ${c.narrative}`.trim()).join('; ');
    return { status: 'failed', errorMessage: `CBP refused the query${why ? `: ${why}` : '.'}` };
  }

  const { errors, conveyances } = batch.response;
  const stored = (item: AnswerItem): ManifestAnswer => ({
    status: 'completed',
    response: {
      provider: 'native',
      data: { type: asked.bolType, masterBOLNumber: asked.bolNumber, response: [item] },
      native: batch.response,
    },
  });

  if (conveyances.length === 0) {
    const error = errors[0];
    if (!error) return stored({});
    const said = `${error.code}-${error.narrative}`;
    return NOT_ON_FILE.has(error.code) ? stored({ errorMessage: said }) : { status: 'failed', errorMessage: `CBP answered: ${said}` };
  }

  const air = conveyances.some((c) => c.bills.some((b) => b.kind === 'air'));
  return stored(air ? airItem(conveyances) : surfaceItem(conveyances));
}
