/**
 * In-Bond (QP/QT + WP/WT + NS) tests — positions and formats asserted
 * against the CATAIR In-Bond chapter, Amendment 51, April 2026 (INB page
 * refs in comments).
 */
import { describe, it, expect } from 'vitest';
import {
  buildInbond,
  buildInbondEvent,
  type InbondAddInput,
  type InbondEventInput,
} from '../inbond/builder.js';
import {
  computeInbondCheckDigit,
  formatInbondNumber,
  isAcceptableInbondNumber,
} from '../inbond/checkDigit.js';
import {
  parseInbondResponse,
  parseInbondResponseBatch,
  parseInbondEventResponse,
  parseInbondEventResponseBatch,
  parseInbondStatus,
  parseInbondStatusBatch,
  parseInbondStructureRejects,
} from '../inbond/responseParser.js';
import {
  QP10, QP20, QP30, QT95, WP10, WP20, WT95,
  NS05, NS10, NS30, NS40, NS50, NS60, EA, EB, EY, EZ,
} from '../inbond/recordDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { buildBatch } from '../envelope/batch.js';

const sp = (n: number) => ' '.repeat(n);

// ── Fixtures ───────────────────────────────────────────────

/**
 * Full QP-Long: T&E 62, FTZ off, one bill, 2 containers. Container 1's
 * cargo groups reproduce the chapter's printed Example 2 (INB-11):
 * QP65, 70 71 72, 70 71 72 72, 70 71 71 72.
 */
const QP_LONG: InbondAddInput = {
  kind: 'add',
  entryType: '62',
  inBondNumber: '123456782', // 12345678 % 7 = 2
  carrierCode: 'MAEU',
  usPortOfDestination: '2704',
  portOfForeignDestination: '57069',
  valueDollars: 25000,
  bondedCarrierId: '12-3456789',
  btaIndicator: 'Y',
  conveyance: {
    importingCarrierCode: 'MAEU',
    importMotCode: '10',
    countryCode: 'DK',
    conveyanceName: 'MAERSK ESSEX',
    voyageFlightTripNumber: '221E',
    portOfArrival: '2704',
    estimatedDateOfArrival: '080126', // MMDDYY
  },
  bills: [
    {
      sequenceNumber: '0001',
      issuerCode: 'MAEU',
      billNumber: '123456789012',
      secondaryNotifyParties: ['2704ABC01'], // ourselves, to receive NS (INB-29)
      references: [{ qualifier: 'BM', value: 'MAEU123456789012' }],
      details: {
        foreignPortOfLading: '57069',
        manifestQuantity: 25, // 9 + 5 + 4 + 3 + 4 (INB-48)
        manifestUnits: 'CTNS',
        weight: 12500,
        weightUnit: 'KG',
        foreignShipper: {
          name: 'SHENZHEN GADGET WORKS',
          addressLine1: '88 NANSHAN ROAD',
          addressLine2: 'BUILDING 4',
          addressLine3: 'SHENZHEN',
          telephoneOrTelex: '8675530901',
        },
        consignee: {
          name: 'ACME IMPORTS LLC',
          addressLine1: '100 MAIN ST',
          addressLine2: 'LOS ANGELES CA 90001',
        },
        notifyParties: [
          { name: 'GLOBAL NOTIFY CO', addressLine1: 'KADE 12', addressLine2: 'ROTTERDAM' },
        ],
        containers: [
          {
            containerNumber: 'MSKU1234567',
            sealNumber1: 'SEAL001',
            descriptionCode: '20',
            cargo: [
              {
                commodities: [{ htsNumber: '8507600020', valueDollars: 12000, weight: 4000, weightUnit: 'KG' }],
                descriptions: [{ pieceCount: 9, description: 'PLASTIC TOYS', manifestUnitCode: 'CTN' }],
                marksAndNumbers: ['ACME PO 4501'],
              },
              {
                commodities: [{ htsNumber: '850650', valueDollars: 3000, weight: 800, weightUnit: 'KG' }],
                descriptions: [{ pieceCount: 5, description: 'TEXTILE PIECES', manifestUnitCode: 'BAL' }],
                marksAndNumbers: ['NO MARKS', 'ADDR MARKS 2'],
              },
              {
                commodities: [{ htsNumber: '392690', valueDollars: 1500, weight: 600, weightUnit: 'LB' }],
                descriptions: [
                  { pieceCount: 4, description: 'STEEL WIRE COILS' },
                  { pieceCount: 3, description: 'STEEL WIRE COILS PART TWO' },
                ],
                marksAndNumbers: ['COIL LOT 9'],
              },
            ],
          },
          {
            containerNumber: 'MSKU7654321',
            cargo: [
              {
                commodities: [{ htsNumber: '640299', valueDollars: 8500, weight: 7100, weightUnit: 'KG' }],
                descriptions: [{ pieceCount: 4, description: 'SPORT FOOTWEAR', manifestUnitCode: 'CTN' }],
                marksAndNumbers: ['NIKE 22'],
              },
            ],
            hazmat: [
              {
                code: 'UN1266',
                hazmatClass: '3',
                codeQualifier: 'I',
                description: 'PERFUMERY PRODUCTS',
                contact: 'HAZMAT DESK 5550100',
                flashpointTemperature: 23,
                continuations: [{ description: 'FLAMMABLE LIQUID', classification: 'CLASS 3' }],
              },
            ],
          },
        ],
      },
    },
  ],
};

/** QP-Short: IT 61 against an existing bill, partial quantity. */
const QP_SHORT: InbondAddInput = {
  kind: 'add',
  entryType: '61',
  inBondNumber: '876543216', // 87654321 % 7 = 6
  carrierCode: 'MAEU',
  usPortOfDestination: '3901',
  valueDollars: 5000,
  bondedCarrierId: '12-3456789',
  btaIndicator: 'N',
  bills: [
    {
      issuerCode: 'MAEU',
      billNumber: 'ABC123',
      previousInBondNumber: '123456782',
      inBondQuantity: 10,
      secondaryNotifyParties: ['2704ABC01'],
    },
  ],
};

