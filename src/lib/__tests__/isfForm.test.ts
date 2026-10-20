import { describe, it, expect } from 'vitest';
import { toCommodityForms, toContainerForms, toCommodityForm, normalizeContainerType } from '../isfForm';

const emptyC = () => ({ htsCode: '', description: '', countryOfOrigin: '', quantity: '', quantityUOM: 'PKG', weight: '', weightUOM: 'K' });
const emptyK = () => ({ number: '', type: 'CN' });

describe('ISF form hydration (audit UFF-01)', () => {
  it('keeps every commodity line', () => {
    const stored = [
      { htsCode: '850760', countryOfOrigin: 'CN', quantity: 10, quantityUOM: 'CTN', weight: { value: 100, unit: 'K' } },
      { htsCode: '850650', countryOfOrigin: 'CN', quantity: 5, quantityUOM: 'PCS' },
    ];
    const forms = toCommodityForms(stored, emptyC);
    expect(forms).toHaveLength(2);
    expect(forms.map((f) => f.htsCode)).toEqual(['850760', '850650']);
  });

  it('keeps the stored quantity unit (CTN stays CTN)', () => {
    expect(toCommodityForm({ quantityUOM: 'CTN', weight: { unit: 'K' } }).quantityUOM).toBe('CTN');
  });

  it('only defaults the unit when none is stored', () => {
    expect(toCommodityForm({ weight: { unit: 'L' } }).quantityUOM).toBe('PCS');
    expect(toCommodityForm({}).quantityUOM).toBe('PKG');
  });

  it('keeps every container', () => {
    const forms = toContainerForms([{ number: 'MSKU1', type: '40HC' }, { number: 'MSKU2', type: '20' }], emptyK);
    expect(forms).toEqual([{ number: 'MSKU1', type: '40HC' }, { number: 'MSKU2', type: '20' }]);
  });

  it('starts with one empty line when nothing is stored', () => {
    expect(toCommodityForms(undefined, emptyC)).toEqual([emptyC()]);
    expect(toContainerForms([], emptyK)).toEqual([emptyK()]);
  });
});

describe('container types (audit FNA-14)', () => {
  it('maps legacy UI values to the types the server accepts', () => {
    expect(normalizeContainerType('40H')).toBe('40HC');
    expect(normalizeContainerType('45')).toBe('45HC');
    expect(normalizeContainerType('20')).toBe('20');
  });
});
