/**
 * The port pickers once offered invented names: '2704 — New Orleans, LA',
 * '1001 — Portland, ME', and 5-digit Schedule K codes labelled as US towns.
 * A filer picking a port by name sent CBP a different port's code. These
 * names are pinned to CBP's own lists: ACE Appendix E (Schedule D, Feb 3 2026)
 * and CAMIR Ocean Appendix F (Schedule K, Jul 23 2026).
 */
import { describe, it, expect } from 'vitest';
import { CBP_PORTS_4DIGIT, ENTRY_PORTS } from '../schedule-d-ports';
import { SCHEDULE_K_PORTS } from '../schedule-k-ports';

const labelOf = (list: { value: string; label: string }[], code: string) =>
  list.find((p) => p.value === code)?.label;

describe('Schedule D (US ports, 4 digits)', () => {
  it.each([
    ['2704', 'Los Angeles, California'],
    ['2709', 'Long Beach, California'],
    ['4601', 'New York/Newark Area, Newark, New Jersey'],
    ['1001', 'New York, New York'],
    ['5301', 'Houston, Texas'],
    ['2002', 'New Orleans, Louisiana'],
    ['1703', 'Savannah, Georgia'],
    ['1701', 'Brunswick, Georgia'],
    ['0101', 'Portland, Maine'],
    ['3001', 'Seattle, Washington'],
  ])('%s is %s', (code, name) => {
    expect(labelOf(CBP_PORTS_4DIGIT, code)).toBe(`${code} — ${name}`);
  });

  it('holds only unique 4-digit codes, each labelled with its own code', () => {
    const codes = CBP_PORTS_4DIGIT.map((p) => p.value);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of CBP_PORTS_4DIGIT) {
      expect(p.value).toMatch(/^\d{4}$/);
      expect(p.label.startsWith(`${p.value} — `)).toBe(true);
    }
  });

  it('offers no placeholder or deactivated code', () => {
    const codes = new Set(CBP_PORTS_4DIGIT.map((p) => p.value));
    // 0000 is not a CBP code; the rest are deactivated in Appendix E's change table.
    for (const code of ['0000', '2781', '2782', '2787', '2788', '3707', '5274']) {
      expect(codes.has(code)).toBe(false);
    }
  });

  it('feeds the entry wizard the same list', () => {
    expect(ENTRY_PORTS).toBe(CBP_PORTS_4DIGIT);
  });
});

describe('Schedule K (foreign ports, 5 digits)', () => {
  it.each([
    ['57035', 'Shanghai, China (Mainland)'],
    ['57078', 'Yantian, China (Mainland)'],
    ['58201', 'Hong Kong, Hong Kong'],
    ['58023', 'Busan; Pusan, South Korea'],
    ['42157', 'Rotterdam, Netherlands'],
    // Once labelled 'Calais, ME' and 'Houlton, ME'.
    ['01535', 'Toronto, ONT, Canada'],
    ['01822', 'Montreal, QUE, Canada'],
  ])('%s is %s', (code, name) => {
    expect(labelOf(SCHEDULE_K_PORTS, code)).toBe(`${code} — ${name}`);
  });

  it('holds only unique 5-digit codes, each labelled with its own code', () => {
    const codes = SCHEDULE_K_PORTS.map((p) => p.value);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of SCHEDULE_K_PORTS) {
      expect(p.value).toMatch(/^\d{5}$/);
      expect(p.label.startsWith(`${p.value} — `)).toBe(true);
    }
  });

  it('names no US state in a foreign port label', () => {
    // The old list read like '12200 — Newark, NJ'.
    const usStyle = SCHEDULE_K_PORTS.filter((p) => /, (ME|VT|NY|NJ|CA|TX|FL|LA|WA|GA)$/.test(p.label));
    expect(usStyle).toEqual([]);
  });
});
