/**
 * Tests for assessUflpaRisk (audit Phase 10b).
 *
 * UFLPA flagging is regulatory-stakes — false negatives let CBP seize
 * goods at port, false positives waste an importer's docs prep budget.
 * The function is pure and side-effect free (input → severity record),
 * which makes it ideal for a tight test net.
 */

import { describe, it, expect } from 'vitest';
import { assessUflpaRisk } from '../uflpa.js';

describe('assessUflpaRisk', () => {
  it('returns "low" for a vanilla US-origin filing', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'US', city: 'Seattle' },
      commodities: [{ htsCode: '8471.30.01', countryOfOrigin: 'US' }],
    });
    expect(result.severity).toBe('low');
    expect(result.htsMatches).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it('returns "high" when a Xinjiang party AND a UFLPA-priority HTS line up', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Urumqi' },
      commodities: [
        { htsCode: '5208.42.00', countryOfOrigin: 'CN' }, // chapter 52 cotton
      ],
    });
    expect(result.severity).toBe('high');
    expect(result.htsMatches).toContain('5208.42.00');
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('returns "elevated" when only the party matches Xinjiang (no priority HTS)', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Kashgar' },
      commodities: [{ htsCode: '8471.30.01', countryOfOrigin: 'CN' }],
    });
    expect(result.severity).toBe('elevated');
    expect(result.reasons[0]).toContain('Xinjiang');
  });

  it('returns "elevated" when only the HTS matches (no party signal)', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Shenzhen' },
      commodities: [
        { htsCode: '3818.00.00', countryOfOrigin: 'CN' }, // polysilicon heading
      ],
    });
    expect(result.severity).toBe('elevated');
    expect(result.htsMatches).toContain('3818.00.00');
  });

  it('uses heading-level match for polysilicon (3818) even if chapter 38 is not in the list', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Shenzhen' },
      commodities: [{ htsCode: '3818.00.00', countryOfOrigin: 'CN' }],
    });
    // chapter 38 not in HIGH_RISK_CHAPTERS — match comes from HIGH_RISK_HEADINGS
    expect(result.htsMatches).toContain('3818.00.00');
  });

  it('promotes "low" to "elevated" when a China-origin party ships China-origin goods on a non-priority HTS', () => {
    // The defensive "manufacturer is in China + China-origin commodities"
    // nudge picks up suppliers we'd otherwise miss.
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Shanghai' },
      commodities: [{ htsCode: '8471.30.01', countryOfOrigin: 'CN' }],
    });
    expect(result.severity).toBe('elevated');
    expect(result.reasons.some((r) => r.toLowerCase().includes('verify supply chain'))).toBe(true);
  });

  it('Xinjiang tokens match case-insensitively in addresses', () => {
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'URUMQI', address1: '123 Some Road' },
      commodities: [{ htsCode: '6204.62.40', countryOfOrigin: 'CN' }], // chapter 62 apparel
    });
    expect(result.severity).toBe('high');
  });

  it("doesn't false-positive on non-China commodity even with Xinjiang party signal", () => {
    // Xinjiang party but commodity is US-origin — HTS scan filters to
    // China-origin only, so no HTS match.
    const result = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Urumqi' },
      commodities: [{ htsCode: '5208.42.00', countryOfOrigin: 'US' }],
    });
    // Party signal alone → elevated, not high.
    expect(result.severity).toBe('elevated');
    expect(result.htsMatches).toEqual([]);
  });

  it('returns "low" with no reasons when nothing matches and no parties given', () => {
    const result = assessUflpaRisk({ commodities: [] });
    expect(result.severity).toBe('low');
    expect(result.reasons).toEqual([]);
    expect(result.htsMatches).toEqual([]);
  });

  it('recommendation text adapts to severity', () => {
    const high = assessUflpaRisk({
      manufacturer: { country: 'CN', city: 'Urumqi' },
      commodities: [{ htsCode: '5208.42.00', countryOfOrigin: 'CN' }],
    });
    const low = assessUflpaRisk({
      manufacturer: { country: 'US', city: 'Seattle' },
      commodities: [{ htsCode: '8471.30.01', countryOfOrigin: 'US' }],
    });
    expect(high.recommendation).toContain('detention order');
    expect(low.recommendation).toContain('No specific UFLPA exposure');
  });
});
