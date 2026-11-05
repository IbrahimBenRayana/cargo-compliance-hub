/** Monthly invoice rating for invoiced (pilot) accounts — pricing plan v2 §5.1. */
import { describe, it, expect } from 'vitest';
import { rateMonth, monthWindow, parsePeriod, checkIsfBands, PILOT_DEFAULTS } from '../invoiceRating.js';

const at = (d: number) => new Date(Date.UTC(2026, 10, d));
const isfs = (n: number, cents = 500) => Array.from({ length: n }, (_, i) => ({ kind: 'isf' as const, amountCents: cents, billedAt: at(1 + (i % 28)) }));
const TERMS = { minimumCents: 25000, includedIsfs: 50, minimumPrepaid: false };

describe('rateMonth', () => {
  it('pilot defaults are the plan numbers: $250 minimum incl. 50 ISFs, $5/ISF to 250, $4/ISF from 251', () => {
    expect(PILOT_DEFAULTS).toEqual({
      monthlyMinimumCents: 25000,
      includedIsfs: 50,
      isfCents: 500,
      isfBands: [{ fromIsf: 251, cents: 400 }],
    });
  });

  it('under the included count: the minimum only', () => {
    const r = rateMonth(isfs(30), TERMS);
    expect(r.lines).toEqual([
      expect.objectContaining({ code: 'minimum', quantity: 1, amountCents: 25000, description: expect.stringMatching(/includes 50 accepted ISFs \(30 used\)/) }),
    ]);
    expect(r.totalCents).toBe(25000);
  });

  it('above it: minimum + each extra ISF at its locked rate (120 ISFs → $250 + 70 × $5 = $600)', () => {
    const r = rateMonth(isfs(120), TERMS);
    expect(r.lines[1]).toMatchObject({ code: 'isf_overage', quantity: 70, unitCents: 500, amountCents: 35000 });
    expect(r.totalCents).toBe(60000);
  });

  it('with no bands, every ISF above the included count is at its locked rate (300 ISFs → $1,500)', () => {
    expect(rateMonth(isfs(300), TERMS).totalCents).toBe(150000);
  });

  it('the earliest accepted ISFs are the included ones', () => {
    const rows = [
      { kind: 'isf' as const, amountCents: 400, billedAt: at(20) }, // later, cheaper rate
      { kind: 'isf' as const, amountCents: 500, billedAt: at(2) },
    ];
    const r = rateMonth(rows, { ...TERMS, includedIsfs: 1 });
    expect(r.lines[1]).toMatchObject({ quantity: 1, amountCents: 400 });
  });

  it('a prepaid month skips the minimum line but still bills the overage', () => {
    const r = rateMonth(isfs(60), { ...TERMS, minimumPrepaid: true });
    expect(r.lines.map((l) => l.code)).toEqual(['isf_overage']);
    expect(r.totalCents).toBe(5000);
  });

  it('entries bill per kind at their locked prices', () => {
    const rows = [
      ...isfs(10),
      { kind: 'entry_linked' as const, amountCents: 1200, billedAt: at(3) },
      { kind: 'entry_linked' as const, amountCents: 1200, billedAt: at(4) },
      { kind: 'entry' as const, amountCents: 1500, billedAt: at(5) },
    ];
    const r = rateMonth(rows, TERMS);
    expect(r.lines.slice(1)).toEqual([
      expect.objectContaining({ code: 'entry_linked', quantity: 2, amountCents: 2400 }),
      expect.objectContaining({ code: 'entry', quantity: 1, amountCents: 1500 }),
    ]);
    expect(r.totalCents).toBe(25000 + 3900);
  });

  it('mixed rates in one month: one overage line, quantity and total, no unit price', () => {
    const rows = [...isfs(1, 500), ...isfs(1, 400)];
    const r = rateMonth(rows, { minimumCents: 0, includedIsfs: 0, minimumPrepaid: false });
    expect(r.lines).toEqual([expect.objectContaining({ code: 'isf_overage', quantity: 2, unitCents: null, amountCents: 900 })]);
  });

  it('nothing to bill → no lines', () => {
    expect(rateMonth([], { minimumCents: 0, includedIsfs: 0, minimumPrepaid: false })).toEqual({ lines: [], totalCents: 0, isfCount: 0 });
  });
});

