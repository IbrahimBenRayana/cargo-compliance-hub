/**
 * PGA Message Set tests — positions and formats asserted against the
 * "Participating Government Agencies Message Set" chapter (July 01, 2026,
 * page refs) and the FDA Supplemental Guide v2.6. The chapter's worked
 * examples (p.68-70) print PDF-mangled spacing, so the expected 80-char
 * lines below are constructed digit-for-digit from the record layout
 * tables; the p.68/p.70 examples are cited where they corroborate a layout.
 */
import { describe, it, expect } from 'vitest';
import { buildPgaLine, type PgaLineInput } from '../pga/builder.js';
import {
  DISCLAIMER_CODES,
  INPUT_PG00,
  INPUT_PG22,
  INPUT_PG23,
  INPUT_PG25,
  INPUT_PG35,
  INPUT_PG50,
  INPUT_PG51,
  INPUT_PG55,
  INPUT_PG60,
} from '../pga/recordDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';

// ── Scenario-083-shaped FDA CCW food line ──────────────────
// FDA food (program FOO, processing CCW → industry code 52), FDP product
// code 52AOJ51, 277.34 cases over 200 pieces, actual-manufacturer number
// TWNICSAN435TAI on the MF entity, mandatory FDA role set MF/DEQ/FD1/DP
// with PG20 addresses and the required FD1 point of contact, anticipated
// arrival via PG30 status A.
// NOTE: the Appendix PGA entity-identification qualifier for a
// manufacturer-ID number is not in our extracted sources; the test uses
// 'MID' and asserts pass-through layout only (PG19 p.35 + CSMS 00-0824).
const FDA_CCW: PgaLineInput = {
  commercialDescription: 'FROZEN CONCENTRATED ORANGE JUICE BLEND',
  sets: [
    {
      kind: 'data',
      agencyCode: 'FDA',
      programCode: 'FOO',
      processingCode: 'CCW',
      product: { codes: [{ qualifier: 'FDP', number: '52AOJ51' }] },
      sources: [{ typeCode: '39', countryCode: 'TW' }], // 39 = country of production (FDA guide)
      productName: 'ORANGE JUICE CONCENTRATE',
      entities: [
        {
          roleCode: 'MF',
          identificationCode: 'MID',
          number: 'TWNICSAN435TAI',
          name: 'NICO SANTO FOODS LTD',
          address1: '435 CHUNG SHAN RD',
          city: 'TAINAN',
          country: 'TW',
        },
        {
          roleCode: 'DEQ',
          name: 'OCEAN FORWARDING LTD',
          address1: '88 HARBOR RD',
          city: 'KAOHSIUNG',
          country: 'TW',
        },
        {
          roleCode: 'FD1',
          name: 'SIGMA IMPORTS LLC',
          address1: '100 MAIN ST',
          city: 'HOUSTON',
          stateProvince: 'TX',
          country: 'US',
          zip: '77002',
          contacts: [
            {
              qualifier: 'FD1',
              name: 'JANE DOE',
              telephone: '(713)555-8765',
              emailOrFax: 'JANE.DOE@SIGMAIMPORTS.COM',
            },
          ],
        },
        {
          roleCode: 'DP',
          name: 'GULF COLD STORAGE INC',
          address1: '9 DOCK ST',
          city: 'GALVESTON',
          stateProvince: 'TX',
          country: 'US',
          zip: '77550',
        },
      ],
      quantities: [
        { qualifier: 1, quantityHundredths: 27734, uom: 'CS' }, // 277.34 cases
        { qualifier: 2, quantityHundredths: 20000, uom: 'PCS' }, // 200 pieces (base)
      ],
      arrival: { status: 'A', dateMMDDCCYY: '09152026', timeHHMM: '1030' },
    },
  ],
};

