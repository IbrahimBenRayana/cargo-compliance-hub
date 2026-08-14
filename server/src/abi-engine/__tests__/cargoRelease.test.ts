/**
 * ACE Cargo Release (SE/SX + SO) tests — positions and formats asserted
 * against the CATAIR ACE Cargo Release chapter, July 1 2025 v40 (CR page
 * refs in comments) and the SO Status Notification chapter, September
 * 2025 rev 36 (SO page refs).
 */
import { describe, it, expect } from 'vitest';
import {
  buildCargoRelease,
  type CargoReleaseAddReplaceInput,
  type CargoReleaseCancelInput,
  type CargoReleaseInput,
  type CargoReleaseUpdateInput,
} from '../cargoRelease/builder.js';
import {
  parseCargoReleaseResponse,
  parseCargoReleaseResponseBatch,
  parseCargoReleaseStatus,
  parseCargoReleaseStatusBatch,
} from '../cargoRelease/responseParser.js';
import {
  SE10, SE15, SE20, SE90,
  SO10, SO20, SO30, SO40, SO42, SO50, SO60, SO71, SO72,
} from '../cargoRelease/recordDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { buildBatch } from '../envelope/batch.js';

const sp = (n: number) => ' '.repeat(n);

// ── Fixtures ───────────────────────────────────────────────

/** Full type-01 consumption add: bills, references, both entity levels. */
const ADD_01: CargoReleaseAddReplaceInput = {
  action: 'add',
  filerCode: 'ABC',
  entryNumber: '12345678',
  entryType: '01',
  importerOfRecord: { type: 'EI', number: '12-3456789' },
  motCode: '11',
  bondType: '8',
  estimatedValueDollars: 25000,
  plannedPortOfEntry: '2704',
  portOfUnlading: '2704',
  contact: { name: 'JOHN DOE', phone: '3105551234' },
  additionalHeader: { locationOfGoodsFirms: 'A123', voyageFlightTrip: '123E' },
  billGroupings: [
    {
      bills: [
        { type: 'M', issuerCode: 'MAEU', billNumber: 'MAEU123456789012' },
        { type: 'H', issuerCode: 'HLCU', billNumber: 'HLCU987654321', quantity: 100 },
      ],
      equipment: ['MSKU1234567'],
    },
  ],
  references: [{ qualifier: 'CR', value: 'MYREF001' }],
  headerEntities: [
    { code: 'CN', identifier: { qualifier: 'EI', value: '12-3456789' } },
    {
      code: 'BY',
      name: 'ACME IMPORTS LLC',
      gbiIdentifiers: [{ qualifier: 'LEI', value: 'LEI12345678901234' }],
      addressComponents: [
        { qualifier: '01', information: '100' },
        { qualifier: '02', information: 'MAIN ST' },
      ],
      geography: { city: 'LOS ANGELES', countrySubEntityCode: 'CA', postalCode: '90001', countryCode: 'US' },
    },
  ],
  lines: [
    {
      countryOfOrigin: 'CN',
      description: 'LITHIUM ION BATTERY PACKS',
      entities: [
        {
          code: 'MF',
          name: 'SHENZHEN BATTERY CO LTD',
          addressComponents: [{ qualifier: '15', information: 'NANSHAN ROAD 88' }],
          geography: { city: 'SHENZHEN', countryCode: 'CN' },
        },
        {
          code: 'SE',
          name: 'GLOBAL SELLER LTD',
          addressComponents: [{ qualifier: '15', information: 'HARBOUR WAY 2' }],
          geography: { city: 'HONG KONG', countryCode: 'HK' },
        },
      ],
      tariffs: [{ htsNumber: '8507600020', valueDollars: 25000 }],
    },
  ],
};

/** Type-86 Section 321: EDA reference, single bill, values everywhere. */
const ADD_86: CargoReleaseAddReplaceInput = {
  action: 'add',
  filerCode: 'ABC',
  entryNumber: '86543210',
  entryType: '86',
  motCode: '40',
  bondType: '0',
  estimatedValueDollars: 750,
  plannedPortOfEntry: '2704',
  contact: { name: 'JOHN DOE', phone: '3105551234' },
  billGroupings: [{ bills: [{ type: 'R', billNumber: '12312345678', quantity: 1 }] }],
  references: [{ qualifier: 'EDA', value: '070125' }],
  headerEntities: [
    {
      code: 'CN',
      name: 'JANE SMITH',
      addressComponents: [{ qualifier: '15', information: 'MAIN ST 100' }],
      geography: { city: 'LOS ANGELES', postalCode: '90001', countryCode: 'US' },
    },
    {
      code: 'SE',
      name: 'SHENZHEN SELLER CO',
      addressComponents: [{ qualifier: '15', information: 'PORT ROAD 1' }],
      geography: { city: 'SHENZHEN', countryCode: 'CN' },
    },
  ],
  lines: [{ countryOfOrigin: 'CN', tariffs: [{ htsNumber: '8507600020', valueDollars: 750 }] }],
};

/** Type-06 FTZ weekly entry: SE41 per line, SE61, no bills. */
const ADD_06: CargoReleaseAddReplaceInput = {
  action: 'add',
  filerCode: 'ABC',
  entryNumber: '06543210',
  entryType: '06',
  bondType: '8',
  estimatedValueDollars: 5000,
  plannedPortOfEntry: '2704',
  contact: { name: 'JOHN DOE', phone: '3105551234' },
  additionalHeader: {
    entryDateElectionCode: 'W',
    electedEntryDate: '070125',
    locationOfGoodsFirms: 'A123',
    conveyanceNameOrFtzId: 'FTZ0260A01',
  },
  headerEntities: [{ code: 'CN', identifier: { qualifier: 'EI', value: '12-3456789' } }],
  lines: [
    {
      countryOfOrigin: 'CN',
      ftz: { zoneStatus: 'P', privilegedFilingDate: '061520', quantity: 500 },
      tariffs: [{ htsNumber: '8507600020', valueDollars: 5000, currentHtsNumber: '8507608000' }],
    },
  ],
};