// ── Input record layouts (exact 80-char assertions) ────────

describe('In-bond QP record layouts', () => {
  const lines = buildInbond(QP_LONG);
  const find = (id: string, nth = 0) => lines.filter((l) => l.startsWith(id))[nth];

  it('lays out the QP10 header per INB-19..20', () => {
    const expected =
      '10' + 'A' + '62' + '123456782' + sp(3) + 'MAEU' + '2704' + '57069' +
      '00025000' + '12-3456789' + sp(2) + ' ' + 'Y' + sp(28);
    expect(expected).toHaveLength(80);
    expect(lines[0]).toBe(expected);
  });

  it('lays out the QP20 conveyance per INB-23..24', () => {
    const expected =
      '20' + 'MAEU' + '10' + 'DK' + 'MAERSK ESSEX' + sp(11) + '221E' + sp(1) +
      sp(7) + '2704' + '080126' + sp(4) + sp(21);
    expect(expected).toHaveLength(80);
    expect(lines[1]).toBe(expected);
  });

  it('lays out the QP30 bill header per INB-26..27', () => {
    const expected =
      '30' + 'A' + ' ' + '0001' + 'MAEU' + '123456789012' +
      sp(4) + sp(12) + sp(4) + sp(12) + sp(12) + sp(10) + sp(2);
    expect(expected).toHaveLength(80);
    expect(find('30')).toBe(expected);
  });

  it('lays out the QP32 secondary notify parties per INB-29', () => {
    const expected = '32' + '2704ABC01' + sp(9) + sp(9) + sp(9) + sp(42);
    expect(expected).toHaveLength(80);
    expect(find('32')).toBe(expected);
  });

  it('lays out the QP33 reference per INB-30', () => {
    const expected = '33' + 'BM ' + 'MAEU123456789012' + sp(14) + sp(45);
    expect(expected).toHaveLength(80);
    expect(find('33')).toBe(expected);
  });

  it('lays out the QP40 bill details with zero-filled 10N quantities per INB-32..33', () => {
    const expected =
      '40' + '57069' + '0000000025' + 'CTNS ' + '0000012500' + 'KG' +
      sp(10) + sp(2) + sp(17) + sp(17);
    expect(expected).toHaveLength(80);
    expect(find('40')).toBe(expected);
  });

  it('lays out the QP50/51/52 foreign shipper grouping per INB-35..37', () => {
    const qp50 = '50' + 'SHENZHEN GADGET WORKS' + sp(14) + '88 NANSHAN ROAD' + sp(20) + sp(8);
    const qp51 = '51' + 'BUILDING 4' + sp(25) + 'SHENZHEN' + sp(27) + sp(8);
    const qp52 = '52' + '8675530901' + sp(25) + sp(43);
    for (const e of [qp50, qp51, qp52]) expect(e).toHaveLength(80);
    expect(find('50')).toBe(qp50);
    expect(find('51')).toBe(qp51);
    expect(find('52')).toBe(qp52);
  });

  it('lays out the QP55/56 consignee grouping per INB-38..39', () => {
    const qp55 = '55' + 'ACME IMPORTS LLC' + sp(19) + '100 MAIN ST' + sp(24) + sp(8);
    const qp56 = '56' + 'LOS ANGELES CA 90001' + sp(15) + sp(35) + sp(8);
    for (const e of [qp55, qp56]) expect(e).toHaveLength(80);
    expect(find('55')).toBe(qp55);
    expect(find('56')).toBe(qp56);
  });

  it('lays out the QP60/61 notify party grouping per INB-41..42', () => {
    const qp60 = '60' + 'GLOBAL NOTIFY CO' + sp(19) + 'KADE 12' + sp(28) + sp(8);
    const qp61 = '61' + 'ROTTERDAM' + sp(26) + sp(35) + sp(8);
    for (const e of [qp60, qp61]) expect(e).toHaveLength(80);
    expect(find('60')).toBe(qp60);
    expect(find('61')).toBe(qp61);
  });

  it('lays out the QP65 container per INB-44', () => {
    const expected = '65' + 'MSKU1234567' + sp(3) + 'SEAL001' + sp(8) + sp(15) + '20' + sp(32);
    expect(expected).toHaveLength(80);
    expect(find('65')).toBe(expected);
  });

  it('lays out the QP70 with a left-justified 10N HTS per INB-45..46', () => {
    const full = '70' + '8507600020' + ' ' + '00012000' + '0000004000' + 'KG' + sp(47);
    const sixDigit = '70' + '850650' + sp(4) + ' ' + '00003000' + '0000000800' + 'KG' + sp(47);
    expect(full).toHaveLength(80);
    expect(sixDigit).toHaveLength(80);
    expect(find('70')).toBe(full);
    expect(find('70', 1)).toBe(sixDigit);
  });

  it('lays out the QP71 cargo description per INB-47', () => {
    const withUnit = '71' + '0000000009' + 'PLASTIC TOYS' + sp(33) + 'CTN' + sp(20);
    const withoutUnit = '71' + '0000000003' + 'STEEL WIRE COILS PART TWO' + sp(20) + sp(3) + sp(20);
    expect(withUnit).toHaveLength(80);
    expect(withoutUnit).toHaveLength(80);
    expect(find('71')).toBe(withUnit);
    expect(find('71', 3)).toBe(withoutUnit);
  });

  it('lays out the QP72 marks and numbers per INB-49', () => {
    const expected = '72' + 'ACME PO 4501' + sp(33) + sp(33);
    expect(expected).toHaveLength(80);
    expect(find('72')).toBe(expected);
  });

  it('lays out the QP75/76 hazmat grouping per INB-50..52', () => {
    const qp75 =
      '75' + 'UN1266' + sp(4) + '3' + sp(3) + 'I' + 'PERFUMERY PRODUCTS' + sp(12) +
      'HAZMAT DESK 5550100' + sp(5) + '023' + 'CE' + ' ' + sp(3);
    const qp76 = '76' + 'FLAMMABLE LIQUID' + sp(13) + 'CLASS 3' + sp(23) + sp(19);
    expect(qp75).toHaveLength(80);
    expect(qp76).toHaveLength(80);
    expect(find('75')).toBe(qp75);
    expect(find('76')).toBe(qp76);
  });
});

