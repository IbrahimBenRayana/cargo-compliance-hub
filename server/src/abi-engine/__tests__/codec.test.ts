import { describe, it, expect } from 'vitest';
import { writeRecord, parseRecord, type RecordDef } from '../records/codec.js';
import { INPUT_50 } from '../ae/lineRecordDefs.js';

// CATAIR Record Layout Key: class N = "numeric data only" (every position a
// digit); class (S)N MAY carry leading spaces. CBP's own reference wires
// zero-fill both, and ACE's cargo-release derivation reads a space-padded
// 50-record value as ZERO (live SX 11022/11119 on scenario 061, fixed by
// zero-filling per CBP rep Michael Barela, 10/2/2026).
const DEF: RecordDef = {
  id: 'ZZ',
  name: 'CodecProbe',
  fields: [
    { name: 'controlIdentifier', start: 1, end: 2, class: 'AN', designation: 'M', constant: 'ZZ' },
    { name: 'count', start: 3, end: 8, class: 'N', designation: 'M' },
    { name: 'amount', start: 9, end: 18, class: 'SN', designation: 'C' },
    { name: 'code', start: 19, end: 22, class: 'AN', designation: 'C' },
    { name: 'filler', start: 23, end: 80, class: 'S', designation: 'M' },
  ],
};

describe('writeRecord numeric padding', () => {
  it('zero-fills class N values', () => {
    expect(writeRecord(DEF, { count: '42' }).slice(2, 8)).toBe('000042');
  });

  it('zero-fills class (S)N values', () => {
    expect(writeRecord(DEF, { count: '1', amount: '15288' }).slice(8, 18)).toBe('0000015288');
  });

  it('leaves an absent optional numeric field space-filled', () => {
    expect(writeRecord(DEF, { count: '1' }).slice(8, 18)).toBe('          ');
  });

  it('still left-justifies and space-pads alphanumerics', () => {
    expect(writeRecord(DEF, { count: '1', code: 'KG' }).slice(18, 22)).toBe('KG  ');
  });

  it('round-trips a zero-filled numeric through parseRecord', () => {
    const line = writeRecord(DEF, { count: '7', amount: '300' });
    expect(parseRecord(DEF, line).values).toMatchObject({ count: '0000007'.slice(1), amount: '0000000300' });
  });
});

describe('50-record matches the CBP reference wire for scenario 061', () => {
  it('renders value and quantities zero-filled', () => {
    const line = writeRecord(INPUT_50, {
      htsNumber: '9404409022',
      dutyAmount: '195686',
      valueOfGoodsAmount: '15288',
      quantity1: '67200',
      uomCode1: 'NO',
      quantity2: '348700',
      uomCode2: 'KG',
    });
    // Michael Barela's accepted line (10/2) zero-fills value and quantity 1;
    // zero-filling every numeric is equally valid and matches the other
    // CBP samples (Karl 9/15, Christopher 9/14).
    expect(line.slice(0, 50)).toBe('509404409022 0000195686 0000015288 000000067200NO ');
    expect(line.slice(50, 64)).toBe('000000348700KG');
  });
});