/** Cancel with reason 03 (cleared under another entry) + EN replacement. */
const CANCEL_03: CargoReleaseCancelInput = {
  action: 'cancel',
  filerCode: 'ABC',
  entryNumber: '12345678',
  entryType: '01',
  importerOfRecord: { type: 'EI', number: '12-3456789' },
  motCode: '11',
  bondType: '8',
  estimatedValueDollars: 25000,
  plannedPortOfEntry: '2704',
  contact: { name: 'JOHN DOE', phone: '3105551234' },
  cancellation: { reasonCode: '03' },
  references: [{ qualifier: 'EN', value: 'ABC87654321' }],
};

const UPDATE_BILLS: CargoReleaseUpdateInput = {
  action: 'update',
  filerCode: 'ABC',
  entryNumber: '12345678',
  entryType: '01',
  importerOfRecord: { type: 'EI', number: '12-3456789' },
  motCode: '11',
  bondType: '8',
  estimatedValueDollars: 25000,
  plannedPortOfEntry: '2704',
  contact: { name: 'JOHN DOE', phone: '3105551234' },
  billGroupings: [{ bills: [{ type: 'R', issuerCode: 'MAEU', billNumber: 'MAEU555566667777' }] }],
  references: [{ qualifier: 'CR', value: 'MYREF002' }],
};

// ── Input record layouts (exact 80-char assertions) ────────

describe('SE input record layouts', () => {
  const lines = buildCargoRelease(ADD_01);
  const find = (id: string, nth = 0) => lines.filter((l) => l.startsWith(id))[nth];

  it('lays out the SE10 header per CR p.33-34', () => {
    const expected =
      'SE10' + 'A' + 'ABC' + sp(2) + '12345678' + ' ' + '01' + 'EI ' + '12-3456789' + sp(2) +
      '11' + '8' + '0000025000' + '2704 ' + ' ' + '2704 ' + sp(20);
    expect(expected).toHaveLength(80);
    expect(lines[0]).toBe(expected);
  });

  it('lays out the SE11 additional header per CR p.39-41', () => {
    const expected =
      'SE11' + ' ' + sp(6) + 'A123' + sp(4) + sp(20) + '123E ' + sp(20) + sp(4) + sp(3) + sp(8) + ' ';
    expect(expected).toHaveLength(80);
    expect(find('SE11')).toBe(expected);
  });

  it('lays out the SE13 contact per CR p.44', () => {
    const expected = 'SE13' + 'JOHN DOE' + sp(32) + '3105551234' + sp(5) + sp(2) + sp(3) + sp(16);
    expect(expected).toHaveLength(80);
    expect(find('SE13')).toBe(expected);
  });

  it('lays out the SE15 master/house pair with a zero-filled 8N quantity per CR p.46-47', () => {
    const master = 'SE15' + 'M' + 'MAEU' + 'MAEU123456789012' + sp(34) + sp(8) + sp(5) + 'N' + sp(7);
    const house = 'SE15' + 'H' + 'HLCU' + 'HLCU987654321' + sp(37) + '00000100' + sp(5) + 'N' + sp(7);
    expect(master).toHaveLength(80);
    expect(house).toHaveLength(80);
    expect(find('SE15', 0)).toBe(master);
    expect(find('SE15', 1)).toBe(house);
  });

  it('lays out the SE16 conveyance per CR p.53', () => {
    const nonAms = buildCargoRelease({
      ...ADD_01,
      billGroupings: [
        {
          bills: [{ type: 'R', issuerCode: 'APLU', billNumber: 'APLU111122223333', nonAms: true }],
          conveyances: [
            {
              carrierCode: 'APLU',
              voyageFlightTrip: '123E',
              dateOfArrival: '070125',
              quantity: 50,
              unitOfMeasure: 'CTNS',
              conveyanceName: 'EVER GIVEN',
            },
          ],
        },
      ],
    });
    const expected = 'SE16' + 'APLU' + '123E ' + '070125' + '00000050' + 'CTNS ' + 'EVER GIVEN' + sp(10) + sp(28);
    expect(expected).toHaveLength(80);
    expect(nonAms.find((l) => l.startsWith('SE16'))).toBe(expected);
    // The Non-AMS indicator lands in position 73 (SE15 Note 5).
    const bill = nonAms.find((l) => l.startsWith('SE15'))!;
    expect(bill[72]).toBe('Y');
  });

  it('lays out the SE17 equipment per CR p.55', () => {
    const expected = 'SE17' + 'MSKU1234567' + sp(9) + sp(56);
    expect(expected).toHaveLength(80);
    expect(find('SE17')).toBe(expected);
  });

  it('lays out the SE20 reference per CR p.56', () => {
    const expected = 'SE20' + 'CR ' + 'MYREF001' + sp(42) + sp(23);
    expect(expected).toHaveLength(80);
    expect(find('SE20')).toBe(expected);
  });

  it('lays out an identifier-only SE30 and a name-route SE30 per CR p.58', () => {
    const cn = 'SE30' + 'CN ' + sp(35) + 'EI ' + '12-3456789' + sp(10) + sp(15);
    const by = 'SE30' + 'BY ' + 'ACME IMPORTS LLC' + sp(19) + sp(3) + sp(20) + sp(15);
    expect(cn).toHaveLength(80);
    expect(by).toHaveLength(80);
    expect(find('SE30', 0)).toBe(cn);
    expect(find('SE30', 1)).toBe(by);
  });

  it('lays out the SE31 GBI identifier immediately after its SE30 per CR p.61', () => {
    const expected = 'SE31' + 'LEI ' + 'LEI12345678901234' + sp(3) + sp(52);
    expect(expected).toHaveLength(80);
    expect(find('SE31')).toBe(expected);
    expect(lines[lines.indexOf(find('SE30', 1)) + 1]).toBe(expected);
  });

  it('lays out the SE35 with two qualifier+information pairs per CR p.62', () => {
    const expected = 'SE35' + '01' + '100' + sp(32) + '02' + 'MAIN ST' + sp(28) + sp(2);
    expect(expected).toHaveLength(80);
    expect(find('SE35')).toBe(expected);
  });

  it('lays out the SE36 geographic area per CR p.63', () => {
    const expected = 'SE36' + 'LOS ANGELES' + sp(24) + 'CA ' + sp(6) + '90001' + sp(10) + 'US' + sp(15);
    expect(expected).toHaveLength(80);
    expect(find('SE36')).toBe(expected);
  });

  it('lays out the SE40 line item with a zero-filled 3N identifier per CR p.64', () => {
    const expected = 'SE40' + '001' + 'CN' + ' ' + 'LITHIUM ION BATTERY PACKS' + sp(45);
    expect(expected).toHaveLength(80);
    expect(find('SE40')).toBe(expected);
  });

  it('lays out the SE50/SE55/SE56 line entity records per CR p.67-72', () => {
    const mf = 'SE50' + 'MF ' + 'SHENZHEN BATTERY CO LTD' + sp(12) + sp(3) + sp(20) + sp(15);
    const addr = 'SE55' + '15' + 'NANSHAN ROAD 88' + sp(20) + sp(2) + sp(35) + sp(2);
    const geo = 'SE56' + 'SHENZHEN' + sp(27) + sp(3) + sp(6) + sp(15) + 'CN' + sp(15);
    for (const rec of [mf, addr, geo]) expect(rec).toHaveLength(80);
    expect(find('SE50')).toBe(mf);
    expect(find('SE55')).toBe(addr);
    expect(find('SE56')).toBe(geo);
  });

  it('lays out the SE60 HTS with a zero-filled 10N value per CR p.73', () => {
    const expected = 'SE60' + '8507600020' + '0000025000' + sp(56);
    expect(expected).toHaveLength(80);
    expect(find('SE60')).toBe(expected);
  });

  it('lays out the SE41 and SE61 FTZ records per CR p.65/74', () => {
    const ftz = buildCargoRelease(ADD_06);
    const se41 = 'SE41' + 'P' + '061520' + '00000500' + sp(61);
    const se61 = 'SE61' + '8507608000' + sp(66);
    expect(se41).toHaveLength(80);
    expect(se61).toHaveLength(80);
    expect(ftz.find((l) => l.startsWith('SE41'))).toBe(se41);
    expect(ftz.find((l) => l.startsWith('SE61'))).toBe(se61);
  });

  it('emits the AMT bond amount left-justified with no leading zeroes, verbatim per CR p.57', () => {
    const bond9 = (amount: string) =>
      buildCargoRelease({
        ...ADD_01,
        bondType: '9',
        references: [
          { qualifier: 'V1', value: '123' },
          { qualifier: 'AMT', value: amount },
        ],
      });
    // The chapter's own examples: $90,000 and $10,500,000 (CR p.57).
    expect(bond9('90000')).toContain('SE20AMT90000' + sp(68));
    expect(bond9('10500000')).toContain('SE20AMT10500000' + sp(65));
  });
});

