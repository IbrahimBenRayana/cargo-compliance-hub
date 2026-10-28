/**
 * Add Manufacturer ($I/$R) tests — record layouts asserted to exact
 * 80-char lines per the AMF chapter (March 2023 v3.0), builder splitting
 * rules for the 70/30 name, 43/51 street, and 23/44 city continuations,
 * and response parsing incl. the ACE-returned MID.
 */
import { describe, it, expect } from 'vitest';
import { buildAddManufacturers } from '../apps/addManufacturer/builder.js';
import { parseAmfResponse, parseAmfResponseBatch } from '../apps/addManufacturer/responseParser.js';
import { RecordCodecError } from '../records/codec.js';
import { buildBatch } from '../envelope/batch.js';

const pad = (s: string) => s.padEnd(80, ' ');

describe('buildAddManufacturers', () => {
  it('builds a compact add: $1 + $3 (+$4 for the US zip)', () => {
    const lines = buildAddManufacturers([
      { action: 'add', countryCode: 'TW', name: 'NICSAN', street: '435 INDUSTRIAL RD', city: 'TAICHUNG' },
    ]);
    expect(lines).toEqual([
      pad('$1A00001TWNICSAN'),
      pad('$2                              435 INDUSTRIAL RD'),
      pad('$3' + ' '.repeat(51) + 'TAICHUNG'),
    ]);
  });

  it('splits long name/street/city across $1-$4 at 70/43/23', () => {
    const name = 'N'.repeat(70) + 'OVERFLOWNAME';
    const street = 'S'.repeat(43) + 'TREETOVERFLOW';
    const city = 'C'.repeat(23) + 'ITYOVERFLOW';
    const lines = buildAddManufacturers([
      { action: 'add', countryCode: 'DE', name, street, city },
    ]);
    expect(lines[0]).toBe(pad('$1A00001DE' + 'N'.repeat(70)));
    expect(lines[1]).toBe(pad('$2OVERFLOWNAME' + ' '.repeat(18) + 'S'.repeat(43)));
    expect(lines[2]).toBe(pad('$3TREETOVERFLOW' + ' '.repeat(38) + 'C'.repeat(23)));
    expect(lines[3]).toBe(pad('$4ITYOVERFLOW'));
  });

  it('US/Canada/China adds require a postal code; Canada uses province codes', () => {
    expect(() =>
      buildAddManufacturers([{ action: 'add', countryCode: 'US', name: 'ACME', city: 'DENVER' }])
    ).toThrow(/ZIP\/postal/);

    const lines = buildAddManufacturers([
      {
        action: 'add', countryCode: 'CA', stateOrProvince: 'ON',
        name: 'MAPLE AUTO PARTS', street: '77 KING ST', city: 'TORONTO', zipOrPostalCode: 'M5H 1A1',
      },
    ]);
    expect(lines[0].startsWith('$1A00001XOMAPLE AUTO PARTS')).toBe(true);
    expect(lines[3]).toBe(pad('$4' + ' '.repeat(44) + 'M5H 1A1'));

    expect(() =>
      buildAddManufacturers([{ action: 'add', countryCode: 'CA', name: 'MAPLE', city: 'TORONTO', zipOrPostalCode: 'M5H1A1' }])
    ).toThrow(/province/);
  });

  it('postal update emits $1(U, space country/name) + $4(zip + MID)', () => {
    const lines = buildAddManufacturers([
      { action: 'updatePostalCode', manufacturerId: 'TWNICSAN435TAI', zipOrPostalCode: '40768' },
    ]);
    expect(lines).toEqual([
      pad('$1U00001'),
      pad('$4' + ' '.repeat(44) + '40768' + ' '.repeat(5) + 'TWNICSAN435TAI'),
    ]);
  });

  it('sequences loops and enforces the 999 cap', () => {
    const two = buildAddManufacturers([
      { action: 'add', countryCode: 'JP', name: 'ONE', city: 'OSAKA' },
      { action: 'add', countryCode: 'JP', name: 'TWO', city: 'KOBE' },
    ]);
    expect(two.some((l) => l.startsWith('$1A00002JPTWO'))).toBe(true);

    const many = Array.from({ length: 1000 }, () => ({
      action: 'add' as const, countryCode: 'JP', name: 'X', city: 'OSAKA',
    }));
    expect(() => buildAddManufacturers(many)).toThrow(/999/);
    expect(() => buildAddManufacturers([])).toThrow(RecordCodecError);
  });
});

describe('parseAmfResponse', () => {
  it('assembles status, split name, ACE MID, and errors per loop', () => {
    const results = parseAmfResponse([
      pad('$5U00001TW' + 'NICSAN'),
      pad('$6' + ' '.repeat(31) + 'TWNICSAN435TAI'),
      pad('$5E00002DEBROKEN FIRM'),
      pad('$7A01 COUNTRY CODE INVALID'),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      updateStatus: 'U', sequenceNumber: 1, countryCode: 'TW',
      firmName: 'NICSAN', manufacturerId: 'TWNICSAN435TAI',
    });
    expect(results[1].updateStatus).toBe('E');
    expect(results[1].errors).toEqual([{ id: 'A01', narrative: 'COUNTRY CODE INVALID' }]);
  });

  it('round-trips through a full $R wire batch', () => {
    const wire = buildBatch({
      sender: { siteCode: 'LA', idCode: 'MCL', password: 'PASSWD' },
      appId: '$R',
      blocks: [
        {
          port: '2704',
          filerCode: 'SP7',
          transactionLines: [pad('$5U00001TWNICSAN'), pad('$6' + ' '.repeat(31) + 'TWNICSAN435TAI')],
        },
      ],
    });
    const { results } = parseAmfResponseBatch(wire);
    expect(results).toHaveLength(1);
    expect(results[0].manufacturerId).toBe('TWNICSAN435TAI');
  });
});