describe('In-bond WP / output record layouts', () => {
  it('lays out the WP10 event header per INB-54..55', () => {
    const [wp10] = buildInbondEvent({
      action: '3',
      entryType: '62',
      inBondNumber: '123456782',
      billIssuerCode: 'MAEU',
      billNumber: '123456789012',
      firmsCode: 'F123',
      containerNumber: 'MSKU1234567',
      date: '260810',
      time: '143000',
      port: '2704',
    });
    const expected =
      '10' + '3' + '123456782' + sp(3) + 'MAEU' + '123456789012' + sp(4) + sp(12) +
      'F123' + sp(12) + 'MSKU1234567' + sp(3) + sp(3);
    expect(expected).toHaveLength(80);
    expect(wp10).toBe(expected);
  });

  it('lays out the WP20 event detail per INB-57..58', () => {
    const [, wp20] = buildInbondEvent({
      action: '1',
      entryType: '61',
      inBondNumber: '123456782',
      firmsCode: 'F123',
      date: '260810',
      time: '143000',
      port: '2704',
    });
    const expected = '20' + '260810' + '143000' + '2704' + sp(4) + sp(12) + sp(19) + sp(2) + sp(2) + sp(23);
    expect(expected).toHaveLength(80);
    expect(wp20).toBe(expected);
  });

  it('lays out the QT95/WT95 accept-reject per INB-53/59', () => {
    const expected = '95' + '01' + 'A01' + ' ' + 'BILL NOT ON FILE' + sp(23) + sp(33);
    expect(expected).toHaveLength(80);
    expect(
      writeRecord(QT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'A01', narrativeMessage: 'BILL NOT ON FILE' }),
    ).toBe(expected);
    expect(
      writeRecord(WT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'A01', narrativeMessage: 'BILL NOT ON FILE' }),
    ).toBe(expected);
  });

  it('lays out the NS05 conveyance header per INB-60', () => {
    const expected = '05' + 'MAERSK ESSEX' + sp(11) + '00221' + '2704' + '260810' + '143000' + sp(34);
    expect(expected).toHaveLength(80);
    expect(
      writeRecord(NS05, {
        conveyanceName: 'MAERSK ESSEX',
        voyageTripNumber: '00221',
        districtPort: '2704',
        estimatedDateOfArrival: '260810',
        estimatedTimeOfArrival: '143000',
      }),
    ).toBe(expected);
  });

  it('lays out the NS10 in-bond header per INB-61', () => {
    const expected = '10' + '62' + '123456782' + sp(3) + '2704' + '57069' + sp(55);
    expect(expected).toHaveLength(80);
    expect(
      writeRecord(NS10, {
        inBondEntryType: '62',
        inBondNumber: '123456782',
        usPortOfDestination: '2704',
        foreignDestination: '57069',
      }),
    ).toBe(expected);
  });

  it('lays out the NS30 status detail per INB-64..65', () => {
    const expected =
      '30' + '1C' + 'MAEU' + '123456789012' + sp(4) + sp(12) + sp(4) + sp(12) +
      '0000000025' + ' ' + '260810' + '1430' + 'MAEU' + sp(3);
    expect(expected).toHaveLength(80);
    expect(
      writeRecord(NS30, {
        dispositionCode: '1C',
        billIssuerCode: 'MAEU',
        billNumber: '123456789012',
        quantity: '0000000025',
        actionDate: '260810',
        actionTime: '1430',
        inBondCarrierCode: 'MAEU',
      }),
    ).toBe(expected);
  });

  it('lays out the NS40/NS50/NS60 records per INB-66..68', () => {
    const ns40 = '40' + '01' + '30412345671' + sp(4) + '2704' + 'F123' + 'MSKU1234567' + sp(3) + sp(39);
    const ns50 = '50' + 'IN-BOND EXPORTED' + sp(29) + sp(33);
    const ns60 = '60' + '1' + 'MSKU1234567' + sp(3) + 'SEAL001' + sp(8) + sp(15) + sp(33);
    for (const e of [ns40, ns50, ns60]) expect(e).toHaveLength(80);
    expect(
      writeRecord(NS40, {
        entryType: '01',
        entryNumber: '30412345671',
        districtPortOfTransaction: '2704',
        firmsCode: 'F123',
        containerNumber: 'MSKU1234567',
      }),
    ).toBe(ns40);
    expect(writeRecord(NS50, { remarks: 'IN-BOND EXPORTED' })).toBe(ns50);
    expect(
      writeRecord(NS60, { actionIndicator: '1', containerNumber: 'MSKU1234567', sealNumber1: 'SEAL001' }),
    ).toBe(ns60);
  });

  it('lays out the EA/EB/EY/EZ structure rejects per INB-69..72', () => {
    const narrative = 'TRANSACTION COUNT MISMATCH';
    for (const [def, letter] of [[EA, 'A'], [EB, 'B'], [EY, 'Y'], [EZ, 'Z']] as const) {
      const expected = 'E' + letter + narrative + sp(14) + sp(38);
      expect(expected).toHaveLength(80);
      expect(writeRecord(def, { narrativeMessage: narrative })).toBe(expected);
    }
  });
});

// ── QP structure (usage maps INB-10..14) ───────────────────

