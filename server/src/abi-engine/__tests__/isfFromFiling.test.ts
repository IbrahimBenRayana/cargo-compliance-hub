/**
 * Platform Filing → IsfInput mapper tests. Fixtures mirror what a real
 * Prisma Filing row looks like after services/validation.ts has passed it
 * (JSONB parties as objects AND serialized strings, nested address shapes,
 * dotted HTS numbers) and every mapped input is run through buildIsf() to
 * full 80-char wire lines.
 */
import { describe, it, expect } from 'vitest';
import { buildIsf } from '../isf/builder.js';
import { mapFilingToIsfInput, type PlatformIsfFiling } from '../isf/fromFiling.js';
import { RecordCodecError } from '../records/codec.js';

const sp = (n: number) => ' '.repeat(n);
const ids = (lines: string[]) => lines.map((l) => l.slice(0, 4));

// ── Fixtures (platform-shaped) ─────────────────────────────

/** ISF-10 row the way the platform stores it: mixed JSONB party shapes. */
const ISF10_FILING: PlatformIsfFiling = {
  filingType: 'ISF-10',
  importerName: 'Acme Imports LLC',
  importerNumber: '12-3456789',
  consigneeName: 'Acme Imports LLC',
  consigneeNumber: '12-3456789',
  consigneeAddress: { address1: '100 Main St', city: 'Los Angeles', state: 'CA', zip: '90001', country: 'US' },
  // Serialized JSONB — exercises the legacy partyField string tolerance.
  seller: JSON.stringify({
    name: 'Shenzhen Trading Co., Ltd.',
    address1: '88 Nanshan Road',
    city: 'Shenzhen',
    state: 'GD',
    zip: '518000',
    country: 'CN',
  }),
  // Nested address object shape ({ address: { street, ... } }).
  buyer: {
    name: 'Acme Imports LLC',
    address: { street: '100 Main St', city: 'Los Angeles', state: 'CA', zip: '90001', country: 'US' },
  },
  shipToParty: { name: 'Acme DC', address1: '9 Warehouse Way', city: 'Long Beach', state: 'CA', zip: '90802', country: 'US' },
  consolidator: { name: 'Global Consol', address1: 'Harbour Way 2', city: 'Hong Kong', country: 'HK' },
  containerStuffingLocation: { name: 'Shenzhen CFS', address1: 'Port Road 1', city: 'Shenzhen', country: 'CN' },
  manufacturer: [
    { name: 'Shenzhen Battery Co Ltd', address1: '88 Nanshan Road', city: 'Shenzhen', state: 'GD', zip: '518000', country: 'CN' },
  ],
  commodities: [
    { htsCode: '8507.60.0020', countryOfOrigin: 'CN', description: 'Lithium-ion batteries', quantity: 500, weight: { value: 1200, unit: 'K' } },
    { htsCode: '392690', countryOfOrigin: 'CN', description: 'Plastic housings' },
  ],
  containers: [{ number: 'MSKU1234567', type: '40HC' }],
  masterBol: 'MAEU123456789012', // stored WITH its SCAC prefix — mapper must not double it
  houseBol: null,
  scacCode: 'MAEU',
  bondType: 'continuous',
  estimatedArrival: '2026-09-01T00:00:00.000Z',
};

/** ISF-5 (FROB) row: filer EIN + booking party in isf5Data, ports top-level. */
const ISF5_FILING: PlatformIsfFiling = {
  filingType: 'ISF-5',
  importerNumber: null,
  scacCode: 'MAEU',
  masterBol: 'MAEU987654321098',
  houseBol: null,
  shipToParty: { name: 'Bonded Warehouse Inc', address1: '1 Dock Rd', city: 'Newark', state: 'NJ', zip: '07102', country: 'US' },
  isf5Data: {
    ISFFilerNumber: '98-7654321',
    bookingPartyName: 'Booking Partners BV',
    bookingPartyAddress1: 'Kade 12',
    bookingPartyCity: 'Rotterdam',
    bookingPartyCountry: 'NL',
  },
  commodities: [{ htsCode: '850760' }, { htsCode: '3926.90', countryOfOrigin: 'CN' }],
  foreignPortOfUnlading: 'NLRTM',
  placeOfDelivery: 'DEHAM',
};

const ADD = { action: 'A' as const };

// ── ISF-10 mapping ─────────────────────────────────────────

