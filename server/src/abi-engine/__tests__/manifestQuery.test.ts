/**
 * Cargo Manifest/In-bond/Entry Status Query (CQ/C1) tests — chapter revision
 * 21, September 9, 2025 (ACMQ page refs). The chapter prints no sample
 * transmissions, so every fixture is laid out by hand at the positions its
 * record tables give, independently of our record definitions.
 */
import { describe, it, expect } from 'vitest';
import { buildManifestQuery } from '../apps/manifestQuery/builder.js';
import { parseManifestQueryResponse, parseManifestQueryResponseBatch } from '../apps/manifestQuery/responseParser.js';
import { CQ_ERROR_CODES } from '../apps/manifestQuery/recordDefs.js';
import { RecordCodecError } from '../records/codec.js';
import { APPLICATION_CODES } from '../envelope/conditionCodes.js';
import { buildBatch, parseBatch } from '../envelope/batch.js';

/** An 80-character record with each text placed at its 1-based start position. */
function rec(...parts: [start: number, text: string][]): string {
  const chars = new Array<string>(80).fill(' ');
  for (const [start, text] of parts) {
    for (let i = 0; i < text.length; i++) chars[start - 1 + i] = text[i];
  }
  return chars.join('');
}

// Conveyance, WR1 output (ACMQ-24..26): carrier 43-46, vessel 47-66, voyage 67-71, arrival 72-77.
const wr1 = (carrier: string, vessel: string, voyage: string, arrival: string) =>
  rec([1, 'WR1'], [43, carrier], [47, vessel], [67, voyage], [72, arrival]);

// Bill, WR4 (ACMQ-30..31): in-bond 4-15, master 16-27, house 28-39, quantity 52-59, unit 60-64,
// master issuer 65-68, house issuer 69-72, bill type 73, ISF 74, mode 75.
const wr4 = (o: { inbond?: string; master: string; house?: string; qty: string; issuer: string; houseIssuer?: string; type: string; isf?: string; mode?: string }) =>
  rec([1, 'WR4'], [4, o.inbond ?? ''], [16, o.master], [28, o.house ?? ''], [52, o.qty], [60, 'CTN'], [65, o.issuer], [69, o.houseIssuer ?? ''], [73, o.type], [74, o.isf ?? ''], [75, o.mode ?? '1']);

// Disposition, WR5 (ACMQ-39): date 4-9, time 10-13, code 14-16, narrative 17-56, quantity 66-73, sequence 75-77.
const wr5 = (date: string, time: string, code: string, narrative: string, qty = '', seq = '') =>
  rec([1, 'WR5'], [4, date], [10, time], [14, code], [17, narrative], [66, qty], [75, seq]);

describe('CQ application codes', () => {
  it('uses CQ for the query and C1 for the response (ACMQ-12)', () => {
    expect(APPLICATION_CODES.cargoManifestEntryReleaseQuery).toEqual({ input: 'CQ', response: 'C1' });
  });
});

// ── Builder (ACMQ-13..14) ──────────────────────────────────

