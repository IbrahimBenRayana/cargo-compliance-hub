/** BUG-016: a master-only ISF from the API (house bill = master bill) loads as a Regular bill. */
import { describe, it, expect } from 'vitest';
import { billTypeOf } from '../isfBillType';

describe('billTypeOf', () => {
  it('is a house bill when a different house bill number is on file', () => {
    expect(billTypeOf({ masterBol: 'MAEU1', houseBol: 'HBL9' })).toBe('HOUSE');
  });
  it('is a regular bill when there is no house bill', () => {
    expect(billTypeOf({ masterBol: 'MAEU1', houseBol: null })).toBe('REGULAR');
    expect(billTypeOf({ masterBol: 'MAEU1', houseBol: '' })).toBe('REGULAR');
  });
  it('is a regular bill when the house bill just repeats the master bill', () => {
    expect(billTypeOf({ masterBol: 'MAEU2610', houseBol: 'MAEU2610' })).toBe('REGULAR');
    expect(billTypeOf({ masterBol: 'maeu2610', houseBol: ' MAEU2610 ' })).toBe('REGULAR');
  });
});
