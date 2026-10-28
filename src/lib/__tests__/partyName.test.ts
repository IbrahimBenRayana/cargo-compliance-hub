/** BUG-017: manufacturers are stored as a list; the shipment page said "Not provided". */
import { describe, it, expect } from 'vitest';
import { getPartyName } from '@/types/shipment';

describe('getPartyName', () => {
  it('names a single party or a plain string', () => {
    expect(getPartyName({ name: 'QA Export Trading Ltd' } as any)).toBe('QA Export Trading Ltd');
    expect(getPartyName('Legacy Co')).toBe('Legacy Co');
    expect(getPartyName(null)).toBe('');
  });
  it('names every party in a list (several manufacturers)', () => {
    expect(getPartyName([{ name: 'Maker A' }, { name: 'Maker B' }] as any)).toBe('Maker A, Maker B');
    expect(getPartyName([{ name: 'Only Maker' }] as any)).toBe('Only Maker');
    expect(getPartyName([] as any)).toBe('');
  });
});
