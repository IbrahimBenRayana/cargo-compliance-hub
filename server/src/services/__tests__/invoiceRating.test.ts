/** Monthly invoice rating for invoiced (pilot) accounts — pricing plan v2 §5.1. */
import { describe, it, expect } from 'vitest';
import { rateMonth, monthWindow, parsePeriod, PILOT_DEFAULTS } from '../invoiceRating.js';

const at = (d: number) => new Date(Date.UTC(2026, 10, d));
const isfs = (n: number, cents = 500) => Array.from({ length: n }, (_, i) => ({ kind: 'isf' as const, amountCents: cents, billedAt: at(1 + (i % 28)) }));
const TERMS = { minimumCents: 25000, includedIsfs: 50, minimumPrepaid: false };

describe('rateMonth', () => {
  it('pilot defaults are the plan numbers: $250 minimum incl. 50 ISFs, then $5/ISF', () => {
    expect(PILOT_DEFAULTS).toEqual({ monthlyMinimumCents: 25000, includedIsfs: 50, isfCents: 500 });
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

  it('matches the ladder-equivalent at 300 ISFs ($1,500)', () => {
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

describe('periods', () => {
  it('parses YYYY-MM to the UTC month', () => {
    const p = parsePeriod('2026-11')!;
    expect(monthWindow(p)).toEqual({ start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') });
    expect(parsePeriod('2026-13')).toBeNull();
    expect(parsePeriod('nope')).toBeNull();
  });
});
