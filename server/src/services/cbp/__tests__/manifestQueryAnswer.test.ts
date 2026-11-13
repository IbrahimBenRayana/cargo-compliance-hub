/**
 * Native manifest query, pure part: the typed bill becomes a CQ question and
 * CBP's C1 reply becomes the stored answer, in the shape the manifest query
 * page and the prefills already read (docs/specs/native-manifest-query.md).
 */
import { describe, it, expect } from 'vitest';
import { ManifestQueryInputError, manifestAnswerFromWire, manifestQueryRequestFor } from '../manifestQueryAnswer.js';

/** An 80-character record with each text placed at its 1-based start position. */
function rec(...parts: [start: number, text: string][]): string {
  const chars = new Array<string>(80).fill(' ');
  for (const [start, text] of parts) {
    for (let i = 0; i < text.length; i++) chars[start - 1 + i] = text[i];
  }
  return chars.join('');
}

const wire = (...inner: string[]) => [
  'A   LGB1S7PSECRET111526     C1'.padEnd(80, ' '),
  'B  2704S7PC1'.padEnd(80, ' '),
  ...inner,
  'Y  2704S7PC1'.padEnd(80, ' '),
  'Z   LGB1S7P      111526'.padEnd(80, ' '),
];

const wr1 = rec([1, 'WR1'], [43, 'MAEU'], [47, 'MAERSK ESSEX'], [67, '432W'], [72, '111526']);
const wr4 = (house: string, qty: string, type: string, isf: string) =>
  rec([1, 'WR4'], [16, '123456789'], [28, house], [52, qty], [60, 'CTN'], [65, 'MAEU'], [69, house ? 'ABCD' : ''], [73, type], [74, isf], [75, '1']);
const wr5 = (code: string, narrative: string) => rec([1, 'WR5'], [4, '111626'], [10, '0915'], [14, code], [17, narrative]);

const OCEAN = { bolNumber: 'MAEU123456789', bolType: 'BOLNUMBER' } as const;

describe('manifestQueryRequestFor', () => {
  it('splits an ocean bill into carrier code and bill number and asks for related bills', () => {
    expect(manifestQueryRequestFor({ bolNumber: 'maeu-123456789', bolType: 'BOLNUMBER' })).toEqual({
      type: 'bill', issuerCode: 'MAEU', billNumber: '123456789', relatedBills: true,
    });
  });

  it('strips the hyphen from an air waybill and carries the house', () => {
    expect(manifestQueryRequestFor({ bolNumber: '006-12345675', bolType: 'AWBNUMBER', houseBOLNumber: 'hawb0001' })).toEqual({
      type: 'airWaybill', airWaybillNumber: '00612345675', houseAirWaybillNumber: 'HAWB0001',
    });
  });

  it('refuses a bill CBP could not look up, in words for the person', () => {
    expect(() => manifestQueryRequestFor({ bolNumber: '123456789', bolType: 'BOLNUMBER' })).toThrow(ManifestQueryInputError);
    expect(() => manifestQueryRequestFor({ bolNumber: 'MAEU1234567890123', bolType: 'BOLNUMBER' })).toThrow(/12 characters/);
    expect(() => manifestQueryRequestFor({ bolNumber: '0061234567', bolType: 'AWBNUMBER' })).toThrow(/11 characters/);
  });
});

