/**
 * Step 6 guard rails: confidence labels the user can act on, and a plain
 * warning when the suggested codes carry different duty.
 */
import { describe, it, expect } from 'vitest';
import { confidenceLabel, dutySpreadWarning, parseAdValorem } from '../guards.js';

const strong = { fits: true, confidence: 0.9, issue: null };

describe('confidenceLabel (top pick)', () => {
  it('is high only when sure, verified, complete and clearly ahead', () => {
    expect(confidenceLabel({ confidence: 0.92, rank: 0, nextConfidence: 0.3, verification: strong, sufficiency: 'enough' })).toBe('high');
  });

  it('is not high without a successful second check', () => {
    expect(confidenceLabel({ confidence: 0.95, rank: 0, nextConfidence: 0.1, verification: null, sufficiency: 'enough' })).toBe('medium');
  });

  it('is low when the second check disagrees, however sure the first pass was', () => {
    expect(confidenceLabel({ confidence: 0.97, rank: 0, nextConfidence: 0.1, verification: { fits: false, confidence: 0.8, issue: 'x' }, sufficiency: 'enough' })).toBe('low');
  });

  it('is not high when facts were missing', () => {
    expect(confidenceLabel({ confidence: 0.92, rank: 0, nextConfidence: 0.2, verification: strong, sufficiency: 'heading_only' })).toBe('medium');
  });

  it('is not high when the runner-up is close', () => {
    expect(confidenceLabel({ confidence: 0.9, rank: 0, nextConfidence: 0.8, verification: strong, sufficiency: 'enough' })).toBe('medium');
  });

  it('is low under 0.55', () => {
    expect(confidenceLabel({ confidence: 0.5, rank: 0, nextConfidence: 0, verification: strong, sufficiency: 'enough' })).toBe('low');
  });
});

describe('confidenceLabel (alternatives)', () => {
  it('is never high', () => {
    expect(confidenceLabel({ confidence: 0.95, rank: 1, nextConfidence: 0, verification: null, sufficiency: 'enough' })).toBe('medium');
    expect(confidenceLabel({ confidence: 0.3, rank: 2, nextConfidence: 0, verification: null, sufficiency: 'enough' })).toBe('low');
  });
});

describe('parseAdValorem', () => {
  it('reads Free and simple percentages; other forms are not comparable', () => {
    expect(parseAdValorem('Free')).toBe(0);
    expect(parseAdValorem('3.4%')).toBe(3.4);
    expect(parseAdValorem('2.4¢/kg + 5%')).toBeNull();
    expect(parseAdValorem('')).toBeNull();
  });
});

describe('dutySpreadWarning', () => {
  it('warns when ad valorem rates differ by 3 points or more', () => {
    expect(dutySpreadWarning(['Free', '3.4%', '25%'])).toMatch(/Free to 25%/);
  });

  it('stays quiet when rates are close', () => {
    expect(dutySpreadWarning(['3.4%', '3.5%', '2.7%'])).toBeUndefined();
  });

  it('warns when some rates are not simple percentages', () => {
    expect(dutySpreadWarning(['3.4%', '2.4¢/kg + 5%'])).toMatch(/calculated differently/);
  });

  it('is quiet for a single suggestion', () => {
    expect(dutySpreadWarning(['25%'])).toBeUndefined();
  });
});
