/**
 * Step 6 guard rails: confidence labels the user can act on, and a plain
 * warning when the suggested codes carry different duty.
 */
import { describe, it, expect } from 'vitest';
import { agreementOf, confidenceLabel, dutySpreadWarning, parseAdValorem } from '../guards.js';

const base = { confidence: 0.92, rank: 0, nextConfidence: 0.3, agreement: 'exact' as const, sufficiency: 'enough' as const, headingConfidence: 0.9 };

describe('agreementOf', () => {
  it('says how far two independent picks agree', () => {
    expect(agreementOf('8507600010', '8507600010')).toBe('exact');
    expect(agreementOf('8507600010', '8507600090')).toBe('subheading');
    expect(agreementOf('8507600010', '8507208031')).toBe('heading');
    expect(agreementOf('8507600010', '8711600010')).toBe('none');
    expect(agreementOf('8507600010', null)).toBeNull();
  });
});

describe('confidenceLabel (top pick)', () => {
  it('is high only when both independent picks match and every signal is strong', () => {
    expect(confidenceLabel(base)).toBe('high');
  });

  it('is at most medium when the second opinion could not run', () => {
    expect(confidenceLabel({ ...base, agreement: null })).toBe('medium');
  });

  it('is medium when the picks agree only down to the subheading', () => {
    expect(confidenceLabel({ ...base, agreement: 'subheading' })).toBe('medium');
  });

  it('is low when the picks differ at the subheading or heading', () => {
    expect(confidenceLabel({ ...base, agreement: 'heading' })).toBe('low');
    expect(confidenceLabel({ ...base, agreement: 'none' })).toBe('low');
  });

  it('is not high when facts were missing, the heading was uncertain or the runner-up is close', () => {
    expect(confidenceLabel({ ...base, sufficiency: 'heading_only' })).toBe('medium');
    expect(confidenceLabel({ ...base, headingConfidence: 0.6 })).toBe('medium');
    expect(confidenceLabel({ ...base, nextConfidence: 0.8 })).toBe('medium');
  });

  it('is low under 0.55', () => {
    expect(confidenceLabel({ ...base, confidence: 0.5 })).toBe('low');
  });
});

describe('confidenceLabel (alternatives)', () => {
  it('is never high', () => {
    expect(confidenceLabel({ ...base, rank: 1, confidence: 0.95 })).toBe('medium');
    expect(confidenceLabel({ ...base, rank: 2, confidence: 0.3 })).toBe('low');
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
