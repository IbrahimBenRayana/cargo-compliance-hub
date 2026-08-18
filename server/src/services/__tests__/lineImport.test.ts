/**
 * Bulk invoice-line CSV import — parser + per-row validation against the
 * same abiItemSchema the wizard enforces. Row numbers in errors are
 * spreadsheet rows (header = row 1, first data row = 2) so a user can
 * find the offending line in Excel without off-by-one archaeology.
 */
import { describe, it, expect } from 'vitest';
import {
  parseLineImportCsv,
  LINE_IMPORT_TEMPLATE,
  MAX_IMPORT_ROWS,
} from '../lineImport.js';

const HEADER =
  'sku,hts_number,description,origin_country,total_value,currency,exchange_rate,quantity1,gross_weight,weight_uom,manufacturer_name,manufacturer_address,manufacturer_city,manufacturer_country,buyer_tax_id';

const GOOD_ROW =
  'BAT-01,8507.60.0020,LITHIUM ION BATTERY PACKS,CN,10000,USD,1,500 NO,2646,LB,SHENZHEN BATTERY CO,,SHENZHEN,CN,26-164751100';

describe('parseLineImportCsv', () => {
  it('imports a valid row into a wizard-shaped item', () => {
    const result = parseLineImportCsv(`${HEADER}\n${GOOD_ROW}`);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item).toMatchObject({
      sku: 'BAT-01',
      htsNumber: '8507600020', // dots stripped
      description: 'LITHIUM ION BATTERY PACKS',
      origin: { country: 'CN' },
      values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 10000 },
      quantity1: '500 NO',
      weight: { gross: '2646', uom: 'L' }, // LB → L
    });
    expect(item.parties).toEqual([
      { type: 'manufacturer', name: 'SHENZHEN BATTERY CO', city: 'SHENZHEN', country: 'CN' },
      { type: 'buyer', taxId: '26-164751100' },
    ]);
  });

  it('round-trips its own template', () => {
    const result = parseLineImportCsv(LINE_IMPORT_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('handles quoted fields containing commas', () => {
    const row = GOOD_ROW.replace(
      'LITHIUM ION BATTERY PACKS',
      '"BATTERY PACKS, LITHIUM-ION, 48V"'
    );
    const result = parseLineImportCsv(`${HEADER}\n${row}`);
    expect(result.errors).toEqual([]);
    expect(result.items[0].description).toBe('BATTERY PACKS, LITHIUM-ION, 48V');
  });

  it('reports a bad HTS with the spreadsheet row number', () => {
    const bad = GOOD_ROW.replace('8507.60.0020', '85076');
    const result = parseLineImportCsv(`${HEADER}\n${GOOD_ROW}\n${bad}`);
    expect(result.items).toHaveLength(1); // good row still imports
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // header=1, good=2, bad=3
    expect(result.errors[0].field).toBe('hts_number');
  });

  it('accepts KG/LB (and bare K/L) as weight units', () => {
    const kg = GOOD_ROW.replace(',LB,', ',KG,');
    const result = parseLineImportCsv(`${HEADER}\n${kg}`);
    expect(result.items[0].weight.uom).toBe('K');
  });

  it('strips thousands separators in the value column', () => {
    const row = GOOD_ROW.replace(',10000,', ',"10,000",');
    const result = parseLineImportCsv(`${HEADER}\n${row}`);
    expect(result.errors).toEqual([]);
    expect(result.items[0].values.totalValueOfGoods).toBe(10000);
  });

  it('rejects a file missing required header columns', () => {
    const result = parseLineImportCsv('sku,description\nBAT-01,STUFF');
    expect(result.items).toEqual([]);
    expect(result.errors[0].row).toBe(1);
    expect(result.errors[0].message).toMatch(/missing.*hts_number/i);
  });

  it('requires at least one party (manufacturer or buyer)', () => {
    const noParties = 'BAT-01,8507.60.0020,PACKS,CN,10000,USD,1,500 NO,2646,LB,,,,,';
    const result = parseLineImportCsv(`${HEADER}\n${noParties}`);
    expect(result.items).toEqual([]);
    expect(result.errors[0].field).toBe('manufacturer_name');
  });

  it('enforces the row cap instead of importing a monster file', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => GOOD_ROW);
    const result = parseLineImportCsv(`${HEADER}\n${rows.join('\n')}`);
    expect(result.items).toEqual([]);
    expect(result.errors[0].message).toMatch(/at most/i);
  });

  it('skips fully blank lines without erroring', () => {
    const result = parseLineImportCsv(`${HEADER}\n${GOOD_ROW}\n\n\n`);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.totalRows).toBe(1);
  });
});