describe('buildInbond — QP-Long', () => {
  it("emits the full map with container 1's cargo groups in the printed Example 2 sequence (INB-11)", () => {
    const lines = buildInbond(QP_LONG);
    expect(lines.map((l) => l.slice(0, 2))).toEqual([
      '10', '20', '30', '32', '33', '40',
      '50', '51', '52', // foreign shipper
      '55', '56', // consignee
      '60', '61', // notify party
      // container 1 — Example 2 (INB-11)
      '65',
      '70', '71', '72',
      '70', '71', '72', '72',
      '70', '71', '71', '72',
      // container 2, with trailing hazmat (Note 3, INB-11..12)
      '65', '70', '71', '72', '75', '76',
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });
});

describe('buildInbond — QP-Short and deletes', () => {
  it('emits only QP10/QP30/QP32 for an in-bond against an existing bill (INB-13)', () => {
    const lines = buildInbond(QP_SHORT);
    expect(lines.map((l) => l.slice(0, 2))).toEqual(['10', '30', '32']);
    expect(lines[0]).toBe(
      '10' + 'A' + '61' + '876543216' + sp(3) + 'MAEU' + '3901' + sp(5) +
      '00005000' + '12-3456789' + sp(2) + ' ' + 'N' + sp(28),
    );
    // Previous in-bond number and partial quantity ride the QP30 (INB-27).
    expect(lines[1]).toBe(
      '30' + 'A' + ' ' + sp(4) + 'MAEU' + 'ABC123' + sp(6) +
      sp(4) + sp(12) + sp(4) + sp(12) + '123456782' + sp(3) + '0000000010' + sp(2),
    );
  });

  it("emits QP10 'B' + QP30 'D' for a bill-level delete (INB-13 Note 4)", () => {
    const lines = buildInbond({
      kind: 'deleteBill',
      inBondNumber: '123456782',
      bills: [{ issuerCode: 'MAEU', billNumber: '123456789012' }],
    });
    expect(lines).toEqual([
      ('10' + 'B' + sp(2) + '123456782').padEnd(80, ' '),
      ('30' + 'D' + ' ' + sp(4) + 'MAEU' + '123456789012').padEnd(80, ' '),
    ]);
  });

  it("emits a lone QP10 'D' for a whole-in-bond delete (INB-14 Note 4A)", () => {
    const lines = buildInbond({ kind: 'delete', inBondNumber: '123456782' });
    expect(lines).toEqual([('10' + 'D' + sp(2) + '123456782').padEnd(80, ' ')]);
  });

  it('rejects deletes whose in-bond number has an invalid MOD-7 check digit', () => {
    expect(() => buildInbond({ kind: 'delete', inBondNumber: '123456780' })).toThrow(RecordCodecError);
    expect(() => buildInbond({ kind: 'delete', inBondNumber: 'V12345678' })).toThrow(/conventional/);
  });
});

describe('buildInbond — FTZ withdrawal (QP10 flag Y)', () => {
  const FTZ: InbondAddInput = {
    kind: 'add',
    entryType: '61',
    inBondNumber: '123456782',
    carrierCode: 'F123',
    usPortOfDestination: '3901',
    valueDollars: 800,
    bondedCarrierId: '12-3456789',
    ftzWithdrawal: true,
    btaIndicator: 'N',
    conveyance: {
      importingCarrierCode: 'F123',
      importMotCode: '30', // FTZ withdrawals use Truck (INB-24)
      voyageFlightTripNumber: '1',
      portOfArrival: '2704',
      ftzFirmsCode: 'F123',
    },
    bills: [
      {
        issuerCode: 'F123',
        billNumber: 'FTZ0001',
        details: {
          foreignPortOfLading: '99999', // FTZ-only value (QP40 Note 1, INB-34)
          manifestQuantity: 3,
          manifestUnits: 'CTNS',
          weight: 100,
          weightUnit: 'KG',
          foreignShipper: { name: 'ZONE OPERATOR LLC', addressLine1: '1 ZONE WAY' },
          consignee: { name: 'ACME IMPORTS LLC', addressLine1: '100 MAIN ST' },
          containers: [
            { containerNumber: 'NC', cargo: [{ descriptions: [{ pieceCount: 3, description: 'FTZ GOODS' }] }] },
          ],
        },
      },
    ],
  };

  it('forces the long form and sets the QP10 indicator + QP20 FIRMS', () => {
    const lines = buildInbond(FTZ);
    expect(lines.map((l) => l.slice(0, 2))).toEqual(['10', '20', '30', '40', '50', '55', '65', '71']);
    expect(lines[0][50]).toBe('Y'); // QP10 position 51 (INB-20)
    expect(lines[1].slice(55, 59)).toBe('F123'); // QP20 positions 56-59 (INB-24)
  });

  it('enforces FIRMS consistency across QP10/QP20 (Note 2, INB-25)', () => {
    expect(() =>
      buildInbond({ ...FTZ, conveyance: { ...FTZ.conveyance!, ftzFirmsCode: 'F999' } }),
    ).toThrow(/must match the QP10 carrier code/);
  });

  it("requires '99999' as the foreign port of lading — and only for FTZ (QP40 Note 1)", () => {
    const details = FTZ.bills[0].details!;
    expect(() =>
      buildInbond({ ...FTZ, bills: [{ ...FTZ.bills[0], details: { ...details, foreignPortOfLading: '57069' } }] }),
    ).toThrow(/99999/);
    expect(() =>
      buildInbond({
        ...QP_LONG,
        bills: [{ ...QP_LONG.bills[0], details: { ...QP_LONG.bills[0].details!, foreignPortOfLading: '99999' } }],
      }),
    ).toThrow(/only be used when the FTZ flag is set/);
  });

  it('requires full bill details on every bill of an FTZ withdrawal', () => {
    expect(() =>
      buildInbond({ ...FTZ, bills: [{ issuerCode: 'F123', billNumber: 'FTZ0001' }] }),
    ).toThrow(/full bill of lading information/);
  });
});

describe('buildInbond — chapter rules', () => {
  const withLong = (patch: Partial<InbondAddInput>): InbondAddInput => ({ ...QP_LONG, ...patch });

  it('requires the foreign destination for 62/63 and forbids it for 61 (INB-20)', () => {
    expect(() => buildInbond(withLong({ portOfForeignDestination: undefined }))).toThrow(/foreign destination is required/);
    expect(() => buildInbond({ ...QP_SHORT, portOfForeignDestination: '47519' })).toThrow(/IT '61'/);
  });

  it('requires a value greater than zero (INB-20)', () => {
    expect(() => buildInbond(withLong({ valueDollars: 0 }))).toThrow(/greater than zero/);
  });

  it("forces the BTA indicator to 'N' for IE 63 shipments (QP10 Note 3)", () => {
    expect(() =>
      buildInbond(withLong({ entryType: '63', btaIndicator: 'Y' })),
    ).toThrow(/must be 'N'/);
  });

  it('requires the QP70 record when creating bills for entry types 62/63 (INB-11 Note 2)', () => {
    const details = QP_LONG.bills[0].details!;
    const noCommodities = {
      ...details,
      containers: [
        {
          containerNumber: 'MSKU1234567',
          cargo: [{ descriptions: [{ pieceCount: 25, description: 'GOODS' }] }],
        },
      ],
    };
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], details: noCommodities }] })),
    ).toThrow(/QP70 harmonized record is mandatory/);
  });

  it('requires the QP71 piece counts to total the QP40 manifest quantity (INB-48)', () => {
    const details = QP_LONG.bills[0].details!;
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], details: { ...details, manifestQuantity: 24 } }] })),
    ).toThrow(/piece counts total 25 but the QP40 manifest quantity is 24/);
  });

  it("requires a piece count on a container's first QP71 record (INB-47)", () => {
    const details = QP_LONG.bills[0].details!;
    const firstNoCount = {
      ...details,
      containers: [
        {
          containerNumber: 'MSKU1234567',
          cargo: [
            {
              commodities: [{ htsNumber: '640299', valueDollars: 100, weight: 10, weightUnit: 'KG' as const }],
              descriptions: [{ description: 'GOODS' }],
            },
          ],
        },
      ],
    };
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], details: firstNoCount }] })),
    ).toThrow(/piece count is mandatory/);
  });

  it('rejects a master air waybill posted without its house bill (QP30 Note 1, INB-28)', () => {
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], isMasterAirBill: true }] })),
    ).toThrow(/master air waybill without its house bill/);
  });

  it('keeps the partial in-bond quantity out of QP-Long bills and Air in-bonds (INB-27..28)', () => {
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], inBondQuantity: 5 }] })),
    ).toThrow(/EXISTING bill/);
    expect(() =>
      buildInbond({
        ...QP_SHORT,
        conveyance: { importingCarrierCode: 'DLH', importMotCode: '40', portOfArrival: '3901' },
      }),
    ).toThrow(/partial quantities are not permitted/);
  });

  it('requires the QP20 conveyance for QP-Long bills that were not imported (INB-23)', () => {
    expect(() => buildInbond(withLong({ conveyance: undefined }))).toThrow(/QP20 conveyance record is required/);
  });

  it('rejects unknown reference qualifiers and oversized SNP lists (INB-29..30)', () => {
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], references: [{ qualifier: 'QQ', value: 'X' }] }] })),
    ).toThrow(/unknown reference identifier qualifier/);
    expect(() =>
      buildInbond(withLong({ bills: [{ ...QP_LONG.bills[0], secondaryNotifyParties: ['A', 'B', 'C', 'D', 'E'] }] })),
    ).toThrow(/at most 4 secondary notify parties/);
  });

  it('requires the telephone record to follow an address record (INB-37)', () => {
    const details = QP_LONG.bills[0].details!;
    expect(() =>
      buildInbond(
        withLong({
          bills: [
            {
              ...QP_LONG.bills[0],
              details: {
                ...details,
                foreignShipper: { name: 'X CORP', addressLine1: '1 WAY', telephoneOrTelex: '5550100' },
              },
            },
          ],
        }),
      ),
    ).toThrow(/telephone record must follow an address record/);
  });
});

