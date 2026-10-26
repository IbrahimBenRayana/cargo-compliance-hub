/**
 * Tests for computeLiquidation — PSC / liquidation windows.
 *
 * The PSC window follows CBP's FR Doc. 2026-13574 (Jul 6 2026): a PSC must
 * be filed within 300 days of the date of entry.
 */

import { describe, it, expect } from 'vitest';
import { computeLiquidation, PSC_WINDOW_DAYS, LIQUIDATION_WINDOW_DAYS } from '../liquidation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY = new Date('2026-01-01T00:00:00Z');
const daysAfterEntry = (n: number) => new Date(ENTRY.getTime() + n * DAY_MS);

describe('computeLiquidation', () => {
  it('uses a 300-day PSC window and a 314-day liquidation window', () => {
    expect(PSC_WINDOW_DAYS).toBe(300);
    expect(LIQUIDATION_WINDOW_DAYS).toBe(314);
  });

  it('puts the PSC deadline exactly 300 days after entry', () => {
    const liq = computeLiquidation(ENTRY, ENTRY);
    expect(liq.pscDeadline.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    expect(liq.estimatedLiquidationAt.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    expect(liq.daysUntilPscDeadline).toBe(300);
  });

  it('keeps the PSC window open through day 300', () => {
    const day270 = computeLiquidation(ENTRY, daysAfterEntry(270));
    expect(day270.status).toBe('psc-window-open');
    expect(day270.daysUntilPscDeadline).toBe(30);

    const day300 = computeLiquidation(ENTRY, daysAfterEntry(300));
    expect(day300.status).toBe('psc-window-open');
    expect(day300.daysUntilPscDeadline).toBe(0);
  });

  it('closes the PSC window on day 301', () => {
    const liq = computeLiquidation(ENTRY, daysAfterEntry(301));
    expect(liq.status).toBe('awaiting-liquidation');
    expect(liq.daysUntilPscDeadline).toBe(-1);
  });

  it('reports pending before entry and liquidated after day 314', () => {
    expect(computeLiquidation(ENTRY, daysAfterEntry(-1)).status).toBe('pending');
    expect(computeLiquidation(ENTRY, daysAfterEntry(314)).status).toBe('awaiting-liquidation');
    expect(computeLiquidation(ENTRY, daysAfterEntry(315)).status).toBe('liquidated');
  });
});