describe('buildPgaLine — FDA CCW food line (scenario-083 shape)', () => {
  it('lays out OI and the full PG record set exactly per the chapter', () => {
    const lines = buildPgaLine(FDA_CCW);
    expect(lines).toEqual([
      // OI (p.16): OI(1-2) filler(3-10) commercial description(11-80)
      'OI' + ' '.repeat(8) + 'FROZEN CONCENTRATED ORANGE JUICE BLEND'.padEnd(70),
      // PG01 (p.17): line no(5-7) agency(8-10) program(11-13) processing(14-16)
      'PG01001FDAFOOCCW' + ' '.repeat(64),
      // PG02 (p.22): item type P(5) qualifier(6-9) product code(10-28)
      'PG02PFDP ' + '52AOJ51'.padEnd(19) + ' '.repeat(52),
      // PG06 (p.26): source type(5-7) country(8-9)
      'PG0639 TW' + ' '.repeat(71),
      // PG10 (p.30): commodity characteristic description(24-80)
      'PG10' + ' '.repeat(19) + 'ORANGE JUICE CONCENTRATE'.padEnd(57),
      // PG19 MF (p.35): role(5-7) id code(8-10) number(11-25) name(26-57) address1(58-80)
      'PG19MF MID' + 'TWNICSAN435TAI'.padEnd(15) + 'NICO SANTO FOODS LTD'.padEnd(32) + '435 CHUNG SHAN RD'.padEnd(23),
      // PG20 MF (p.36): city(42-62) state(63-65) country(66-67) zip(68-76)
      'PG20' + ' '.repeat(37) + 'TAINAN'.padEnd(21) + '   TW' + ' '.repeat(13),
      'PG19DEQ' + ' '.repeat(18) + 'OCEAN FORWARDING LTD'.padEnd(32) + '88 HARBOR RD'.padEnd(23),
      'PG20' + ' '.repeat(37) + 'KAOHSIUNG'.padEnd(21) + '   TW' + ' '.repeat(13),
      'PG19FD1' + ' '.repeat(18) + 'SIGMA IMPORTS LLC'.padEnd(32) + '100 MAIN ST'.padEnd(23),
      'PG20' + ' '.repeat(37) + 'HOUSTON'.padEnd(21) + 'TX US' + '77002'.padEnd(9) + '    ',
      // PG21 (p.37): qualifier(5-7) name(8-30) phone(31-45) email(46-80)
      'PG21FD1' + 'JANE DOE'.padEnd(23) + '(713)555-8765'.padEnd(15) + 'JANE.DOE@SIGMAIMPORTS.COM'.padEnd(35),
      'PG19DP ' + ' '.repeat(18) + 'GULF COLD STORAGE INC'.padEnd(32) + '9 DOCK ST'.padEnd(23),
      'PG20' + ' '.repeat(37) + 'GALVESTON'.padEnd(21) + 'TX US' + '77550'.padEnd(9) + '    ',
      // PG26 (p.42): level(5) quantity(6-17, 2 implied decimals) uom(18-22)
      'PG261000000027734CS   ' + ' '.repeat(58),
      'PG262000000020000PCS  ' + ' '.repeat(58),
      // PG30 (p.48): status A(5) arrival date(6-13) arrival time(14-17)
      'PG30A091520261030' + ' '.repeat(63),
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('zero-fills PG26 quantities to 12N with two implied decimals', () => {
    const lines = buildPgaLine(FDA_CCW);
    const pg26 = lines.filter((l) => l.startsWith('PG26'));
    expect(pg26[0].slice(5, 17)).toBe('000000027734'); // 277.34 CS
    expect(pg26[1].slice(5, 17)).toBe('000000020000'); // 200.00 PCS
  });
});

// ── Disclaimer-only set ────────────────────────────────────

describe('buildPgaLine — disclaimer set', () => {
  it('emits only OI and PG01, with the disclaimer code in position 80 (p.19, p.21)', () => {
    const lines = buildPgaLine({
      commercialDescription: 'LABORATORY GLASSWARE',
      sets: [{ kind: 'disclaimer', agencyCode: 'FDA', programCode: 'FOO', disclaimerCode: 'A' }],
    });
    expect(lines).toEqual([
      'OI' + ' '.repeat(8) + 'LABORATORY GLASSWARE'.padEnd(70),
      'PG01001FDAFOO' + ' '.repeat(66) + 'A',
    ]);
    expect(lines[1].charAt(79)).toBe('A'); // position 80
  });

  it('documents all seven disclaimer codes A-G (p.19-20)', () => {
    expect(Object.keys(DISCLAIMER_CODES)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(DISCLAIMER_CODES.A).toMatch(/not regulated/i);
  });
});

// ── PG07 / PG08 item identity ──────────────────────────────

describe('buildPgaLine — PG07/PG08 item identity', () => {
  it('emits PG07 then chunks additional numbers four per PG08 record (p.28-29)', () => {
    const lines = buildPgaLine({
      commercialDescription: 'PASSENGER VEHICLES',
      sets: [
        {
          kind: 'data',
          agencyCode: 'EP',
          programCode: 'VNE',
          product: { codes: [{ qualifier: 'MDL', number: 'T3000' }] },
          item: {
            tradeName: 'ACME',
            model: 'T3000',
            manufactureMonthYear: '062025',
            numberQualifier: 'VIN',
            number: '1HGCM82633A004352',
            additionalNumbers: [
              '1HGCM82633A004353',
              '1HGCM82633A004354',
              '1HGCM82633A004355',
              '1HGCM82633A004356',
              '1HGCM82633A004357',
            ],
          },
          entities: [],
        },
      ],
    });
    expect(lines[1]).toBe('PG01001EP VNE' + ' '.repeat(67));
    // PG07 (p.28): trade name(5-39) model(40-54) MMCCYY(55-60) qualifier(61-63) number(64-80)
    expect(lines[3]).toBe('PG07' + 'ACME'.padEnd(35) + 'T3000'.padEnd(15) + '062025VIN1HGCM82633A004352');
    // PG08 (p.29): four 17-char numbers at 5-21, 22-38, 39-55, 56-72, filler 73-80
    expect(lines[4]).toBe('PG08' + '1HGCM82633A0043531HGCM82633A0043541HGCM82633A0043551HGCM82633A004356' + ' '.repeat(8));
    expect(lines[5]).toBe('PG08' + '1HGCM82633A004357' + ' '.repeat(59));
    for (const line of lines) expect(line).toHaveLength(80);
  });
});

// ── PGA line numbering ─────────────────────────────────────

describe('buildPgaLine — PGA line numbering', () => {
  it('starts at 001 per agency and restarts on agency change (p.13, p.65)', () => {
    const lines = buildPgaLine({
      commercialDescription: 'MIXED COMMODITY',
      sets: [
        { kind: 'disclaimer', agencyCode: 'FDA', programCode: 'FOO', disclaimerCode: 'B' },
        { kind: 'disclaimer', agencyCode: 'FDA', programCode: 'BIO', disclaimerCode: 'B' },
        { kind: 'disclaimer', agencyCode: 'EPA', programCode: 'TSC', disclaimerCode: 'A' },
      ],
    });
    const pg01 = lines.filter((l) => l.startsWith('PG01'));
    expect(pg01.map((l) => l.slice(4, 7))).toEqual(['001', '002', '001']);
    expect(pg01.map((l) => l.slice(7, 10))).toEqual(['FDA', 'FDA', 'EPA']);
  });
});

// ── Structural rejections ──────────────────────────────────

describe('buildPgaLine — structural rejections', () => {
  const base = {
    commercialDescription: 'TEST GOODS',
  };
  const dataSet = () => ({
    kind: 'data' as const,
    agencyCode: 'FDA',
    programCode: 'FOO',
    product: { codes: [{ qualifier: 'FDP', number: '52AOJ51' }] },
    entities: [],
  });

  it('rejects an empty set list', () => {
    expect(() => buildPgaLine({ ...base, sets: [] })).toThrow(RecordCodecError);
  });

  it('rejects a data set without a PG02 product (p.21: otherwise a PG02 is expected)', () => {
    expect(() => buildPgaLine({ ...base, sets: [{ ...dataSet(), product: undefined }] })).toThrow(/PG02/);
  });

  it('rejects duplicate product-code qualifiers at product level (p.21)', () => {
    expect(() =>
      buildPgaLine({
        ...base,
        sets: [
          {
            ...dataSet(),
            product: {
              codes: [
                { qualifier: 'SKU', number: 'PART-1' },
                { qualifier: 'SKU', number: 'PART-2' },
              ],
            },
          },
        ],
      })
    ).toThrow(/new PGA line/);
  });

  it('rejects more than six PG26 packaging levels (p.42)', () => {
    const quantities = [1, 2, 3, 4, 5, 6, 6].map((q, i) => ({
      qualifier: Math.min(i + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6,
      quantityHundredths: 100,
      uom: `U${i}`,
    }));
    expect(() => buildPgaLine({ ...base, sets: [{ ...dataSet(), quantities }] })).toThrow(/six/);
  });

  it('rejects packaging levels that do not run 1..n outermost to innermost (p.42)', () => {
    expect(() =>
      buildPgaLine({
        ...base,
        sets: [{ ...dataSet(), quantities: [{ qualifier: 2, quantityHundredths: 100, uom: 'CS' }] }],
      })
    ).toThrow(/outermost/);
  });

  it('rejects PG08 numbers without a PG07 item identity qualifier (p.29)', () => {
    expect(() =>
      buildPgaLine({
        ...base,
        sets: [{ ...dataSet(), item: { tradeName: 'ACME', additionalNumbers: ['SER123'] } }],
      })
    ).toThrow(/PG08/);
  });

  it('rejects an entity number without its identification code (p.35)', () => {
    expect(() =>
      buildPgaLine({
        ...base,
        sets: [{ ...dataSet(), entities: [{ roleCode: 'MF', number: 'TWNICSAN435TAI' }] }],
      })
    ).toThrow(/together/);
  });
});

// ── Remaining record layouts (writeRecord) ─────────────────

describe('PGA record layouts', () => {
  it('PG22 conformance declaration (p.38; corroborated by the p.70 example)', () => {
    const line = writeRecord(INPUT_PG22, {
      documentIdentifier: '942',
      entityRoleCode: 'CI',
      declarationCode: 'EP2',
      declarationCertification: 'Y',
      dateOfSignature: '01272011',
    });
    // doc id(6-12) role(18-20) declaration code(21-24) cert(25) date(26-33)
    expect(line).toBe('PG22 ' + '942'.padEnd(7) + ' '.repeat(5) + 'CI EP2 Y01272011' + ' '.repeat(47));
  });

  it('PG23 affirmation of compliance (p.39)', () => {
    const line = writeRecord(INPUT_PG23, {
      affirmationOfComplianceCode: 'FCE',
      affirmationOfComplianceDescription: '12345678901',
    });
    expect(line).toBe('PG23FCE  ' + '12345678901'.padEnd(70) + ' ');
  });

  it('PG25 temperature, lot and value (p.41)', () => {
    const line = writeRecord(INPUT_PG25, {
      temperatureQualifier: 'F',
      degreeType: 'C',
      negativeNumber: 'X',
      actualTemperature: '001850', // -18.50 C
      temperatureRecordingLocation: 'A',
      lotNumberQualifier: '1',
      lotNumber: 'LOT2026A',
      lotProductionStartDate: '01012026',
      lotProductionEndDate: '01152026',
      pgaLineValue: '000000012000',
      pgaUnitValue: '000000000550',
    });
    expect(line).toBe('PG25FCX001850A1' + 'LOT2026A'.padEnd(25) + '0101202601152026000000012000000000000550');
    expect(line).toHaveLength(80);
  });

  it('PG35 DOT conformance bond (p.54)', () => {
    const line = writeRecord(INPUT_PG35, {
      dotSuretyCode: '123',
      dotBondSerialNumber: 'DOTBOND0001',
      dotBondQualifier: '1',
      dotBondAmount: '00025000',
    });
    expect(line).toBe('PG35123' + 'DOTBOND0001'.padEnd(30) + '100025000' + ' '.repeat(34));
  });

  it('PG50/PG51 grouping start and end (p.55-56)', () => {
    expect(writeRecord(INPUT_PG50)).toBe('PG50' + ' '.repeat(76));
    expect(writeRecord(INPUT_PG51)).toBe('PG51' + ' '.repeat(76));
  });

  it('PG55 additional entity roles (p.57; matches the p.68 PG55DFPIM example)', () => {
    const line = writeRecord(INPUT_PG55, { entityRoleCode1: 'DFP', entityRoleCode2: 'IM' });
    expect(line).toBe('PG55DFPIM ' + ' '.repeat(70));
  });

  it('PG60 additional reference information (p.58)', () => {
    const line = writeRecord(INPUT_PG60, {
      additionalInformationQualifierCode: 'AD3',
      additionalInformation: 'SUITE 400 BUILDING C',
    });
    expect(line).toBe('PG60AD3' + 'SUITE 400 BUILDING C'.padEnd(73));
  });

  it('PG00 substitution start and end (p.59; end example p.69 omits the number)', () => {
    expect(writeRecord(INPUT_PG00, { substitutionIndicator: 'S', substitutionNumber: '0001' })).toBe(
      'PG00S0001' + ' '.repeat(71)
    );
    expect(writeRecord(INPUT_PG00, { substitutionIndicator: 'E' })).toBe('PG00E' + ' '.repeat(75));
  });
});
