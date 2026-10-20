import { describe, it, expect } from 'vitest';
import { parseCurrencyRateRecord, parseCurrencyUpdateBatch } from '../apps/currency/updateParser.js';

describe('%R currency update (CATAIR CEU-6)', () => {
  it('parses the live 10/09/26 EUR broadcast', () => {
    expect(parseCurrencyRateRecord('%1ATEUR100926 1119300D')).toEqual({
      countryCode: 'AT', currencyCode: 'EUR', rateDate: '20261009', rate: 1.1193, indicator: 'D',
    });
  });

  it('keeps an N (no rate published) record as a valid record with rate 0', () => {
    expect(parseCurrencyRateRecord('%1ATEUR101126 0000000N')).toMatchObject({ rate: 0, indicator: 'N' });
  });

  it('ignores lines that are not %1 records', () => {
    expect(parseCurrencyRateRecord('B  1303S7P%R')).toBeNull();
  });

  it('reads every rate in an enveloped batch', () => {
    const rates = parseCurrencyUpdateBatch([
      'A1303S7PBCFX2J101626     %R',
      'B  1303S7P%R',
      '%1ATEUR100926 1119300D',
      '%1ATEUR101326 1119600D',
      'Y  1303S7P%R00002',
      'Z1303S7P      101626',
    ]);
    expect(rates.map((r) => r.rateDate)).toEqual(['20261009', '20261013']);
  });
});