describe('manifestAnswerFromWire', () => {
  it('maps a master bill and its houses onto the shape the page reads', () => {
    const answer = manifestAnswerFromWire(
      wire(
        wr1,
        wr4('', '00000250', 'M', 'Y'),
        wr5('95', 'BILL ARRIVED'),
        rec([1, 'WN1'], [16, '2704'], [44, '57035'], [49, '110126']),
        wr1,
        wr4('HBL0001', '00000100', 'H', 'Y'),
        wr5('1C', 'ENTERED AND RELEASED'),
        wr1,
        wr4('HBL0002', '00000150', 'H', 'N'),
      ),
      OCEAN,
    );
    expect(answer.status).toBe('completed');
    if (answer.status !== 'completed') return;
    expect(answer.response.provider).toBe('native');
    expect(answer.response.data).toMatchObject({ type: 'BOLNUMBER', masterBOLNumber: 'MAEU123456789' });
    const [item] = answer.response.data.response;
    expect(item).toMatchObject({
      masterBOLNumber: 'MAEU123456789',
      carrierCode: 'MAEU',
      conveyanceName: 'MAERSK ESSEX',
      voyageFlightTripNo: '432W',
      scheduledArrivalDate: '111526',
      modeOfTransport: 'OCEAN',
      manifestQty: '250',
      manifestedPortOfUnlading: '2704',
      vesselDeparturePort: '57035',
      vesselDepartureDate: '110126',
      isfOnFile: true,
    });
    expect(item.errorMessage).toBeUndefined();
    expect(item.dispositionMsg).toEqual([
      { dispositionActionDate: '111626', dispositionActionTime: '0915', dispositionCode: '95', narrative: 'BILL ARRIVED', entryNumber: undefined },
    ]);
    expect(item.houses).toEqual([
      {
        hawbNumber: 'ABCDHBL0001', importingCarrierCode: 'ABCD', scheduledArrivalDate: '111526', manifestQty: '100',
        manifestedPort: '2704', isfOnFile: true,
        dispositionMsg: [{ dispositionActionDate: '111626', dispositionActionTime: '0915', dispositionCode: '1C', narrative: 'ENTERED AND RELEASED', entryNumber: undefined }],
      },
      { hawbNumber: 'ABCDHBL0002', importingCarrierCode: 'ABCD', scheduledArrivalDate: '111526', manifestQty: '150', manifestedPort: '2704', isfOnFile: false, dispositionMsg: [] },
    ]);
    // The full parsed reply is kept beside it.
    expect(answer.response.native.conveyances).toHaveLength(3);
  });

  it('lists a queried house bill as the house, with its master second', () => {
    const answer = manifestAnswerFromWire(wire(wr1, wr4('HBL0001', '00000100', 'H', 'Y'), wr5('1C', 'ENTERED AND RELEASED'), wr1, wr4('', '00000250', 'M', 'Y')), OCEAN);
    if (answer.status !== 'completed') throw new Error('expected an answer');
    const [item] = answer.response.data.response;
    expect(item.houses?.map((h) => h.hawbNumber)).toEqual(['ABCDHBL0001']);
    expect(item.masterBOLNumber).toBe('MAEU123456789');
  });

  it('gives a regular bill no houses and keeps its own status codes', () => {
    const answer = manifestAnswerFromWire(wire(wr1, wr4('', '00000250', '0', 'N'), wr5('1H', 'HOLD PLACED')), OCEAN);
    if (answer.status !== 'completed') throw new Error('expected an answer');
    const [item] = answer.response.data.response;
    expect(item.houses).toEqual([]);
    expect(item.dispositionMsg?.map((d) => d.dispositionCode)).toEqual(['1H']);
  });

  it('maps an air waybill: flight, arrival and one row per house air waybill', () => {
    const wsc = (house: string, houseQty: string) =>
      rec([1, 'WSC'], [4, 'DL'], [7, '0123'], [12, '111526'], [18, '00612345675'], [30, '00040'], [40, house], [53, houseQty], [80, '1']);
    const wsd = (code: string, narrative: string, ref = '') => rec([1, 'WSD'], [4, '111526'], [10, '142500'], [16, code], [18, narrative], [58, ref]);
    const answer = manifestAnswerFromWire(
      wire(
        rec([1, 'WR1'], [43, 'DL'], [47, 'DL0123111526'], [67, '0123'], [72, '111526']),
        wsc('', ''),
        wsd('1C', 'ENTERED GENERAL EXAM NOT REQUIRED', 'S7P12345678'),
        rec([1, 'WN1'], [16, '3001']),
        wsc('HAWB0001', '00015'),
        wsd('1H', 'HOLD PLACED'),
      ),
      { bolNumber: '00612345675', bolType: 'AWBNUMBER' },
    );
    if (answer.status !== 'completed') throw new Error('expected an answer');
    const [item] = answer.response.data.response;
    expect(item).toMatchObject({
      awbNumber: '00612345675', carrierCode: 'DL', modeOfTransport: 'AIR', conveyanceName: 'DL0123', flightNumber: '0123',
      scheduledArrivalDate: '111526', manifestQty: '40', manifestedPortOfUnlading: '3001',
    });
    expect(item.dispositionMsg?.[0]).toMatchObject({ dispositionCode: '1C', entryNumber: 'S7P12345678' });
    expect(item.houses).toEqual([
      {
        awbNumber: '00612345675', hawbNumber: 'HAWB0001', flightNumber: '0123', importingCarrierCode: 'DL', scheduledArrivalDate: '111526',
        partIndicator: undefined, manifestQty: '15', boardedQty: undefined, manifestedPort: '3001',
        dispositionMsg: [{ dispositionActionDate: '111526', dispositionActionTime: '142500', dispositionCode: '1H', narrative: 'HOLD PLACED', entryNumber: undefined }],
      },
    ]);
  });

  it('stores "not on file" as an answer the page already understands', () => {
    const answer = manifestAnswerFromWire(wire(rec([1, 'WSA'], [16, 'MAEU'], [20, '123456789'], [32, '122'], [35, 'BILL NBR NOT ON FILE'])), OCEAN);
    if (answer.status !== 'completed') throw new Error('expected an answer');
    expect(answer.response.data.response).toEqual([{ errorMessage: '122-BILL NBR NOT ON FILE' }]);
  });

  it('fails the query, with CBP\'s own words, when CBP refuses it', () => {
    expect(manifestAnswerFromWire(wire(rec([1, 'WSA'], [16, 'MAEU'], [20, '123456789'], [32, 'X17'], [35, 'FILER NOT AUTHORIZED'])), OCEAN)).toEqual({
      status: 'failed', errorMessage: 'CBP answered: X17-FILER NOT AUTHORIZED',
    });
  });

  it('stores an empty answer when CBP returns neither data nor an error', () => {
    const answer = manifestAnswerFromWire(wire(), OCEAN);
    if (answer.status !== 'completed') throw new Error('expected an answer');
    expect(answer.response.data.response).toEqual([{}]);
  });
});