describe('buildManifestQuery', () => {
  it('lays out an ocean bill question per ACMQ-13: issuer 32-35, bill 36-47, related 71, limit 73', () => {
    const [line] = buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU', billNumber: '123456789', relatedBills: true }]);
    expect(line).toHaveLength(80);
    expect(line).toBe(rec([1, 'WR1'], [32, 'MAEU'], [36, '123456789'], [71, 'Y'], [73, '2']));
  });

  it('leaves the related-bills indicator blank unless asked', () => {
    const [line] = buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU', billNumber: '123456789' }]);
    expect(line[70]).toBe(' ');
  });

  it('lays out an air waybill question: waybill 48-58, house 59-70', () => {
    const [line] = buildManifestQuery([{ type: 'airWaybill', airWaybillNumber: '17612345675', houseAirWaybillNumber: 'HAWB0001' }]);
    expect(line).toBe(rec([1, 'WR1'], [48, '17612345675'], [59, 'HAWB0001'], [73, '2']));
  });

  it('lays out an in-bond question: in-bond 20-31, with the carrier code only for air', () => {
    const [surface, air] = buildManifestQuery([
      { type: 'inbond', inbondNumber: '123456789' },
      { type: 'inbond', inbondNumber: '17612345675', airCarrierCode: '176' },
    ]);
    expect(surface).toBe(rec([1, 'WR1'], [20, '123456789'], [73, '2']));
    expect(air).toBe(rec([1, 'WR1'], [20, '17612345675'], [32, '176'], [73, '2']));
  });

  it('lays out an entry question: filer 8-10, entry number right justified in 11-19, bill data 72', () => {
    const [line] = buildManifestQuery([{ type: 'entry', filerCode: 'S7P', entryNumber: '12345678', withBills: true }]);
    expect(line).toBe(rec([1, 'WR1'], [8, 'S7P'], [12, '12345678'], [72, 'Y'], [73, '2']));
  });

  it('maps the limit option per Note 5: space most recent, 1 last five, 2 all', () => {
    const lines = buildManifestQuery(
      (['latest', 'last5', 'all'] as const).map((limit) => ({ type: 'bill', issuerCode: 'MAEU', billNumber: '1', limit })),
    );
    expect(lines.map((l) => l[72])).toEqual([' ', '1', '2']);
  });

  it('refuses data CBP would reject, before anything is sent', () => {
    expect(() => buildManifestQuery([])).toThrow(RecordCodecError);
    expect(() => buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU', billNumber: '1234567890123' }])).toThrow(/billNumber/);
    expect(() => buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU1', billNumber: '1' }])).toThrow(/issuerCode/);
    expect(() => buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU', billNumber: 'AB-12' }])).toThrow(/billNumber/);
    expect(() => buildManifestQuery([{ type: 'airWaybill', airWaybillNumber: '176-1234567' }])).toThrow(/airWaybillNumber/);
    expect(() => buildManifestQuery([{ type: 'inbond', inbondNumber: '12345' }])).toThrow(/inbondNumber/);
    expect(() => buildManifestQuery([{ type: 'entry', filerCode: 'S7', entryNumber: '12345678' }])).toThrow(/filerCode/);
  });
});

describe('CQ batch', () => {
  it('wraps the question in a CQ envelope that carries our correlation tag in the B record', () => {
    const lines = buildBatch({
      sender: { siteCode: 'LGB1', idCode: 'S7P', password: 'SECRET' },
      appId: 'CQ',
      blocks: [{
        port: '2704', filerCode: 'S7P', userData: 'MCL0123456789ABCDEF01',
        transactionLines: buildManifestQuery([{ type: 'bill', issuerCode: 'MAEU', billNumber: '123456789', relatedBills: true }]),
      }],
    });
    expect(lines.map((l) => l[0])).toEqual(['A', 'B', 'W', 'Y', 'Z']);
    expect(lines.every((l) => l.length === 80)).toBe(true);
    const sent = parseBatch(lines);
    expect(sent.appId).toBe('CQ');
    expect(sent.blocks[0].header.values.userData).toBe('MCL0123456789ABCDEF01');
  });
});

// ── Error records (ACMQ-21..23, ACMQ-64) ───────────────────

describe('parseManifestQueryResponse errors', () => {
  it('reads a bill error (WSA): issuer 16-19, bill 20-31, code 32-34, narrative 35-74', () => {
    const { errors, conveyances } = parseManifestQueryResponse([
      rec([1, 'WSA'], [16, 'MAEU'], [20, '123456789'], [32, '122'], [35, 'BILL NBR NOT ON FILE']),
    ]);
    expect(conveyances).toEqual([]);
    expect(errors).toEqual([
      { scope: 'bill', code: '122', narrative: 'BILL NBR NOT ON FILE', inbondNumber: undefined, billIssuerCode: 'MAEU', billNumber: '123456789' },
    ]);
    expect(CQ_ERROR_CODES['122']).toBe('BILL NBR NOT ON FILE');
  });

  it('reads an in-bond error (WSA): in-bond 4-15', () => {
    const { errors } = parseManifestQueryResponse([rec([1, 'WSA'], [4, '123456789'], [32, '123'], [35, 'INBOND NBR NOT ON FILE'])]);
    expect(errors[0]).toMatchObject({ scope: 'bill', code: '123', inbondNumber: '123456789' });
  });

  it('reads an air waybill error (WSB): waybill 4-14, house 15-26, code 27-29, narrative 30-69', () => {
    const { errors } = parseManifestQueryResponse([
      rec([1, 'WSB'], [4, '17612345675'], [15, 'HAWB0001'], [27, '297'], [30, 'INVALID AIRWAY BILL']),
    ]);
    expect(errors).toEqual([
      { scope: 'airWaybill', code: '297', narrative: 'INVALID AIRWAY BILL', airWaybillNumber: '17612345675', houseAirWaybillNumber: 'HAWB0001' },
    ]);
  });

  it('reads an entry error (WR0): filer 4-6, entry 7-15, code 30-32, narrative 33-72', () => {
    const { errors } = parseManifestQueryResponse([
      rec([1, 'WR0'], [4, 'S7P'], [7, ' 12345678'], [30, 'X17'], [33, 'FILER NOT AUTHORIZED']),
    ]);
    expect(errors).toEqual([
      { scope: 'entry', code: 'X17', narrative: 'FILER NOT AUTHORIZED', entryFilerCode: 'S7P', entryNumber: ' 12345678' },
    ]);
  });
});

// ── Surface loops (ACMQ-15 Note 3) ─────────────────────────

describe('parseManifestQueryResponse surface bills', () => {
  // WN1 (ACMQ-42..43): manifested port 16-19, departure port 44-48, departure date 49-54, load port 55-71, load date 72-77.
  const wn1 = rec([1, 'WN1'], [16, '2704'], [44, '57035'], [49, '110126'], [55, 'SHANGHAI'], [72, '103026']);

  const masterWithHouses = [
    wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
    rec([1, 'WR2']),
    wr4({ master: '123456789', qty: '00000250', issuer: 'MAEU', type: 'M', isf: 'Y' }),
    wr5('111626', '0915', '1C', 'ENTERED AND RELEASED', '00000250', '002'),
    wr5('111426', '1830', '95', 'BILL ARRIVED', '', '001'),
    rec([1, 'WN0'], [4, '00000240']),
    wn1,
    wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
    rec([1, 'WR2']),
    wr4({ master: '123456789', house: 'HBL0001', qty: '00000100', issuer: 'MAEU', houseIssuer: 'ABCD', type: 'H', isf: 'Y' }),
    wr5('111626', '0915', '1C', 'ENTERED AND RELEASED'),
    wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
    rec([1, 'WR2']),
    wr4({ master: '123456789', house: 'HBL0002', qty: '00000150', issuer: 'MAEU', houseIssuer: 'ABCD', type: 'H', isf: 'N' }),
    wr5('111526', '0700', '1H', 'HOLD PLACED'),
    rec([1, 'WN0'], [12, '00000140']),
  ];

  it('reads the master loop: conveyance, bill, dispositions, amended quantity and ports', () => {
    const { conveyances, errors } = parseManifestQueryResponse(masterWithHouses);
    expect(errors).toEqual([]);
    expect(conveyances).toHaveLength(3);

    const master = conveyances[0];
    expect(master).toMatchObject({ carrierCode: 'MAEU', conveyanceName: 'MAERSK ESSEX', voyageFlightTripNumber: '432W', dateOfArrival: '111526' });
    expect(master.bills).toHaveLength(1);
    const bill = master.bills[0];
    expect(bill).toMatchObject({
      kind: 'surface',
      masterBillNumber: '123456789',
      masterBillIssuerCode: 'MAEU',
      manifestQuantity: 250,
      unit: 'CTN',
      billOfLadingType: 'M',
      isfOnFile: true,
      modeOfTransportCode: '1',
      inbonds: [],
      amendedQuantities: { master: 240, house: undefined },
    });
    expect(bill.houseBillNumber).toBeUndefined();
    expect(bill.dispositions).toEqual([
      { date: '111626', time: '0915', code: '1C', narrative: 'ENTERED AND RELEASED', releaseDate: undefined, releaseOrigin: undefined, quantity: 250, sequence: 2 },
      { date: '111426', time: '1830', code: '95', narrative: 'BILL ARRIVED', releaseDate: undefined, releaseOrigin: undefined, quantity: undefined, sequence: 1 },
    ]);
    expect(bill.ports).toEqual([
      { manifestedPortOfUnlading: '2704', vesselDeparturePort: '57035', vesselDepartureDate: '110126', containerLoadPort: 'SHANGHAI', containerLoadDate: '103026' },
    ]);
  });

  it('reads each house bill in its own following loop', () => {
    const { conveyances } = parseManifestQueryResponse(masterWithHouses);
    const [h1, h2] = [conveyances[1].bills[0], conveyances[2].bills[0]];
    expect(h1).toMatchObject({ houseBillNumber: 'HBL0001', houseBillIssuerCode: 'ABCD', billOfLadingType: 'H', manifestQuantity: 100, isfOnFile: true });
    expect(h2).toMatchObject({ houseBillNumber: 'HBL0002', manifestQuantity: 150, isfOnFile: false, amendedQuantities: { master: undefined, house: 140 } });
    expect(h2.dispositions.map((d) => d.code)).toEqual(['1H']);
  });

  it('reads release date and origin on disposition 22: release 58-63, origin 64-65', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
      wr4({ master: '123456789', qty: '00000250', issuer: 'MAEU', type: '0' }),
      rec([1, 'WR5'], [4, '111626'], [10, '0915'], [14, '22'], [17, 'RELEASE DATE UPDATE'], [58, '111726'], [64, '03']),
    ]);
    expect(conveyances[0].bills[0].dispositions[0]).toMatchObject({ code: '22', releaseDate: '111726', releaseOrigin: '03' });
    expect(conveyances[0].bills[0].isfOnFile).toBeUndefined();
  });

  it('keeps one bill when WR4 repeats for each in-bond posted to it, latest first', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
      wr4({ inbond: '987654321', master: '123456789', qty: '00000250', issuer: 'MAEU', type: '0' }),
      wr4({ inbond: '987654310', master: '123456789', qty: '00000250', issuer: 'MAEU', type: '0' }),
      wr5('111626', '0915', '1D', 'IN-BOND MOVEMENT AUTHORIZED'),
      rec([1, 'WN1'], [4, '987654321'], [16, '2704'], [28, '2704'], [32, '3901']),
    ]);
    expect(conveyances[0].bills).toHaveLength(1);
    expect(conveyances[0].bills[0].inbonds).toEqual([{ inbondNumber: '987654321' }, { inbondNumber: '987654310' }]);
    expect(conveyances[0].bills[0].ports[0]).toMatchObject({ inbondNumber: '987654321', inbondOriginatingPort: '2704', manifestedInbondDestinationPort: '3901' });
  });

  it('reads truck trip number 4-28 and FIRMS code 77-80 from WR2', () => {
    const { conveyances } = parseManifestQueryResponse([wr1('ABCD', '', 'T1234', '111526'), rec([1, 'WR2'], [4, 'TRIP0000000001'], [77, 'Y123'])]);
    expect(conveyances[0]).toMatchObject({ carrierCode: 'ABCD', truckTripNumber: 'TRIP0000000001', firmsCode: 'Y123' });
    expect(conveyances[0].conveyanceName).toBeUndefined();
  });
});