describe('rateMonth with ISF price bands (pilot ladder: $5 for 51-250, $4 from 251)', () => {
  const BANDED = { ...TERMS, isfBands: [{ fromIsf: 251, cents: 400 }] };

  it('250 ISFs stay in the first band: $250 + 200 × $5 = $1,250', () => {
    const r = rateMonth(isfs(250), BANDED);
    expect(r.lines.map((l) => l.code)).toEqual(['minimum', 'isf_overage']);
    expect(r.lines[1]).toMatchObject({ quantity: 200, unitCents: 500, amountCents: 100000, description: 'Accepted ISFs 51-250: 200 × $5' });
    expect(r.totalCents).toBe(125000);
  });

  it('300 ISFs: $250 + 200 × $5 + 50 × $4 = $1,450', () => {
    const r = rateMonth(isfs(300), BANDED);
    expect(r.lines.slice(1)).toEqual([
      expect.objectContaining({ code: 'isf_overage', quantity: 200, amountCents: 100000 }),
      expect.objectContaining({ code: 'isf_band', quantity: 50, unitCents: 400, amountCents: 20000, description: 'Accepted ISFs 251 and above: 50 × $4' }),
    ]);
    expect(r.totalCents).toBe(145000);
  });

  it('the last band runs on past 1,000 until another band is set (1,200 ISFs → $5,050)', () => {
    expect(rateMonth(isfs(1200), BANDED).totalCents).toBe(25000 + 200 * 500 + 950 * 400);
  });

  it('a further band (e.g. by written amendment above 1,000) caps the one before it', () => {
    const r = rateMonth(isfs(1100), { ...TERMS, isfBands: [{ fromIsf: 251, cents: 400 }, { fromIsf: 1001, cents: 350 }] });
    expect(r.lines.slice(1).map((l) => [l.code, l.quantity, l.amountCents, l.description])).toEqual([
      ['isf_overage', 200, 100000, 'Accepted ISFs 51-250: 200 × $5'],
      ['isf_band', 750, 300000, 'Accepted ISFs 251-1,000: 750 × $4'],
      ['isf_band', 100, 35000, 'Accepted ISFs 1,001 and above: 100 × $3.50'],
    ]);
  });

  it('bands count in acceptance order: the earliest accepted ISFs fall in the lower bands', () => {
    const rows = [
      { kind: 'isf' as const, amountCents: 500, billedAt: at(20) },
      { kind: 'isf' as const, amountCents: 500, billedAt: at(2) },
      { kind: 'isf' as const, amountCents: 500, billedAt: at(9) },
    ];
    const r = rateMonth(rows, { minimumCents: 0, includedIsfs: 1, minimumPrepaid: false, isfBands: [{ fromIsf: 3, cents: 100 }] });
    expect(r.lines.map((l) => [l.code, l.quantity, l.amountCents])).toEqual([['isf_overage', 1, 500], ['isf_band', 1, 100]]);
  });

  it('a band starting inside the included count never bills an included ISF', () => {
    const r = rateMonth(isfs(60), { ...TERMS, isfBands: [{ fromIsf: 40, cents: 400 }] });
    expect(r.lines.slice(1)).toEqual([expect.objectContaining({ code: 'isf_band', quantity: 10, amountCents: 4000 })]);
    expect(r.totalCents).toBe(29000);
  });

  it('a prepaid month still applies the bands', () => {
    const r = rateMonth(isfs(260), { ...BANDED, minimumPrepaid: true });
    expect(r.totalCents).toBe(200 * 500 + 10 * 400);
  });

  it('entries are not affected by ISF bands', () => {
    const rows = [...isfs(300), { kind: 'entry' as const, amountCents: 1500, billedAt: at(5) }];
    expect(rateMonth(rows, BANDED).totalCents).toBe(145000 + 1500);
  });
});

describe('checkIsfBands', () => {
  it('accepts no bands and the pilot ladder', () => {
    expect(checkIsfBands(null)).toBeNull();
    expect(checkIsfBands([])).toBeNull();
    expect(checkIsfBands([{ fromIsf: 251, cents: 400 }, { fromIsf: 1001, cents: 350 }])).toBeNull();
  });

  it('refuses bands out of order, duplicated, or with bad numbers', () => {
    expect(checkIsfBands([{ fromIsf: 1001, cents: 350 }, { fromIsf: 251, cents: 400 }])).toMatch(/order/);
    expect(checkIsfBands([{ fromIsf: 251, cents: 400 }, { fromIsf: 251, cents: 300 }])).toMatch(/order/);
    expect(checkIsfBands([{ fromIsf: 1, cents: 400 }])).toMatch(/ISF number/);
    expect(checkIsfBands([{ fromIsf: 251.5, cents: 400 }])).toMatch(/ISF number/);
    expect(checkIsfBands([{ fromIsf: 251, cents: -1 }])).toMatch(/cents/);
    expect(checkIsfBands([{ fromIsf: 251, cents: 4.5 }])).toMatch(/cents/);
    expect(checkIsfBands(Array.from({ length: 6 }, (_, i) => ({ fromIsf: 100 + i, cents: 400 })))).toMatch(/5 bands/);
  });
});

describe('periods', () => {
  it('parses YYYY-MM to the UTC month', () => {
    const p = parsePeriod('2026-11')!;
    expect(monthWindow(p)).toEqual({ start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') });
    expect(parsePeriod('2026-13')).toBeNull();
    expect(parsePeriod('nope')).toBeNull();
  });
});
