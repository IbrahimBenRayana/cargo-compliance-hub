import { describe, it, expect } from 'vitest';
import { tradePartyErrors, type TradePartyInput } from '../isfTradeParties';

const full = (name: string) => ({ name, address1: '1 Main St', address2: '', city: 'Shanghai', state: '', zip: '', country: 'CN' });
const empty = () => ({ name: '', address1: '', address2: '', city: '', state: '', zip: '', country: '' });

const base = (over: Partial<TradePartyInput> = {}): TradePartyInput => ({
  buyer: full('Buyer'), seller: full('Seller'), shipToParty: full('Ship To'),
  manufacturer: full('Maker'), consolidator: full('Consol'), containerStuffingLocation: full('CFS'),
  additionalManufacturers: [], consolidationMode: null, perHblOverrides: [{}], houseBillCount: 1,
  ...over,
});

describe('tradePartyErrors', () => {
  it('passes a single filing with every party filled', () => {
    expect(tradePartyErrors(base())).toEqual({});
  });

  it('flags a missing shared seller on a single filing', () => {
    const e = tradePartyErrors(base({ seller: empty() }));
    expect(e['seller.name']).toBeDefined();
  });

  it('does not require the hidden shared seller and manufacturer in buyer consolidation', () => {
    const e = tradePartyErrors(base({
      seller: empty(), manufacturer: empty(), consolidationMode: 'buyer', houseBillCount: 2,
      perHblOverrides: [
        { seller: full('S1'), manufacturer: full('M1') },
        { seller: full('S2'), manufacturer: full('M2') },
      ],
    }));
    expect(e).toEqual({});
  });

  it('names the house bill whose vendor is missing in buyer consolidation', () => {
    const e = tradePartyErrors(base({
      seller: empty(), manufacturer: empty(), consolidationMode: 'buyer', houseBillCount: 2,
      perHblOverrides: [{ seller: full('S1'), manufacturer: full('M1') }, {}],
    }));
    expect(Object.keys(e).sort()).toEqual(['perHbl.1.manufacturer', 'perHbl.1.seller']);
  });

  it('flags an incomplete per-house-bill card by field', () => {
    const e = tradePartyErrors(base({
      seller: empty(), manufacturer: empty(), consolidationMode: 'buyer', houseBillCount: 1,
      perHblOverrides: [{ seller: { ...full('S1'), city: '' }, manufacturer: full('M1') }],
    }));
    expect(e).toEqual({ 'perHbl.0.seller.city': 'City is required' });
  });

  it('lets an LCL house bill inherit a filled shared party', () => {
    const e = tradePartyErrors(base({
      consolidationMode: 'lcl', houseBillCount: 1,
      perHblOverrides: [{ seller: full('S1') }],
    }));
    expect(e).toEqual({});
  });

  it('still requires the shared consolidator and stuffing location in consolidation', () => {
    const e = tradePartyErrors(base({
      consolidator: empty(), consolidationMode: 'buyer', houseBillCount: 1,
      perHblOverrides: [{ seller: full('S1'), manufacturer: full('M1') }],
    }));
    expect(e['consolidator.name']).toBeDefined();
  });
});