// ── Unified Entry/ISF block (CR p.30/32, p.75-84) ──────────

describe('buildCargoRelease — unified Entry/ISF', () => {
  const unified: CargoReleaseAddReplaceInput = {
    ...ADD_01,
    unifiedIsf: {
      shipmentTypeCode: '01',
      action: 'A',
      importer: { qualifier: 'EI', number: '12-3456789' },
      modeOfTransportationCode: '11',
      scac: 'MAEU',
      references: [{ qualifier: 'CR', value: 'ISFREF01' }],
      containers: [{ descriptionCode: '20', initial: 'MSKU', number: '123456', checkDigit: '7', sizeTypeCode: '4500' }],
      entities: [
        {
          code: 'MF',
          name: 'SHENZHEN BATTERY CO LTD',
          secondaryName: { code: 'DH', name: 'SBC' },
          addressComponents: [{ qualifier: '15', information: 'NANSHAN ROAD 88' }],
          geography: { city: 'SHENZHEN', countryCode: 'CN' },
        },
        {
          code: 'SE',
          name: 'GLOBAL SELLER LTD',
          addressComponents: [{ qualifier: '15', information: 'HARBOUR WAY 2' }],
          geography: { city: 'HONG KONG', countryCode: 'HK' },
        },
        {
          code: 'BY',
          name: 'ACME IMPORTS LLC',
          addressComponents: [{ qualifier: '15', information: 'MAIN ST 100' }],
          geography: { city: 'LOS ANGELES', countryCode: 'US' },
        },
        { code: 'ST', identifier: { qualifier: 'FR', value: 'A123' } },
        {
          code: 'CS',
          name: 'GLOBAL CONSOL',
          addressComponents: [{ qualifier: '15', information: 'KADE 12' }],
          geography: { city: 'ROTTERDAM', countryCode: 'NL' },
        },
        {
          code: 'LG',
          name: 'SHENZHEN CFS',
          addressComponents: [{ qualifier: '15', information: 'PORT ROAD 1' }],
          geography: { city: 'SHENZHEN', countryCode: 'CN' },
        },
        { code: 'CN', identifier: { qualifier: 'EI', value: '12-3456789' } },
      ],
    },
  };

  it('appends the SF records after the last SE60 record (CR p.30/32)', () => {
    const lines = buildCargoRelease(unified);
    const ids = lines.map((l) => l.slice(0, 4));
    expect(ids.lastIndexOf('SE60')).toBeLessThan(ids.indexOf('SF10'));
    expect(ids.slice(ids.indexOf('SF10'))).toEqual([
      'SF10', 'SF20', 'SF25',
      'SF30', 'SF31', 'SF35', 'SF36', // MF + secondary name
      'SF30', 'SF35', 'SF36', // SE
      'SF30', 'SF35', 'SF36', // BY
      'SF30', // ST via FIRMS identifier (SF30-only, CR p.80)
      'SF30', 'SF35', 'SF36', // CS
      'SF30', 'SF35', 'SF36', // LG
      'SF30', // CN identifier-only
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('lays out the unified SF10 with CT reason and space-filled bond fields per CR p.75-77', () => {
    const lines = buildCargoRelease(unified);
    const expected =
      'SF10' + '1' + '01' + 'A' + 'CT' + 'EI ' + '12-3456789' + sp(5) + sp(8) + '11' + sp(15) +
      'MAEU' + sp(15) + sp(2) + ' ' + sp(3) + sp(2);
    expect(expected).toHaveLength(80);
    expect(lines.find((l) => l.startsWith('SF10'))).toBe(expected);
  });

  it('lays out the unified SF20/SF25/SF30 records per CR p.78-81', () => {
    const lines = buildCargoRelease(unified);
    expect(lines.find((l) => l.startsWith('SF20'))).toBe('SF20' + 'CR ' + 'ISFREF01' + sp(42) + sp(23));
    expect(lines.find((l) => l.startsWith('SF25'))).toBe('SF25' + '20' + 'MSKU' + '000000000123456' + '7' + '4500' + sp(50));
    const cn = 'SF30' + 'CN ' + sp(35) + 'EI ' + '12-3456789' + sp(10) + sp(2) + sp(8) + sp(5);
    expect(cn).toHaveLength(80);
    expect(lines.filter((l) => l.startsWith('SF30')).at(-1)).toBe(cn);
  });

  it('requires every unified party, bans IM, and ties the ISF importer to the entry IOR', () => {
    const without = (code: string) => ({
      ...unified,
      unifiedIsf: { ...unified.unifiedIsf!, entities: unified.unifiedIsf!.entities.filter((e) => e.code !== code) },
    });
    expect(() => buildCargoRelease(without('LG'))).toThrow(/entity code LG/);
    expect(() =>
      buildCargoRelease({
        ...unified,
        unifiedIsf: {
          ...unified.unifiedIsf!,
          entities: [...unified.unifiedIsf!.entities, { code: 'IM' as never, identifier: { qualifier: 'EI', value: '12-3456789' } }],
        },
      }),
    ).toThrow(/IM should not be included/);
    expect(() =>
      buildCargoRelease({
        ...unified,
        unifiedIsf: { ...unified.unifiedIsf!, importer: { qualifier: 'EI', number: '98-7654321' } },
      }),
    ).toThrow(/same entity as the SE10 Importer of Record/);
  });

  it('emits only the SF10 on a unified ISF Delete (CR p.76 Note 3)', () => {
    const lines = buildCargoRelease({
      ...ADD_01,
      unifiedIsf: {
        shipmentTypeCode: '01',
        action: 'D',
        isfTransactionNumber: 'ABC-12345678901',
        importer: { qualifier: 'EI', number: '12-3456789' },
        entities: [],
      },
    });
    const sfLines = lines.filter((l) => l.startsWith('SF'));
    expect(sfLines).toHaveLength(1);
    expect(sfLines[0].slice(0, 8)).toBe('SF10' + '1' + '01' + 'D');
    expect(sfLines[0].slice(38, 53)).toBe('ABC-12345678901');
  });
});

// ── Full structures ────────────────────────────────────────

describe('buildCargoRelease — structures', () => {
  it('emits the full type-01 add sequence per the input usage map (CR p.24)', () => {
    const lines = buildCargoRelease(ADD_01);
    expect(lines.map((l) => l.slice(0, 4))).toEqual([
      'SE10', 'SE11', 'SE13',
      'SE15', 'SE15', 'SE17', // bill grouping: M+H pair, then equipment
      'SE20',
      'SE30', // CN identifier-only
      'SE30', 'SE31', 'SE35', 'SE36', // BY by name with GBI
      'SE40',
      'SE50', 'SE55', 'SE56', // MF by name
      'SE50', 'SE55', 'SE56', // SE by name
      'SE60',
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('builds a type-86 entry with EDA, a single bill and mandatory values (CR p.38/52/57/73)', () => {
    const lines = buildCargoRelease(ADD_86);
    expect(lines.filter((l) => l.startsWith('SE15'))).toHaveLength(1);
    expect(lines).toContain('SE20' + 'EDA' + '070125' + sp(44) + sp(23));
    expect(lines[0].slice(39, 49)).toBe('0000000750'); // ≤ $800
    // Consignee by name+address at the header (SE30 Note 1/2).
    const cn = lines.find((l) => l.startsWith('SE30' + 'CN'))!;
    expect(cn.slice(7, 42).trimEnd()).toBe('JANE SMITH');
    expect(lines.find((l) => l.startsWith('SE60'))!.slice(14, 24)).toBe('0000000750');
  });

  it('builds a type-06 FTZ weekly entry with SE41 per line and no bill records (CR p.39/65)', () => {
    const lines = buildCargoRelease(ADD_06);
    expect(lines.map((l) => l.slice(0, 4))).toEqual([
      'SE10', 'SE11', 'SE13', 'SE30', 'SE40', 'SE41', 'SE60', 'SE61',
    ]);
    expect(lines.find((l) => l.startsWith('SE11'))![4]).toBe('W'); // weekly election
    expect(lines.find((l) => l.startsWith('SE11'))!.slice(19, 39)).toBe('FTZ0260A01' + sp(10));
  });

  it('builds a cancellation as SE10 + SE13 + SE20 with the replacement entry (CR p.26/44)', () => {
    const lines = buildCargoRelease(CANCEL_03);
    expect(lines.map((l) => l.slice(0, 4))).toEqual(['SE10', 'SE13', 'SE20']);
    expect(lines[0][4]).toBe('D');
    expect(lines[1].slice(59, 61)).toBe('03'); // reason code, pos 60-61
    expect(lines[2]).toBe('SE20' + 'EN ' + 'ABC87654321' + sp(39) + sp(23));
  });

  it('builds an update with only SE10/SE11/SE13/SE15/SE16/SE17/SE20 (CR p.27/35)', () => {
    const lines = buildCargoRelease(UPDATE_BILLS);
    expect(lines.map((l) => l.slice(0, 4))).toEqual(['SE10', 'SE13', 'SE15', 'SE20']);
    expect(lines[0][4]).toBe('U');
  });
});

// ── Structural rejections (chapter rules) ──────────────────

describe('buildCargoRelease — chapter rules', () => {
  const patch = (p: Partial<CargoReleaseAddReplaceInput>) => () => buildCargoRelease({ ...ADD_01, ...p });

  it('requires V1 and AMT references for bond type 9 (SE10 Note 6)', () => {
    expect(patch({ bondType: '9' })).toThrow(/V1 .*AMT/);
  });

  it('rejects a mis-formatted AMT amount — leading zeros violate CR p.57', () => {
    expect(
      patch({
        bondType: '9',
        references: [
          { qualifier: 'V1', value: '123' },
          { qualifier: 'AMT', value: '090000' },
        ],
      }),
    ).toThrow(/AMT reference '090000' violates/);
  });

  it('caps the entry value at $800 for type 86 and $2500 for type 11 (SE10 Note 13)', () => {
    expect(() => buildCargoRelease({ ...ADD_86, estimatedValueDollars: 801 })).toThrow(/cannot exceed \$800/);
    expect(patch({ entryType: '11', estimatedValueDollars: 2501 })).toThrow(/cannot exceed \$2500/);
  });

  it('requires the EDA reference and a single bill for type 86 (SE20 Note 1, SE15 Note 12)', () => {
    expect(() => buildCargoRelease({ ...ADD_86, references: [] })).toThrow(/EDA/);
    expect(() =>
      buildCargoRelease({
        ...ADD_86,
        billGroupings: [...ADD_86.billGroupings!, { bills: [{ type: 'R', billNumber: '12399998888', quantity: 1 }] }],
      }),
    ).toThrow(/only one bill/);
    expect(() =>
      buildCargoRelease({
        ...ADD_86,
        billGroupings: [{ bills: [{ type: 'T', billNumber: '12312345678', quantity: 1 }] }],
      }),
    ).toThrow(/not allowed for type 86/);
  });

  it('requires line values for type 86 (SE60 Note 3)', () => {
    expect(() =>
      buildCargoRelease({ ...ADD_86, lines: [{ countryOfOrigin: 'CN', tariffs: [{ htsNumber: '8507600020' }] }] }),
    ).toThrow(/line value is mandatory for type 86/);
  });

  it('makes the SE41 mandatory per line for type 06 and forbids it elsewhere (CR p.65)', () => {
    expect(() =>
      buildCargoRelease({ ...ADD_06, lines: [{ countryOfOrigin: 'CN', tariffs: [{ htsNumber: '8507600020' }] }] }),
    ).toThrow(/SE41 record is mandatory/);
    expect(patch({ lines: [{ ...ADD_01.lines[0], ftz: { zoneStatus: 'P', quantity: 1 } }] })).toThrow(
      /used only for entry type 06/,
    );
    // Bills without an in-bond are not used for type 06 (SE15 Note 10).
    expect(() =>
      buildCargoRelease({ ...ADD_06, motCode: '11', billGroupings: [{ bills: [{ type: 'R', billNumber: 'MAEU123' }] }] }),
    ).toThrow(/not used for entry type 06/);
  });

  it('requires 9813-first SE60 pairs for type 23 TIB (SE60 Note 1)', () => {
    const tib = (tariffs: { htsNumber: string }[]) =>
      patch({ entryType: '23', lines: [{ ...ADD_01.lines[0], tariffs }] });
    expect(tib([{ htsNumber: '8507600020' }])).toThrow(/pairs/);
    expect(tib([{ htsNumber: '8507600020' }, { htsNumber: '9813000520' }])).toThrow(/lead with a 9813/);
    expect(tib([{ htsNumber: '9813000520' }, { htsNumber: '8507600020' }])).not.toThrow();
  });

  it('orders chapter 99 tariffs first with the value on the 1-97 line (SE60 Note 2)', () => {
    const line = ADD_01.lines[0];
    expect(
      patch({ lines: [{ ...line, tariffs: [{ htsNumber: '8507600020', valueDollars: 25000 }, { htsNumber: '9903880115' }] }] }),
    ).toThrow(/chapter 99 HTS numbers must be reported before/);
    expect(
      patch({
        lines: [{ ...line, tariffs: [{ htsNumber: '9903880115', valueDollars: 25000 }, { htsNumber: '8507600020', valueDollars: 25000 }] }],
      }),
    ).toThrow(/value is reported on the chapter 1-97/);
    expect(
      patch({ lines: [{ ...line, tariffs: [{ htsNumber: '9903880115' }, { htsNumber: '8507600020', valueDollars: 25000 }] }] }),
    ).not.toThrow();
  });

  it('demands an SE16 and a port of entry for Non-AMS bills (SE15 Notes 5/6)', () => {
    expect(
      patch({ billGroupings: [{ bills: [{ type: 'R', issuerCode: 'APLU', billNumber: 'APLU1', nonAms: true }] }] }),
    ).toThrow(/SE16 record is mandatory/);
    expect(
      patch({
        plannedPortOfEntry: undefined,
        billGroupings: [
          {
            bills: [{ type: 'R', issuerCode: 'APLU', billNumber: 'APLU1', nonAms: true }],
            conveyances: [{ carrierCode: 'APLU', voyageFlightTrip: '1', dateOfArrival: '070125', quantity: 1 }],
          },
        ],
      }),
    ).toThrow(/Non-AMS/);
  });

  it('keeps in-bond SE15s quantity-free, AMS-flagged and paired with a bill (SE15 Notes 1/5)', () => {
    expect(
      patch({ billGroupings: [{ bills: [{ type: 'I', billNumber: '123456789', nonAms: true }, { type: 'R', billNumber: 'MAEU1' }] }] }),
    ).toThrow(/Non-AMS indicator must be 'N'/);
    expect(
      patch({ billGroupings: [{ bills: [{ type: 'I', billNumber: '123456789', quantity: 5 }, { type: 'R', billNumber: 'MAEU1' }] }] }),
    ).toThrow(/must not contain a Quantity/);
    expect(patch({ billGroupings: [{ bills: [{ type: 'I', billNumber: '123456789' }] }] })).toThrow(
      /bill sequence 'I' is not a valid grouping/,
    );
    expect(patch({ billGroupings: [{ bills: [{ type: 'H', billNumber: 'X' }, { type: 'M', billNumber: 'Y' }] }] })).toThrow(
      /bill sequence 'HM' is not a valid grouping/,
    );
  });

  it('enforces entity-code-once-per-level and the identifier restrictions (SE30/SE50 Notes 1/3)', () => {
    expect(
      patch({
        headerEntities: [
          ...ADD_01.headerEntities!,
          { code: 'CN', identifier: { qualifier: 'EI', value: '98-7654321' } },
        ],
      }),
    ).toThrow(/maximum of one time/);
    expect(
      patch({
        lines: [{ ...ADD_01.lines[0], entities: [{ code: 'MF', identifier: { qualifier: 'EI', value: '12-3456789' } }] }],
      }),
    ).toThrow(/may only be used with Entity Codes BY, ST, or CN/);
    // CN by name+address is a types-11/86 privilege (SE30 Note 2).
    expect(
      patch({
        headerEntities: [
          {
            code: 'CN',
            name: 'JANE SMITH',
            addressComponents: [{ qualifier: '15', information: 'MAIN ST 1' }],
            geography: { city: 'LA', countryCode: 'US' },
          },
        ],
      }),
    ).toThrow(/low value entry types 11 and 86/);
  });

  it('requires the port of entry for in-bond, PGA and the Note-7 entry types (SE10 Note 7)', () => {
    expect(patch({ entryType: '02', plannedPortOfEntry: undefined })).toThrow(/entry type 02/);
    expect(
      patch({
        plannedPortOfEntry: undefined,
        billGroupings: [{ bills: [{ type: 'I', billNumber: '123456789' }, { type: 'R', billNumber: 'MAEU1' }] }],
      }),
    ).toThrow(/In-Bond number is reported/);
  });

  it('requires warehouse FIRMS for types 21/22 and the originating entry for 22 (SE10 Notes 9/10)', () => {
    expect(patch({ entryType: '21' })).toThrow(/FIRMS code of the CBP Bonded Warehouse/);
    expect(
      patch({ entryType: '22', additionalHeader: { bondedWarehouseFirms: 'A123' } }),
    ).toThrow(/originating warehouse entry number/);
    expect(
      patch({
        entryType: '22',
        additionalHeader: {
          bondedWarehouseFirms: 'A123',
          originatingWarehouseEntry: { filerCode: 'ABC', entryNumber: '11111111' },
        },
      }),
    ).not.toThrow();
  });

  it('requires the replacement reference matching the cancellation reason (SE13 Note 1)', () => {
    expect(() => buildCargoRelease({ ...CANCEL_03, references: [] })).toThrow(/replacement EN reference/);
    expect(() =>
      buildCargoRelease({ ...CANCEL_03, cancellation: { reasonCode: '02' } }),
    ).toThrow(/replacement IB reference/);
    expect(() =>
      buildCargoRelease({ ...CANCEL_03, cancellation: { reasonCode: '12' } }),
    ).toThrow(/Entry Type 06 Weekly ONLY/);
  });

  it('restricts the update action to its permitted record set (SE10 Note 1)', () => {
    const smuggled = { ...UPDATE_BILLS, lines: ADD_01.lines } as unknown as CargoReleaseInput;
    expect(() => buildCargoRelease(smuggled)).toThrow(/cannot be reported on an Update/);
    const cancelExtra = { ...CANCEL_03, lines: ADD_01.lines } as unknown as CargoReleaseInput;
    expect(() => buildCargoRelease(cancelExtra)).toThrow(/SE10 \+ SE13 \+ SE20 only/);
  });

  it('rejects class violations client-side via the codec', () => {
    // Contact phone is 15AN — hyphens are a class violation (CR p.44).
    expect(patch({ contact: { name: 'JOHN DOE', phone: '310-555-1234' } })).toThrow(RecordCodecError);
    expect(patch({ motCode: '99' })).toThrow(/unknown mode of transportation/);
    expect(patch({ estimatedValueDollars: 25000.5 })).toThrow(/whole number/);
  });
});

// ── SX response parsing (CR p.20/28-29, p.85) ──────────────

describe('parseCargoReleaseResponse', () => {
  const sxLines = [
    writeRecord(SE10, {
      actionCode: 'A',
      entryFilerCode: 'ABC',
      entryNumber: '12345678',
      entryType: '01',
      importerOfRecordType: 'EI',
      importerOfRecord: '12-3456789',
      modeOfTransportation: '11',
      bondType: '8',
      estimatedEntryValue: '0000025000',
    }),
    writeRecord(SE15, { billTypeIndicator: 'M', billIssuerCode: 'MAEU', billOfLadingNumber: 'MAEU123456789012', nonAmsIndicator: 'N' }),
    writeRecord(SE90, { messageTypeCode: '11', messageIdentifierCode: 'S10', narrativeMessageText: 'BILL NUMBER NOT ON FILE' }),
    writeRecord(SE20, { referenceIdentifierQualifier: 'CR', referenceIdentifier: 'MYREF001' }),
    writeRecord(SE90, { messageTypeCode: '13', messageIdentifierCode: 'W02', narrativeMessageText: 'REFERENCE TRUNCATED' }),
    writeRecord(SE90, { messageTypeCode: '03', narrativeMessageText: 'ENTRY ACCEPTED WITH WARNINGS' }),
  ];

  it('attaches record-level SE90s (≤9) to the records they follow and captures the final disposition', () => {
    const [response, ...rest] = parseCargoReleaseResponse(sxLines);
    expect(rest).toHaveLength(0);
    expect(response.entryFilerCode).toBe('ABC');
    expect(response.entryNumber).toBe('12345678');
    expect(response.entryType).toBe('01');
    expect(response.echoedRecords.map((r) => r.recordId)).toEqual(['SE10', 'SE15', 'SE20']);
    expect(response.echoedRecords[1].errors).toEqual([
      { messageTypeCode: '11', errorCode: 'S10', narrative: 'BILL NUMBER NOT ON FILE' },
    ]);
    expect(response.echoedRecords[2].errors).toEqual([
      { messageTypeCode: '13', errorCode: 'W02', narrative: 'REFERENCE TRUNCATED' },
    ]);
    expect(response.disposition).toMatchObject({
      messageTypeCode: '03',
      accepted: true,
      narrative: 'ENTRY ACCEPTED WITH WARNINGS',
      meaning: 'Message Accepted with Warning(s)',
    });
    expect(response.accepted).toBe(true);
  });

  it('splits transactions on SE10 and flags rejections and human-review referrals', () => {
    const multi = [
      ...sxLines,
      writeRecord(SE10, {
        actionCode: 'R',
        entryFilerCode: 'ABC',
        entryNumber: '87654321',
        entryType: '01',
        bondType: '8',
        estimatedEntryValue: '0000001000',
      }),
      writeRecord(SE90, { messageTypeCode: '01', narrativeMessageText: 'ENTRY REJECTED' }),
      writeRecord(SE10, {
        actionCode: 'D',
        entryFilerCode: 'ABC',
        entryNumber: '11112222',
        entryType: '01',
        bondType: '8',
        estimatedEntryValue: '0000001000',
      }),
      writeRecord(SE90, { messageTypeCode: '04', narrativeMessageText: 'CANCELLATION REQUEST UNDER REVIEW' }),
    ];
    const responses = parseCargoReleaseResponse(multi);
    expect(responses).toHaveLength(3);
    expect(responses[0].accepted).toBe(true);
    expect(responses[1].accepted).toBe(false);
    expect(responses[1].disposition?.meaning).toBe('Message Rejected');
    // 04 = referred to human review — neither accepted nor rejected.
    expect(responses[2].accepted).toBe(false);
    expect(responses[2].disposition?.meaning).toBe('Message Referred to Human Review');
  });

  it('parses a full SX batch through the envelope', () => {
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'SX',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: sxLines }],
    });
    const parsed = parseCargoReleaseResponseBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0].entryNumber).toBe('12345678');
  });
});

// ── SO status notification parsing (SO p.20-38) ────────────

/**
 * The two SO70 lines below are byte-exact reconstructions of the
 * chapter's printed Note-8 examples (SO p.35) — the print collapses runs
 * of spaces, so the reconstruction restores the fixed-width padding and
 * is verified by collapsing back to the printed text. The examples carry
 * PGA Processing Group Version 01, so the line-range fields use the
 * pre-04 sizes (CBP line 4N, tariff position 1N — SO p.35 Note 7).
 */
const SO70_EXAMPLE_1 =
  'SO70' + 'FDA' + 'DEV' + '052616' + '0919' + '01' + 'DATA UNDER PGA REVIEW'.padEnd(28) +
  sp(2) + '01' + sp(2) + '00011001' + sp(14) + '01';
const SO70_EXAMPLE_2 =
  'SO70' + 'FDA' + 'DEV' + '052616' + '0932' + '07' + 'MAY PROCEED'.padEnd(28) +
  sp(2) + '07' + '22' + '00011001' + sp(14) + '01';

describe('parseCargoReleaseStatus', () => {
  const soLines = [
    writeRecord(SO10, {
      districtPortOfEntry: '2704',
      entryFilerCode: 'ABC',
      entryNumber: '12345678',
      entryTypeCode: '01',
      importerOfRecordNumber: '12-3456789',
      carrierCode: 'MAEU',
      vesselName: 'EVER GIVEN',
      voyageFlightTripNumber: '123E',
      estimatedDateOfArrival: '070125',
      splitShipmentReleaseCode: '1',
    }),
    writeRecord(SO20, { referenceIdentifierQualifier: 'CR', referenceIdentifier: 'MYREF001' }),
    writeRecord(SO20, { referenceIdentifierQualifier: 'RSN', referenceIdentifier: '16' }),
    writeRecord(SO30, { lineItemIdentifier: '001', countryOfOrigin: 'CN', htsNumber: '8507600020' }),
    writeRecord(SO40, { billTypeIndicator: 'M', billIssuerCode: 'MAEU', billOfLadingNumber: 'MAEU123456789012' }),
    writeRecord(SO40, { billTypeIndicator: 'H', billIssuerCode: 'HLCU', billOfLadingNumber: 'HLCU987654321', quantity: '00000100', unitOfMeasure: 'CTNS', manifestedQuantity: '00000100' }),
    writeRecord(SO42, {
      inBondNumber: '123456789',
      inBondEntryType: '61',
      portOfInBondDeparture: '2704',
      portOfInBondArrival: '3901',
      inBondCreateDate: '062825',
      dateOfInBondArrival: '070125',
      inBondQuantity: '00000050',
    }),
    writeRecord(SO50, {
      dispositionDate: '070125',
      dispositionTime: '0915',
      dispositionCode: '93',
      narrativeMessage: 'BILL ON FILE',
      splitIndicator: 'Y',
      carrierCode: 'MAEU',
      voyageFlightTripNumber: '123E',
      dateOfArrival: '070125',
      districtPortOfArrival: '2704',
    }),
    writeRecord(SO60, {
      dispositionActionDate: '070125',
      dispositionActionTime: '0916',
      dispositionActionCode: '03',
      narrativeMessage: 'PENDING INTENSIVE EXAM',
    }),
    writeRecord(SO60, {
      dispositionActionDate: '070225',
      dispositionActionTime: '1130',
      dispositionActionCode: '98',
      narrativeMessage: 'RELEASED',
      releaseDate: '070225',
      releaseOriginCode: '03',
    }),
    SO70_EXAMPLE_1,
    SO70_EXAMPLE_2,
    writeRecord(SO71, {
      referenceQualifier1: '01',
      referenceNumber1: 'PN1234567890',
      receiptDate: '052616',
      receiptTime: '091905',
      subReasonCode1: '188',
      subReasonCode2: '101',
      referenceQualifier2: '06',
      referenceNumber2: 'EDEC12345678901234',
    }),
    writeRecord(SO72, { commentsToTrade: 'CONTACT FDA PRIOR NOTICE CENTER' }),
  ];

  it('reconstructs the printed SO70 examples byte-exact modulo the print-collapsed padding (SO p.35)', () => {
    expect(SO70_EXAMPLE_1).toHaveLength(80);
    expect(SO70_EXAMPLE_2).toHaveLength(80);
    expect(SO70_EXAMPLE_1.replace(/ +/g, ' ').trimEnd()).toBe(
      'SO70FDADEV052616091901DATA UNDER PGA REVIEW 01 00011001 01',
    );
    expect(SO70_EXAMPLE_2.replace(/ +/g, ' ').trimEnd()).toBe(
      'SO70FDADEV052616093207MAY PROCEED 072200011001 01',
    );
  });

  it('parses the SO10 header, references with RSN meanings, and lines', () => {
    const [n, ...rest] = parseCargoReleaseStatus(soLines);
    expect(rest).toHaveLength(0);
    expect(n).toMatchObject({
      portOfEntry: '2704',
      entryFilerCode: 'ABC',
      entryNumber: '12345678',
      entryType: '01',
      importerOfRecordNumber: '12-3456789',
      vesselName: 'EVER GIVEN',
      correctionResponse: false,
    });
    expect(n.references).toEqual([
      { qualifier: 'CR', value: 'MYREF001', meaning: 'Filer-defined Reference Number (echoed from the SE input)' },
      { qualifier: 'RSN', value: '16', meaning: 'Provided replacement entry is not on file.' },
    ]);
    expect(n.lines).toEqual([{ lineNumber: '001', countryOfOrigin: 'CN', htsNumber: '8507600020' }]);
  });

  it('groups the M+H SO40 pair with its SO42 in-bond leg and SO50 bill match (SO p.20/26-29)', () => {
    const [n] = parseCargoReleaseStatus(soLines);
    expect(n.billGroupings).toHaveLength(1);
    const grouping = n.billGroupings[0];
    expect(grouping.bills.map((b) => b.billType)).toEqual(['M', 'H']);
    expect(grouping.bills[1]).toMatchObject({ billNumber: 'HLCU987654321', quantity: '00000100', manifestedQuantity: '00000100' });
    expect(grouping.inBonds).toEqual([
      {
        inBondNumber: '123456789',
        entryType: '61',
        portOfDeparture: '2704',
        portOfArrival: '3901',
        createDate: '062825',
        arrivalDate: '070125',
        quantity: '00000050',
      },
    ]);
    expect(grouping.match).toMatchObject({
      dispositionCode: '93',
      meaning: 'BILL ON FILE',
      split: true,
      carrierCode: 'MAEU',
      portOfArrival: '2704',
    });
  });

  it('parses SO60 release dispositions, with release date and origin only on 22/98 (SO p.30-32)', () => {
    const [n] = parseCargoReleaseStatus(soLines);
    expect(n.releaseDispositions).toHaveLength(2);
    expect(n.releaseDispositions[0]).toMatchObject({
      code: '03',
      meaning: 'PENDING INTENSIVE EXAM',
      releaseDate: undefined,
      releaseOrigin: undefined,
    });
    expect(n.releaseDispositions[1]).toMatchObject({
      code: '98',
      meaning: 'RELEASED',
      releaseDate: '070225',
      releaseOrigin: { code: '03', meaning: 'Actual Arrival Date' },
    });
  });

  it('parses the printed SO70 examples with pre-04 line-range positions (SO p.35 Notes 7/8)', () => {
    const [n] = parseCargoReleaseStatus(soLines);
    expect(n.pgaStatuses).toHaveLength(2);
    expect(n.pgaStatuses[0]).toMatchObject({
      agencyCode: 'FDA',
      programCode: 'DEV',
      statusActionDate: '052616',
      statusActionTime: '0919',
      entryLevelStatusCode: '01',
      entryLevelStatusMessage: 'DATA UNDER PGA REVIEW',
      lineLevelStatusCode: '01',
      statusReasonCode: undefined,
      beginningCbpLine: '0001', // 4N under group version 01
      beginningTariffPosition: '1', // 1N under group version 01
      beginningPgaLine: '001',
      processingGroupVersion: '01',
    });
    expect(n.pgaStatuses[1]).toMatchObject({
      agencyCode: 'FDA',
      statusActionTime: '0932',
      entryLevelStatusCode: '07',
      entryLevelStatusMessage: 'MAY PROCEED',
      lineLevelStatusCode: '07',
      statusReasonCode: '22',
      beginningCbpLine: '0001',
      beginningPgaLine: '001',
    });
  });

  it('attaches SO71 details (ten sub-reason slots + second reference pair) and SO72 comments to their SO70', () => {
    const [n] = parseCargoReleaseStatus(soLines);
    expect(n.pgaStatuses[0].details).toHaveLength(0);
    expect(n.pgaStatuses[1].details).toEqual([
      {
        referenceQualifier: '01',
        referenceNumber: 'PN1234567890',
        receiptDate: '052616',
        receiptTime: '091905',
        subReasonCodes: ['188', '101'],
        secondReferenceQualifier: '06',
        secondReferenceNumber: 'EDEC12345678901234',
      },
    ]);
    expect(n.pgaStatuses[1].comments).toEqual(['CONTACT FDA PRIOR NOTICE CENTER']);
    // All ten sub-reason slots are readable (SO p.36).
    const tenSlots = writeRecord(SO71, Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`subReasonCode${i + 1}`, String(100 + i)]),
    ));
    const parsed = parseCargoReleaseStatus([SO70_EXAMPLE_1, tenSlots]);
    expect(parsed[0].pgaStatuses[0].details[0].subReasonCodes).toEqual([
      '100', '101', '102', '103', '104', '105', '106', '107', '108', '109',
    ]);
  });

  it('parses version-04 SO70 records with the printed rev-36 positions (SO p.33)', () => {
    const v04 =
      'SO70' + 'EPA' + 'TS1' + '052616' + '0919' + '02' + 'HOLD INTACT'.padEnd(28) +
      sp(2) + '02' + '11' + '002' + '01' + '003' + '004' + '02' + '005' + 'DOC01' + '2' + '04';
    expect(v04).toHaveLength(80);
    const [n] = parseCargoReleaseStatus([v04]);
    expect(n.pgaStatuses[0]).toMatchObject({
      agencyCode: 'EPA',
      beginningCbpLine: '002', // 3N under group version 04
      beginningTariffPosition: '01', // 2N under group version 04
      beginningPgaLine: '003',
      endingCbpLine: '004',
      endingTariffPosition: '02',
      endingPgaLine: '005',
      documentTypeCode: 'DOC01',
      entryHoldType: '2',
      processingGroupVersion: '04',
    });
  });

  it('starts a new bill grouping after an SO50 and splits notifications on SO10', () => {
    const second = [
      writeRecord(SO40, { billTypeIndicator: 'R', billIssuerCode: 'APLU', billOfLadingNumber: 'APLU1' }),
      writeRecord(SO50, {
        dispositionDate: '070125',
        dispositionTime: '0915',
        dispositionCode: '91',
        narrativeMessage: 'NO BILL MATCH',
        splitIndicator: 'N',
      }),
    ];
    const [n] = parseCargoReleaseStatus([...soLines, ...second]);
    expect(n.billGroupings).toHaveLength(2);
    expect(n.billGroupings[1].bills.map((b) => b.billNumber)).toEqual(['APLU1']);
    expect(n.billGroupings[1].match?.meaning).toBe('NO BILL MATCH');
    const two = parseCargoReleaseStatus([...soLines, ...soLines]);
    expect(two).toHaveLength(2);
  });

  it('parses a full SO batch through the envelope', () => {
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'SO',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: soLines }],
    });
    const parsed = parseCargoReleaseStatusBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.notifications).toHaveLength(1);
    expect(parsed.notifications[0].entryNumber).toBe('12345678');
  });
});