// ── Check digit (WP10 Note 2 / NS10 Note 2, INB-56/62) ─────

describe('in-bond MOD-7 check digit', () => {
  it('computes the remainder of the 8-digit sequence divided by 7', () => {
    expect(computeInbondCheckDigit('12345678')).toBe(2);
    expect(computeInbondCheckDigit('87654321')).toBe(6);
    expect(computeInbondCheckDigit('00000007')).toBe(0);
    expect(() => computeInbondCheckDigit('1234567')).toThrow(/8 digits/);
  });

  it('formats 8-digit sequences and validates 9-digit numbers strictly', () => {
    expect(formatInbondNumber('12345678')).toBe('123456782');
    expect(formatInbondNumber('123456782')).toBe('123456782');
    expect(() => formatInbondNumber('123456783')).toThrow(/expected 2 \(MOD-7\)/);
  });

  it('accepts the high-volume-air +1/+2/+3 variant on parse only (WP10 Note 2)', () => {
    expect(isAcceptableInbondNumber('123456782')).toBe(true); // MOD-7
    expect(isAcceptableInbondNumber('123456783')).toBe(true); // +1
    expect(isAcceptableInbondNumber('123456785')).toBe(true); // +3
    expect(isAcceptableInbondNumber('123456786')).toBe(false); // +4
    expect(isAcceptableInbondNumber('123456781')).toBe(false); // -1
    expect(isAcceptableInbondNumber('12345678')).toBe(false); // not 9 digits
    // Never generated: the QP builder stays strict.
    expect(() => buildInbond({ kind: 'delete', inBondNumber: '123456783' })).toThrow(RecordCodecError);
  });
});

// ── WP events (INB-14, INB-54..58) ─────────────────────────