describe('mapFilingToIsfInput — ISF-10 (straight master bill)', () => {
  const input = mapFilingToIsfInput(ISF10_FILING, ADD);
  const lines = buildIsf(input);

  it('maps importer, bond fallback and a de-duplicated straight bill', () => {
    expect(input.submissionType).toBe('1');
    expect(input.importer).toEqual({ qualifier: 'EI', number: '12-345678900' }); // EIN padded to NN-NNNNNNNXX
    expect(input.bond).toEqual({ holder: '12-345678900', activityCode: '01', type: '8' }); // holder ← importer
    expect(input.bills).toEqual([{ qualifier: 'OB', scac: 'MAEU', billNumber: '123456789012' }]); // SCAC prefix peeled
    expect(input.references).toBeUndefined();
    expect(input.manufacturers).toHaveLength(1);
    expect(input.manufacturers![0].tariffs).toHaveLength(2); // tariffs from filing.commodities
  });

  it('builds through buildIsf() with the canonical ISF-10 record sequence', () => {
    expect(ids(lines)).toEqual([
      'SF10', 'SF15', 'SF25',
      'SF30',                 // IM (identifier-only)
      'SF30',                 // CN (identifier-only)
      'SF30', 'SF35', 'SF36', // SE
      'SF30', 'SF35', 'SF36', // BY
      'SF30', 'SF35', 'SF36', // ST
      'SF30', 'SF35', 'SF36', // LG
      'SF30', 'SF35', 'SF36', // CS
      'SF30', 'SF35', 'SF36', // MF
      'SF40', 'SF40',
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('lays out the SF10 header from platform fields', () => {
    const expected =
      'SF10' + '1' + '01' + 'A' + 'CT' + 'EI ' + '12-345678900' + sp(3) + // importer EI, normalised EIN
      sp(8) + '11' + sp(15) + 'MAEU' + // DOB, MOT 11 (containerised), txn space filled on Add, SCAC
      '12-345678900' + sp(3) + '01' + '8' + sp(3) + sp(2); // bond holder/activity/type
    expect(expected).toHaveLength(80);
    expect(lines[0]).toBe(expected);
  });

  it('lays out the SF15 straight bill (OB) with the SCAC prefix restored once', () => {
    const expected = 'SF15' + 'OB' + 'MAEU123456789012' + sp(34) + sp(24);
    expect(lines[1]).toBe(expected);
  });

  it('splits the ISO container number into an SF25 initial/serial/check digit', () => {
    const expected = 'SF25' + '40' + 'MSKU' + '000000000123456' + '7' + sp(4) + sp(50);
    expect(lines[2]).toBe(expected);
  });

  it('reports IM and CN as identifier-only EI entities (SF30-only)', () => {
    const im = 'SF30' + 'IM ' + sp(35) + 'EI ' + '12-345678900' + sp(8) + sp(2) + sp(8) + sp(5);
    const cn = 'SF30' + 'CN ' + sp(35) + 'EI ' + '12-345678900' + sp(8) + sp(2) + sp(8) + sp(5);
    expect(lines[3]).toBe(im);
    expect(lines[4]).toBe(cn);
  });

  it('maps a JSON-string party through sanitisation to SF30/SF35/SF36', () => {
    // seller was a serialized JSON string; 'Co., Ltd.' loses its punctuation.
    expect(lines[5]).toBe('SF30' + 'SE ' + 'SHENZHEN TRADING CO LTD' + sp(12) + sp(3) + sp(20) + sp(2) + sp(8) + sp(5));
    expect(lines[6]).toBe('SF35' + '15' + '88 NANSHAN ROAD' + sp(20) + sp(2) + sp(35) + sp(2)); // qualifier 15 unstructured
    expect(lines[7]).toBe('SF36' + 'SHENZHEN' + sp(27) + 'GD ' + sp(6) + '518000' + sp(9) + 'CN' + sp(15));
  });

  it('maps commodities to nested SF40s with digits-only HTS numbers', () => {
    expect(lines[23]).toBe('SF40' + '8507600020' + 'CN' + sp(64)); // '8507.60.0020' → digits
    expect(lines[24]).toBe('SF40' + '392690' + sp(4) + 'CN' + sp(64));
  });
});

describe('mapFilingToIsfInput — ISF-10 house bill variant', () => {
  it('emits a BM house bill plus an MB reference for the master', () => {
    const input = mapFilingToIsfInput({ ...ISF10_FILING, houseBol: 'HB00123456' }, ADD);
    expect(input.bills).toEqual([{ qualifier: 'BM', scac: 'MAEU', billNumber: 'HB00123456' }]);
    expect(input.references).toEqual([{ qualifier: 'MB', value: 'MAEU123456789012' }]);

    const lines = buildIsf(input);
    expect(lines[1]).toBe('SF15' + 'BM' + 'MAEUHB00123456' + sp(36) + sp(24));
    expect(lines[2]).toBe('SF20' + 'MB ' + 'MAEU123456789012' + sp(34) + sp(23));
    expect(ids(lines).slice(0, 4)).toEqual(['SF10', 'SF15', 'SF20', 'SF25']);
  });
});

describe('mapFilingToIsfInput — single-transaction bond', () => {
  it('maps bondType single to type 9 / activity 16 with V1 + SBN references', () => {
    const input = mapFilingToIsfInput(
      { ...ISF10_FILING, bondType: 'single', suretyCode: 'AB1', bondReferenceNumber: 'REF123' },
      ADD,
    );
    expect(input.bond).toEqual({ holder: '12-345678900', activityCode: '16', type: '9' });
    expect(input.references).toEqual([
      { qualifier: 'V1', value: 'AB1' },
      { qualifier: 'SBN', value: 'REF123' },
    ]);
    expect(() => buildIsf(input)).not.toThrow(); // builder's type-9 rules are satisfied
  });

  it('rejects a single-transaction bond without surety data instead of fabricating it', () => {
    expect(() => mapFilingToIsfInput({ ...ISF10_FILING, bondType: 'single' }, ADD)).toThrow(RecordCodecError);
    expect(() => mapFilingToIsfInput({ ...ISF10_FILING, bondType: 'single' }, ADD)).toThrow(/bondType/);
  });
});

// ── Delete ─────────────────────────────────────────────────

describe('mapFilingToIsfInput — delete action', () => {
  it('produces the minimal SF10-only delete transaction', () => {
    const input = mapFilingToIsfInput(ISF10_FILING, { action: 'D', isfTransactionNumber: 'ABC-12345678901' });
    const lines = buildIsf(input);
    const expected =
      'SF10' + '1' + '01' + 'D' + sp(2) + 'EI ' + '12-345678900' + sp(3) +
      sp(8) + sp(2) + 'ABC-12345678901' + sp(4) + sp(15) + sp(2) + sp(1) + sp(3) + sp(2);
    expect(expected).toHaveLength(80);
    expect(lines).toEqual([expected]);
  });

  it('throws without the CBP-assigned ISF transaction number', () => {
    expect(() => mapFilingToIsfInput(ISF10_FILING, { action: 'D' })).toThrow(RecordCodecError);
    expect(() => mapFilingToIsfInput(ISF10_FILING, { action: 'D' })).toThrow(/isfTransactionNumber/);
  });
});

// ── ISF-5 ──────────────────────────────────────────────────

describe('mapFilingToIsfInput — ISF-5', () => {
  const input = mapFilingToIsfInput(ISF5_FILING, ADD);
  const lines = buildIsf(input);

  it('maps the filer EIN, BKP/ST entities, top-level tariffs and FROB routing', () => {
    expect(input.submissionType).toBe('2');
    expect(input.importer).toEqual({ qualifier: 'EI', number: '98-765432100' });
    expect(input.bond).toBeUndefined(); // no bond element in the ISF-5 data set
    expect(input.entities.map((e) => e.code)).toEqual(['BKP', 'ST']);
    expect(input.tariffs).toEqual([
      { htsNumber: '850760', countryOfOrigin: undefined },
      { htsNumber: '392690', countryOfOrigin: 'CN' },
    ]);
    expect(input.frob).toEqual({
      portOfUnladingQualifier: 'UN',
      foreignPortOfUnlading: 'NLRTM',
      placeOfDeliveryQualifier: 'UN',
      placeOfDelivery: 'DEHAM',
    });
  });

  it('builds the ISF-5 record sequence ending in the trailing SF40 block + SF50', () => {
    expect(ids(lines)).toEqual([
      'SF10', 'SF15',
      'SF30', 'SF35', 'SF36', // BKP
      'SF30', 'SF35', 'SF36', // ST
      'SF40', 'SF40', 'SF50',
    ]);
    const sf10 =
      'SF10' + '2' + '01' + 'A' + 'CT' + 'EI ' + '98-765432100' + sp(3) +
      sp(8) + sp(2) + sp(15) + 'MAEU' + sp(15) + sp(2) + sp(1) + sp(3) + sp(2);
    expect(lines[0]).toBe(sf10);
    expect(lines[8]).toBe('SF40' + '850760' + sp(4) + sp(2) + sp(64)); // origin not required for ISF-5
    expect(lines[9]).toBe('SF40' + '392690' + sp(4) + 'CN' + sp(64));
    expect(lines[10]).toBe('SF50' + 'UN ' + 'NLRTM' + sp(10) + 'UN ' + 'DEHAM' + sp(10) + sp(40));
  });
});

// ── Rejections (no fabricated regulated data) ──────────────

describe('mapFilingToIsfInput — unusable source data', () => {
  it('throws when the importer number is missing', () => {
    const broken = { ...ISF10_FILING, importerNumber: null };
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(RecordCodecError);
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(/importerNumber/);
  });

  it('throws when there is no bill of lading', () => {
    const broken = { ...ISF10_FILING, masterBol: null };
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(/masterBol/);
  });

  it('throws when there are no commodities to derive tariffs from', () => {
    const broken = { ...ISF10_FILING, commodities: [] };
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(/commodities/);
    const brokenIsf5 = { ...ISF5_FILING, commodities: null };
    expect(() => mapFilingToIsfInput(brokenIsf5, ADD)).toThrow(/commodities/);
  });

  it('throws when the ISF-10 has no manufacturer instead of inventing one', () => {
    const broken = { ...ISF10_FILING, manufacturer: null };
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(/manufacturer/);
  });

  it('throws when the ISF-5 booking party has no name', () => {
    const broken = { ...ISF5_FILING, isf5Data: { ISFFilerNumber: '98-7654321' } };
    expect(() => mapFilingToIsfInput(broken, ADD)).toThrow(/bookingParty/);
  });
});