// ── In-bond status (ACMQ-29, ACMQ-32) ──────────────────────

describe('parseManifestQueryResponse in-bonds', () => {
  // WS4 / WS5: status 4-5, arrival 6-11, export 12-17, entry type 76-77.
  it('reads the in-bond level status (WS4) ahead of the bills', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
      rec([1, 'WS4'], [4, 'AR'], [6, '111826'], [12, '000000'], [76, '61']),
      wr4({ inbond: '987654321', master: '123456789', qty: '00000250', issuer: 'MAEU', type: '0' }),
    ]);
    expect(conveyances[0].inbondStatus).toEqual({ status: 'AR', arrivalDate: '111826', exportDate: undefined, entryType: '61' });
    expect(conveyances[0].bills[0].inbonds).toEqual([{ inbondNumber: '987654321' }]);
  });

  it('pairs each WR4 with its WS5 when the bills on an in-bond differ in status', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('MAEU', 'MAERSK ESSEX', '432W', '111526'),
      wr4({ inbond: '987654321', master: '111111111', qty: '00000010', issuer: 'MAEU', type: '0' }),
      rec([1, 'WS5'], [4, 'ER'], [6, '000000'], [12, '000000'], [76, '62']),
      wr4({ inbond: '987654321', master: '222222222', qty: '00000020', issuer: 'MAEU', type: '0' }),
      rec([1, 'WS5'], [4, 'EX'], [6, '111826'], [12, '112026'], [76, '62']),
    ]);
    expect(conveyances[0].bills.map((b) => b.masterBillNumber)).toEqual(['111111111', '222222222']);
    expect(conveyances[0].bills[0].inbonds).toEqual([{ inbondNumber: '987654321', status: 'ER', arrivalDate: undefined, exportDate: undefined, entryType: '62' }]);
    expect(conveyances[0].bills[1].inbonds[0]).toMatchObject({ status: 'EX', arrivalDate: '111826', exportDate: '112026' });
  });
});

