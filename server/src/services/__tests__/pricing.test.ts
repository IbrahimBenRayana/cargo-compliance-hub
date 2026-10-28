/** Pricing v2: a shipment is priced by what was filed, from the org's own prices. */
import { describe, it, expect } from 'vitest';
import { resolvePricing, priceFor, entryPricingSet, requiresPaymentMethod, checkPriceInput } from '../pricing.js';

describe('resolvePricing', () => {
  it('uses the plan default ISF price when the org has none', () => {
    expect(resolvePricing(4500, null)).toEqual({ isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null });
  });

  it("an org's own prices win over the plan default", () => {
    const p = resolvePricing(4500, { isfCents: 3000, entryLinkedCents: 10500, entryOnlyCents: 12500 });
    expect(p).toEqual({ isfCents: 3000, entryLinkedCents: 10500, entryOnlyCents: 12500 });
  });

  it('an explicit $0 ISF price is kept (free account), not treated as unset', () => {
    expect(resolvePricing(4500, { isfCents: 0 }).isfCents).toBe(0);
  });

  it('no plan → $0', () => {
    expect(resolvePricing(null, null).isfCents).toBe(0);
  });
});

describe('priceFor', () => {
  const p = { isfCents: 4500, entryLinkedCents: 10500, entryOnlyCents: 12500 };
  it('prices each kind separately', () => {
    expect(priceFor('isf', p)).toBe(4500);
    expect(priceFor('entry_linked', p)).toBe(10500);
    expect(priceFor('entry', p)).toBe(12500);
  });
  it('an unpriced entry is null (never silently $0)', () => {
    expect(priceFor('entry', { isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null })).toBeNull();
  });
});

describe('entryPricingSet / requiresPaymentMethod', () => {
  it('entry pricing needs both prices', () => {
    expect(entryPricingSet({ isfCents: 4500, entryLinkedCents: 1, entryOnlyCents: 2 })).toBe(true);
    expect(entryPricingSet({ isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null })).toBe(false);
  });
  it('a card is needed when anything costs money', () => {
    expect(requiresPaymentMethod({ isfCents: 4500, entryLinkedCents: null, entryOnlyCents: null })).toBe(true);
    expect(requiresPaymentMethod({ isfCents: 0, entryLinkedCents: 0, entryOnlyCents: 0 })).toBe(false);
    expect(requiresPaymentMethod({ isfCents: 0, entryLinkedCents: 0, entryOnlyCents: 500 })).toBe(true);
  });
});

describe('checkPriceInput', () => {
  it('accepts a valid price set', () => {
    expect(checkPriceInput({ isfCents: 4500, entryLinkedCents: 10500, entryOnlyCents: 12500 })).toBeNull();
    expect(checkPriceInput({ isfCents: null, entryLinkedCents: null, entryOnlyCents: null })).toBeNull();
  });
  it('entry prices are set together or not at all (pricing plan CR1)', () => {
    expect(checkPriceInput({ isfCents: null, entryLinkedCents: 10500, entryOnlyCents: null })).toMatch(/together/);
  });
  it('rejects negative or fractional cents', () => {
    expect(checkPriceInput({ isfCents: -1, entryLinkedCents: null, entryOnlyCents: null })).toMatch(/whole/);
    expect(checkPriceInput({ isfCents: 1.5, entryLinkedCents: null, entryOnlyCents: null })).toMatch(/whole/);
  });
});
