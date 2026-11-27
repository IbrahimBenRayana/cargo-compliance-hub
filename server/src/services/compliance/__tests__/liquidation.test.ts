/**
 * Tests for computeLiquidation — PSC / liquidation windows.
 *
 * The PSC window follows CBP's FR Doc. 2026-13574 (Jul 6 2026) and CBP's PSC
 * page: a PSC must be transmitted within 300 days of the date of entry or up
 * to 15 days prior to the scheduled liquidation date, whichever is earlier.
 */

import { describe, it, expect } from 'vitest';
import {
  computeLiquidation, pscDeadlineFor,
  PSC_WINDOW_DAYS, PSC_LIQUIDATION_CAP_DAYS, LIQUIDATION_WINDOW_DAYS,
} from '../liquidation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY = new Date('2026-01-01T00:00:00Z');
const daysAfterEntry = (n: number) => new Date(ENTRY.getTime() + n * DAY_MS);

describe('computeLiquidation', () => {
  it('uses a 300-day PSC window, a 15-day pre-liquidation cap and a 314-day liquidation window', () => {
    expect(PSC_WINDOW_DAYS).toBe(300);
    expect(PSC_LIQUIDATION_CAP_DAYS).toBe(15);
    expect(LIQUIDATION_WINDOW_DAYS).toBe(314);
  });

  it('caps the PSC deadline at 15 days before the 314-day liquidation (Feb 24 2026 entry)', () => {
    // Entry Tue Feb 24 2026 liquidates Mon Jan 4 2027 on the usual cycle.
    // Day 300 is Mon Dec 21 2026, but liquidation minus 15 is Sun Dec 20 2026,
    // which is earlier, so Dec 20 is the deadline.
    const entry = new Date('2026-02-24T00:00:00Z');
    const liq = computeLiquidation(entry, entry);
    expect(liq.estimatedLiquidationAt.toISOString()).toBe('2027-01-04T00:00:00.000Z');
    expect(liq.pscDeadline.toISOString()).toBe('2026-12-20T00:00:00.000Z');
    expect(liq.daysUntilPscDeadline).toBe(299);
  });

  it('keeps the PSC window open through the capped deadline (day 299)', () => {
    const day270 = computeLiquidation(ENTRY, daysAfterEntry(270));
    expect(day270.status).toBe('psc-window-open');
    expect(day270.daysUntilPscDeadline).toBe(29);

    const day299 = computeLiquidation(ENTRY, daysAfterEntry(299));
    expect(day299.status).toBe('psc-window-open');
    expect(day299.daysUntilPscDeadline).toBe(0);
  });

  it('closes the PSC window on day 300 for an entry on the usual cycle', () => {
    const liq = computeLiquidation(ENTRY, daysAfterEntry(300));
    expect(liq.status).toBe('awaiting-liquidation');
    expect(liq.daysUntilPscDeadline).toBe(-1);
  });

  it('reports pending before entry and liquidated after day 314', () => {
    expect(computeLiquidation(ENTRY, daysAfterEntry(-1)).status).toBe('pending');
    expect(computeLiquidation(ENTRY, daysAfterEntry(314)).status).toBe('awaiting-liquidation');
    expect(computeLiquidation(ENTRY, daysAfterEntry(315)).status).toBe('liquidated');
  });
});

describe('pscDeadlineFor', () => {
  it('uses day 300 when it is earlier than 15 days before an extended liquidation', () => {
    // Liquidation extended a year (19 CFR 159.12): scheduled day 679, so
    // liquidation minus 15 (day 664) is later than day 300.
    const extended = daysAfterEntry(LIQUIDATION_WINDOW_DAYS + 365);
    expect(pscDeadlineFor(ENTRY, extended).toISOString()).toBe(daysAfterEntry(300).toISOString());
  });

  it('uses liquidation minus 15 when that is earlier than day 300', () => {
    expect(pscDeadlineFor(ENTRY, daysAfterEntry(314)).toISOString())
      .toBe(daysAfterEntry(299).toISOString());
  });

  it('falls back to day 300 when liquidation is suspended or its date is unknown', () => {
    expect(pscDeadlineFor(ENTRY, null).toISOString()).toBe(daysAfterEntry(300).toISOString());
  });
});