// ── Air loops (ACMQ-16..17, ACMQ-34..38) ───────────────────

describe('parseManifestQueryResponse air waybills', () => {
  // WSC: carrier 4-6, flight 7-11, arrival 12-17, waybill 18-28, part 29, qty 30-34, boarded 35-39,
  // house 40-51, house part 52, house qty 53-57, house boarded 58-62, in-bond 63-73, status 74-75, type 76-77, version 80.
  const wsc = (o: { house?: string; houseQty?: string; inbond?: string; status?: string }) =>
    rec([1, 'WSC'], [4, 'DL'], [7, '0123'], [12, '111526'], [18, '00612345675'], [30, '00040'], [40, o.house ?? ''], [53, o.houseQty ?? ''], [63, o.inbond ?? ''], [74, o.status ?? ''], [80, '1']);
  // WSD: date 4-9, time 10-15, code 16-17, narrative 18-57, in-bond or entry 58-69.
  const wsd = (code: string, narrative: string, ref = '') => rec([1, 'WSD'], [4, '111526'], [10, '142500'], [16, code], [18, narrative], [58, ref]);

  it('reads the master then one group per house air waybill', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('DL', 'DL0123111526', '0123', '111526'),
      rec([1, 'WR2'], [77, 'W123']),
      wsc({}),
      wsd('1C', 'ENTERED GENERAL EXAM NOT REQUIRED', 'S7P12345678'),
      rec([1, 'WN1'], [16, '3001']),
      wsc({ house: 'HAWB0001', houseQty: '00015' }),
      wsd('1H', 'HOLD PLACED'),
      wsc({ house: 'HAWB0002', houseQty: '00025' }),
    ]);
    expect(conveyances).toHaveLength(1);
    expect(conveyances[0]).toMatchObject({ carrierCode: 'DL', conveyanceName: 'DL0123111526', firmsCode: 'W123' });
    const [master, h1, h2] = conveyances[0].bills;
    expect(master).toMatchObject({
      kind: 'air',
      importingCarrierCode: 'DL',
      flightNumber: '0123',
      scheduledArrivalDate: '111526',
      airWaybillNumber: '00612345675',
      manifestQuantity: 40,
    });
    expect(master.houseAirWaybillNumber).toBeUndefined();
    expect(master.dispositions).toEqual([
      { date: '111526', time: '142500', code: '1C', narrative: 'ENTERED GENERAL EXAM NOT REQUIRED', inbondOrEntryNumber: 'S7P12345678' },
    ]);
    expect(master.ports).toEqual([{ manifestedPortOfUnlading: '3001', vesselDepartureDate: undefined }]);
    expect(h1).toMatchObject({ houseAirWaybillNumber: 'HAWB0001', houseManifestQuantity: 15 });
    expect(h1.dispositions.map((d) => d.code)).toEqual(['1H']);
    expect(h2).toMatchObject({ houseAirWaybillNumber: 'HAWB0002', houseManifestQuantity: 25, dispositions: [] });
  });

  it('keeps one waybill when WSC repeats for each in-bond posted to it', () => {
    const { conveyances } = parseManifestQueryResponse([
      wr1('DL', 'DL0123111526', '0123', '111526'),
      wsc({ inbond: '00612345675', status: 'ER' }),
      wsc({ inbond: '987654321', status: 'AR' }),
      wsd('1D', 'IN-BOND MOVEMENT AUTHORIZED'),
    ]);
    expect(conveyances[0].bills).toHaveLength(1);
    expect(conveyances[0].bills[0].inbonds).toEqual([
      { inbondNumber: '00612345675', status: 'ER', entryType: undefined },
      { inbondNumber: '987654321', status: 'AR', entryType: undefined },
    ]);
  });

  it('reads a right-justified house air waybill from the pre-2020 record version (Note 5)', () => {
    const { conveyances } = parseManifestQueryResponse([rec([1, 'WSC'], [4, 'DL'], [7, '0123'], [12, '111526'], [18, '00612345675'], [30, '00040'], [44, 'HAWB0001'])]);
    expect(conveyances[0].bills[0].houseAirWaybillNumber).toBe('HAWB0001');
  });
});