describe('buildInbondEvent — WP builds', () => {
  it('builds an arrival (1) with FIRMS and port', () => {
    const lines = buildInbondEvent({
      action: '1', entryType: '62', inBondNumber: '123456782',
      firmsCode: 'F123', date: '260810', time: '143000', port: '2704',
    });
    expect(lines.map((l) => l.slice(0, 2))).toEqual(['10', '20']);
    // firms occupies WP10 positions 48-51 (INB-55)
    expect(lines[0]).toBe(('10' + '1' + '123456782').padEnd(47, ' ') + 'F123' + sp(12) + sp(14) + sp(3));
  });

  it('builds a bill-level export (6) with the optional MOT + conveyance pair', () => {
    const lines = buildInbondEvent({
      action: '6', entryType: '62', billIssuerCode: 'MAEU', billNumber: '123456789012',
      date: '260810', time: '143000', exportMotCode: '10', exportConveyanceName: 'MAERSK ESSEX',
    });
    expect(lines[0]).toBe('10' + '6' + sp(12) + 'MAEU' + '123456789012' + sp(4) + sp(12) + sp(4) + sp(12) + sp(14) + sp(3));
    expect(lines[1]).toBe('20' + '260810' + '143000' + sp(4) + sp(4) + sp(12) + sp(19) + sp(2) + '10' + 'MAERSK ESSEX' + sp(11));
  });

  it('builds a transfer of liability (A) with carrier, bonded carrier, city and state', () => {
    const lines = buildInbondEvent({
      action: 'A', entryType: '61', inBondNumber: '123456782', date: '260810', time: '143000',
      inBondCarrierCode: 'ABCD', bondedCarrierId: '12-3456789', cityName: 'CHICAGO', stateCode: 'IL',
    });
    expect(lines[0]).toBe(('10' + 'A' + '123456782').padEnd(80, ' '));
    expect(lines[1]).toBe(
      '20' + '260810' + '143000' + sp(4) + 'ABCD' + '12-3456789' + sp(2) + 'CHICAGO' + sp(12) + 'IL' + sp(2) + sp(23),
    );
  });

  it('builds a diversion (Z) with the new port and bonded carrier', () => {
    const lines = buildInbondEvent({
      action: 'Z', entryType: '62', inBondNumber: '123456782', date: '260810', time: '143000',
      port: '3901', bondedCarrierId: '12-3456789',
    });
    expect(lines[0]).toBe(('10' + 'Z' + '123456782').padEnd(80, ' '));
    expect(lines[1]).toBe(
      '20' + '260810' + '143000' + '3901' + sp(4) + '12-3456789' + sp(2) + sp(19) + sp(2) + sp(2) + sp(23),
    );
  });

  it("accepts 'V' paperless and +1/+2/+3 air-variant in-bond numbers (INB-54/56)", () => {
    expect(() =>
      buildInbondEvent({ action: '1', inBondNumber: 'V12345678', firmsCode: 'F123', date: '260810', time: '143000', port: '2704' }),
    ).not.toThrow();
    expect(() =>
      buildInbondEvent({ action: '1', inBondNumber: '123456784', firmsCode: 'F123', date: '260810', time: '143000', port: '2704' }),
    ).not.toThrow();
  });
});

describe('buildInbondEvent — per-action rejections', () => {
  const base = { date: '260810', time: '143000' } as const;

  it('requires the in-bond number for actions 1/3/5/7/A/Z (INB-54)', () => {
    expect(() => buildInbondEvent({ action: '5', ...base })).toThrow(/in-bond number is mandatory/);
  });

  it('requires the bill for actions 2/3/6/7 (INB-54)', () => {
    expect(() =>
      buildInbondEvent({ action: '2', firmsCode: 'F123', port: '2704', ...base }),
    ).toThrow(/bill issuer and bill number are mandatory/);
  });

  it('requires the container for actions 3/7 (INB-55)', () => {
    expect(() =>
      buildInbondEvent({
        action: '7', inBondNumber: '123456782', billIssuerCode: 'MAEU', billNumber: '123456789012', ...base,
      }),
    ).toThrow(/container number is mandatory/);
  });

  it('requires FIRMS on arrival except for Air (INB-55)', () => {
    expect(() =>
      buildInbondEvent({ action: '1', inBondNumber: '123456782', port: '2704', ...base }),
    ).toThrow(/FIRMS code must be reported/);
    expect(() =>
      buildInbondEvent({ action: '1', inBondNumber: '123456782', port: '2704', air: true, ...base }),
    ).not.toThrow();
  });

  it('requires the port for arrivals and diversions (INB-57)', () => {
    expect(() =>
      buildInbondEvent({ action: 'Z', inBondNumber: '123456782', bondedCarrierId: '12-3456789', ...base }),
    ).toThrow(/port is mandatory/);
  });

  it('requires bonded carrier, carrier, city and state for a transfer (INB-57)', () => {
    const transfer: InbondEventInput = {
      action: 'A', inBondNumber: '123456782',
      inBondCarrierCode: 'ABCD', bondedCarrierId: '12-3456789', cityName: 'CHICAGO', stateCode: 'IL', ...base,
    };
    expect(() => buildInbondEvent({ ...transfer, bondedCarrierId: undefined })).toThrow(/bonded carrier ID/);
    expect(() => buildInbondEvent({ ...transfer, inBondCarrierCode: undefined })).toThrow(/carrier assuming liability/);
    expect(() => buildInbondEvent({ ...transfer, cityName: undefined })).toThrow(/city where the transfer/);
    expect(() => buildInbondEvent({ ...transfer, stateCode: undefined })).toThrow(/state code must also be provided/);
  });

  it('enforces export MOT/conveyance both-or-neither, exports only, vessel only (WP20 Note 2)', () => {
    const exportBase: InbondEventInput = { action: '5', inBondNumber: '123456782', ...base };
    expect(() => buildInbondEvent({ ...exportBase, exportMotCode: '10' })).toThrow(/both must be populated/);
    expect(() =>
      buildInbondEvent({ ...exportBase, exportMotCode: '30', exportConveyanceName: 'TRUCK 9' }),
    ).toThrow(/only for codes 10 and 11/);
    expect(() =>
      buildInbondEvent({
        action: '1', inBondNumber: '123456782', firmsCode: 'F123', port: '2704',
        exportMotCode: '10', exportConveyanceName: 'MAERSK ESSEX', ...base,
      }),
    ).toThrow(/apply only to export action codes/);
  });

  it('bans actions 3/7/A for Air (WP10 Note 1)', () => {
    expect(() =>
      buildInbondEvent({
        action: 'A', inBondNumber: '123456782', air: true,
        inBondCarrierCode: 'ABCD', bondedCarrierId: '12-3456789', cityName: 'CHICAGO', stateCode: 'IL', ...base,
      }),
    ).toThrow(/not used for Air/);
  });

  it('rejects lifecycle-invalid intents: 61 export, 63 arrive (WP10 Note 1, INB-56)', () => {
    expect(() =>
      buildInbondEvent({ action: '5', entryType: '61', inBondNumber: '123456782', ...base }),
    ).toThrow(/needs only to be arrived/);
    expect(() =>
      buildInbondEvent({ action: '1', entryType: '63', inBondNumber: '123456782', firmsCode: 'F123', port: '2704', ...base }),
    ).toThrow(/needs only to be exported/);
  });
});

