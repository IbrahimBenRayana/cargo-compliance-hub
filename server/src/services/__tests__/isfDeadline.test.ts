import { describe, it, expect } from 'vitest';
import { isfFilingDeadline } from '../isfDeadline.js';

describe('isfFilingDeadline', () => {
  it('is 24h before an estimated lading one day before departure (48h before ETD)', () => {
    expect(isfFilingDeadline('2026-11-10T12:00:00Z').toISOString()).toBe('2026-11-08T12:00:00.000Z');
  });

  it('is earlier than the old ETD-24h rule, so countdowns never overstate time left', () => {
    const etd = new Date('2026-11-10T12:00:00Z');
    expect(isfFilingDeadline(etd).getTime()).toBeLessThan(etd.getTime() - 24 * 3600_000);
  });
});
