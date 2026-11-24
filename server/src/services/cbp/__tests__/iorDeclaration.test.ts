/** Foreign IOR 15-Record cutover (CSMS #70409426). */
import { describe, it, expect } from 'vitest';
import { iorDeclarationRequired } from '../iorDeclaration.js';

describe('iorDeclarationRequired', () => {
  it('follows CBP PROD deployment on 2027-01-05 (Eastern)', () => {
    expect(iorDeclarationRequired('PROD', new Date('2027-01-05T04:59:59Z'), '')).toBe(false);
    expect(iorDeclarationRequired('PROD', new Date('2027-01-05T05:00:00Z'), '')).toBe(true);
  });

  it('is already on for CERT (deployed 2026-11-12) and for local mock traffic', () => {
    expect(iorDeclarationRequired('CERT', new Date('2026-11-16T12:00:00Z'), '')).toBe(true);
    expect(iorDeclarationRequired('NONE', new Date('2026-11-16T12:00:00Z'), '')).toBe(true);
    expect(iorDeclarationRequired('CERT', new Date('2026-11-11T12:00:00Z'), '')).toBe(false);
  });

  it('lets ops move the date if CBP does', () => {
    expect(iorDeclarationRequired('PROD', new Date('2027-01-05T12:00:00Z'), '2027-01-06T00:00:00-05:00')).toBe(false);
    expect(() => iorDeclarationRequired('PROD', new Date(), 'soon')).toThrow(/not a date/);
  });
});