// ── QT response parsing (INB-15..17) ───────────────────────

describe('parseInbondResponse', () => {
  const qtLines = [
    writeRecord(QP10, {
      actionCode: 'A', inBondEntryType: '62', inBondNumber: '123456782', inBondCarrierCode: 'MAEU',
      usPortOfDestination: '2704', portOfForeignDestination: '57069', value: '00025000',
      bondedCarrierId: '12-3456789', btaFdaIndicator: 'Y',
    }),
    writeRecord(QP20, { importingCarrierCode: 'MAEU', importMotCode: '10', portOfArrival: '2704' }),
    writeRecord(QP30, { actionCode: 'A', sequenceNumber: '0001', billIssuerCode: 'MAEU', billNumber: '123456789012' }),
    writeRecord(QT95, { narrativeMessageTypeCode: '02', narrativeMessageId: '001', narrativeMessage: 'IN-BOND ADDED TO BILL' }),
    writeRecord(QP30, { actionCode: 'A', sequenceNumber: '0002', billIssuerCode: 'MAEU', billNumber: '999999999999' }),
    writeRecord(QT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'B12', narrativeMessage: 'BILL NOT ON FILE' }),
    writeRecord(QT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'R99', narrativeMessage: 'BILL GROUPING REJECTED' }),
  ];

  it('attaches QT95s to the preceding record and derives per-bill dispositions (Notes 1/1B)', () => {
    const [response, ...rest] = parseInbondResponse(qtLines);
    expect(rest).toHaveLength(0);
    expect(response.actionCode).toBe('A');
    expect(response.inBondNumber).toBe('123456782');
    expect(response.entryType).toBe('62');
    expect(response.headerRecords.map((r) => r.recordId)).toEqual(['QP10', 'QP20']);
    expect(response.bills).toHaveLength(2);
    expect(response.bills[0]).toMatchObject({
      billNumber: '123456789012',
      sequenceNumber: '0001',
      accepted: true,
      disposition: { typeCode: '02', messageId: '001', narrative: 'IN-BOND ADDED TO BILL' },
    });
    expect(response.bills[1].accepted).toBe(false);
    expect(response.bills[1].echoedRecords[0].messages.map((m) => m.messageId)).toEqual(['B12', 'R99']);
    expect(response.bills[1].disposition?.narrative).toBe('BILL GROUPING REJECTED');
    expect(response.accepted).toBe(false);
  });

  it("puts the accept/reject on the in-bond itself for a 'D' delete (Note 1A)", () => {
    const lines = [
      writeRecord(QP10, { actionCode: 'D', inBondNumber: '123456782' }),
      writeRecord(QT95, { narrativeMessageTypeCode: '02', narrativeMessageId: 'D01', narrativeMessage: 'IN-BOND DELETED' }),
    ];
    const [response] = parseInbondResponse(lines);
    expect(response.bills).toHaveLength(0);
    expect(response.disposition).toMatchObject({ typeCode: '02', narrative: 'IN-BOND DELETED', accepted: true });
    expect(response.accepted).toBe(true);
  });

  it('splits multiple in-bond groupings on the echoed QP10', () => {
    const lines = [
      writeRecord(QP10, { actionCode: 'D', inBondNumber: '123456782' }),
      writeRecord(QT95, { narrativeMessageTypeCode: '02', narrativeMessageId: 'D01', narrativeMessage: 'IN-BOND DELETED' }),
      writeRecord(QP10, { actionCode: 'D', inBondNumber: '876543216' }),
      writeRecord(QT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'D02', narrativeMessage: 'IN-BOND NOT ON FILE' }),
    ];
    const responses = parseInbondResponse(lines);
    expect(responses).toHaveLength(2);
    expect(responses[0].accepted).toBe(true);
    expect(responses[1].accepted).toBe(false);
    expect(responses[1].inBondNumber).toBe('876543216');
  });

  it('parses a full QT batch through the envelope', () => {
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'QT',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: qtLines }],
    });
    const parsed = parseInbondResponseBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.structureRejects).toEqual([]);
    expect(parsed.inBonds).toHaveLength(1);
    expect(parsed.inBonds[0].inBondNumber).toBe('123456782');
  });

  it('detects EA/EB/EY/EZ control-record rejects (INB-69..72)', () => {
    const lines = [
      writeRecord(EA, { narrativeMessage: 'TRANSACTION COUNT MISMATCH' }),
      writeRecord(EB, { narrativeMessage: 'BLOCK CONTROL MISSING' }),
      writeRecord(EY, { narrativeMessage: 'RECORD COUNT MISMATCH' }),
      writeRecord(EZ, { narrativeMessage: 'Z-REC DOES NOT MATCH A-REC' }),
    ];
    expect(parseInbondStructureRejects(lines)).toEqual([
      { recordId: 'EA', narrative: 'TRANSACTION COUNT MISMATCH' },
      { recordId: 'EB', narrative: 'BLOCK CONTROL MISSING' },
      { recordId: 'EY', narrative: 'RECORD COUNT MISMATCH' },
      { recordId: 'EZ', narrative: 'Z-REC DOES NOT MATCH A-REC' },
    ]);
  });
});

// ── WT response parsing (INB-17) ───────────────────────────

