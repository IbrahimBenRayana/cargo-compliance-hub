/**
 * One catalog for CBP conditions (audit BNA-08, FNA-10): CBP's own narrative
 * and explanation from the official tables, never invented text.
 */
import { describe, it, expect } from 'vitest';
import { describeCondition, SEVERITY_LABELS, withGuidance } from '../conditions.js';

describe('describeCondition', () => {
  it('explains an entry summary condition from the CBP error dictionary', () => {
    const c = describeCondition({ source: 'entry-summary', code: '204', severity: 'F' });
    expect(c.narrative).toMatch(/Prelim Stmt Date/i);
    expect(c.explanation).toMatch(/Saturday, Sunday/);
    expect(c.blocking).toBe(true);
    expect(c.reference).toMatch(/Error Dictionary v54/);
  });

  it('accepts codes with or without leading zeros and letters', () => {
    expect(describeCondition({ source: 'entry-summary', code: 'B49' }).narrative).toMatch(/PSC NOT ALLOWED/);
    expect(describeCondition({ source: 'entry-summary', code: '0204' }).narrative).toMatch(/Prelim Stmt/i);
  });

  it('keeps CBP narrative text for a code the dictionary does not list', () => {
    const c = describeCondition({ source: 'entry-summary', code: 'Q9Q', narrative: 'SOMETHING NEW' });
    expect(c.narrative).toBe('SOMETHING NEW');
    expect(c.explanation).toBeUndefined();
  });

  it('marks batch control codes as transmission problems, not the filer\'s data', () => {
    const c = describeCondition({ source: 'batch', code: 'X17' });
    expect(c.narrative).toBe('PROCESSING FILER NOT AUTHORIZED');
    expect(c.audience).toBe('operations');
  });

  it('describes ISF message types and status advisories', () => {
    expect(describeCondition({ source: 'isf', code: '01' }).narrative).toBe('Message Rejected');
    expect(describeCondition({ source: 'isf-advisory', code: 'S2' }).narrative).toMatch(/No bill match/);
  });

  it('labels severities', () => {
    expect(SEVERITY_LABELS.W).toMatch(/Warning/);
  });
});

describe('ISF bill-match advisories (S1-S7): plain guidance', () => {
  it('tells the user S2 at filing time is normal and needs nothing', () => {
    const c = describeCondition({ source: 'isf-advisory', code: 'S2', narrative: 'NO BILL MATCH (NOT ON FILE)' });
    expect(c.guidance).toMatch(/normal/i);
    expect(c.guidance).toMatch(/nothing to do/i);
  });

  it('asks the user to act when the bill is still missing days later', () => {
    for (const code of ['S3', 'S4', 'S5']) {
      expect(describeCondition({ source: 'isf-advisory', code }).guidance).toMatch(/check the bill/i);
    }
  });

  it('explains bill-type mismatches and duplicates', () => {
    expect(describeCondition({ source: 'isf-advisory', code: 'S6' }).guidance).toMatch(/bill type/i);
    expect(describeCondition({ source: 'isf-advisory', code: 'S7' }).guidance).toMatch(/another filer/i);
  });

  it('adds no guidance to other condition types', () => {
    expect(describeCondition({ source: 'isf', code: '144', narrative: 'CONTINUOUS BOND NOT ON FILE' }).guidance).toBeUndefined();
  });
});

describe('withGuidance (messages stored before guidance existed)', () => {
  it('adds guidance to stored bill-match advisories and leaves the rest alone', () => {
    const stored = { verdict: 'ACCEPTED', conditions: [{ source: 'isf-advisory', code: 'S2', narrative: 'x' }, { source: 'isf', code: '144', narrative: 'y' }] };
    const out = withGuidance(stored as { conditions: Array<{ source: string; code: string; narrative: string; guidance?: string }> });
    expect(out.conditions[0].guidance).toMatch(/normal/i);
    expect(out.conditions[1]).toEqual(stored.conditions[1]);
  });
  it('passes through messages without conditions', () => {
    expect(withGuidance({ verdict: 'ACCEPTED' } as any)).toEqual({ verdict: 'ACCEPTED' });
  });
});
