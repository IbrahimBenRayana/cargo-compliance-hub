import { describe, it, expect } from 'vitest';
import { dollarsToCents, money, pricingLines } from '../pricing';

describe('dollarsToCents', () => {
  it('parses dollar amounts', () => {
    expect(dollarsToCents('45')).toBe(4500);
    expect(dollarsToCents('$45.50')).toBe(4550);
    expect(dollarsToCents('0.29')).toBe(29);
  });
  it('blank means "use the default"', () => {
    expect(dollarsToCents('  ')).toBeNull();
  });
  it('rejects anything else', () => {
    expect(dollarsToCents('4.555')).toBeNaN();
    expect(dollarsToCents('-1')).toBeNaN();
    expect(dollarsToCents('abc')).toBeNaN();
  });
});

describe('pricingLines', () => {
  it('ISF only when entries are not priced', () => {
    expect(pricingLines({ isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null })).toEqual(['$45 per accepted ISF']);
  });
  it('shows cents only when needed', () => {
    expect(money(500)).toBe('$5');
    expect(money(450)).toBe('$4.50');
  });
});