describe('parseInbondEventResponse', () => {
  const wtLines = [
    writeRecord(WP10, { actionCode: '1', inBondNumber: '123456782', firmsCode: 'F123' }),
    writeRecord(WP20, { date: '260810', time: '143000', portOfArrival: '2704' }),
    writeRecord(WT95, { narrativeMessageTypeCode: '02', narrativeMessageId: 'A01', narrativeMessage: 'IN-BOND ARRIVED' }),
    writeRecord(WP10, { actionCode: '5', inBondNumber: '876543216' }),
    writeRecord(WT95, { narrativeMessageTypeCode: '01', narrativeMessageId: 'E55', narrativeMessage: 'IN-BOND NOT ON FILE' }),
  ];

  it('splits event groupings on WP10 and closes each with its WT95 accept/reject (Note 2)', () => {
    const events = parseInbondEventResponse(wtLines);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      actionCode: '1',
      inBondNumber: '123456782',
      accepted: true,
      disposition: { typeCode: '02', narrative: 'IN-BOND ARRIVED' },
    });
    expect(events[0].echoedRecords.map((r) => r.recordId)).toEqual(['WP10', 'WP20']);
    expect(events[1].accepted).toBe(false);
    expect(events[1].disposition?.narrative).toBe('IN-BOND NOT ON FILE');
  });

  it('parses a full WT batch through the envelope', () => {
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'WT',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: wtLines }],
    });
    const parsed = parseInbondEventResponseBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.events).toHaveLength(2);
  });
});

// ── NS status notification parsing (INB-17..18, 60..68) ────

describe('parseInbondStatus', () => {
  const nsInbondLines = [
    writeRecord(NS10, { inBondEntryType: '62', inBondNumber: '123456782', usPortOfDestination: '2704', foreignDestination: '57069' }),
    writeRecord(NS30, {
      dispositionCode: '1C', billIssuerCode: 'MAEU', billNumber: '123456789012',
      quantity: '0000000025', actionDate: '260810', actionTime: '1430', inBondCarrierCode: 'MAEU',
    }),
    writeRecord(NS40, { districtPortOfTransaction: '2704', firmsCode: 'F123', containerNumber: 'MSKU1234567' }),
    writeRecord(NS50, { remarks: 'IN-BOND EXPORTED' }),
    writeRecord(NS50, { remarks: 'SECOND REMARK' }),
    writeRecord(NS60, { actionIndicator: '1', containerNumber: 'MSKU1234567', sealNumber1: 'SEAL001' }),
    writeRecord(NS60, { containerNumber: 'MSKU7654321' }),
  ];

  it('parses the NS10 path with a container-level NS40 (Notes 1/4)', () => {
    const [notification, ...rest] = parseInbondStatus(nsInbondLines);
    expect(rest).toHaveLength(0);
    expect(notification.header).toMatchObject({
      kind: 'inbond',
      entryType: '62',
      entryTypeMeaning: 'Transportation and Exportation (T&E) — arrive, then export',
      inBondNumber: '123456782',
      usPortOfDestination: '2704',
      foreignDestination: '57069',
    });
    expect(notification).toMatchObject({
      dispositionCode: '1C',
      billIssuerCode: 'MAEU',
      billNumber: '123456789012',
      quantity: '0000000025',
      negative: false,
      actionDate: '260810',
      actionTime: '1430',
      containerLevel: true, // NS40 container populated (Note 1, INB-66)
    });
    expect(notification.detail).toMatchObject({ port: '2704', firmsCode: 'F123', containerNumber: 'MSKU1234567' });
    expect(notification.remarks).toEqual(['IN-BOND EXPORTED', 'SECOND REMARK']);
    expect(notification.containers).toEqual([
      { actionTakenAgainstContainer: true, containerNumber: 'MSKU1234567', sealNumber1: 'SEAL001', sealNumber2: undefined },
      { actionTakenAgainstContainer: false, containerNumber: 'MSKU7654321', sealNumber1: undefined, sealNumber2: undefined },
    ]);
  });

  it('parses the NS05 conveyance path for bills unrelated to a QP in-bond (Note 4)', () => {
    const lines = [
      writeRecord(NS05, {
        conveyanceName: 'MAERSK ESSEX', voyageTripNumber: '00221', districtPort: '2704',
        estimatedDateOfArrival: '260810', estimatedTimeOfArrival: '143000',
      }),
      writeRecord(NS30, {
        dispositionCode: '4A', billIssuerCode: 'MAEU', billNumber: '123456789012',
        quantity: '0000000010', negativeIndicator: 'N', actionDate: '260810', actionTime: '0900', inBondCarrierCode: 'MAEU',
      }),
      writeRecord(NS50, { remarks: 'HOLD PLACED' }),
    ];
    const [notification] = parseInbondStatus(lines);
    expect(notification.header).toMatchObject({
      kind: 'conveyance',
      conveyanceName: 'MAERSK ESSEX',
      voyageTripNumber: '00221',
      port: '2704',
      estimatedDateOfArrival: '260810',
      estimatedTimeOfArrival: '143000',
    });
    expect(notification.negative).toBe(true);
    expect(notification.containerLevel).toBe(false);
    expect(notification.remarks).toEqual(['HOLD PLACED']);
  });

  it('splits notifications on each NS05/NS10 header and parses a full NS batch', () => {
    const both = [
      ...nsInbondLines,
      writeRecord(NS10, { inBondEntryType: '61', inBondNumber: '876543216', usPortOfDestination: '3901' }),
      writeRecord(NS30, {
        dispositionCode: '1A', billIssuerCode: 'MAEU', billNumber: 'ABC123',
        quantity: '0000000010', actionDate: '260810', actionTime: '1500', inBondCarrierCode: 'MAEU',
      }),
    ];
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'NS',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: both }],
    });
    const parsed = parseInbondStatusBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.notifications).toHaveLength(2);
    expect(parsed.notifications[1].header).toMatchObject({ kind: 'inbond', entryType: '61', inBondNumber: '876543216' });
    expect(parsed.notifications[1].dispositionCode).toBe('1A');
  });
});