// ── Entry status and envelope ──────────────────────────────

describe('parseManifestQueryResponse entry status', () => {
  it('keeps the WO entry-status records raw', () => {
    const wo10 = rec([1, 'WO10'], [5, '2704'], [9, 'S7P'], [14, '12345678'], [23, '01']);
    const { entryStatusLines, conveyances } = parseManifestQueryResponse([wo10, rec([1, 'WO60'], [5, '111626'], [15, '98'], [17, 'RELEASED'])]);
    expect(entryStatusLines).toHaveLength(2);
    expect(entryStatusLines[0]).toBe(wo10);
    expect(conveyances).toEqual([]);
  });
});

describe('parseManifestQueryResponseBatch', () => {
  it('parses a full C1 wire response through the envelope', () => {
    const wire = [
      'A   LGB1S7PSECRET111526     C1'.padEnd(80, ' '),
      'B  2704S7PC1'.padEnd(80, ' '),
      rec([1, 'WSA'], [16, 'MAEU'], [20, '123456789'], [32, '122'], [35, 'BILL NBR NOT ON FILE']),
      'Y  2704S7PC1'.padEnd(80, ' '),
      'Z   LGB1S7P      111526'.padEnd(80, ' '),
    ];
    const result = parseManifestQueryResponseBatch(wire);
    expect(result.batchRejected).toBe(false);
    expect(result.response.errors[0].code).toBe('122');
  });
});
