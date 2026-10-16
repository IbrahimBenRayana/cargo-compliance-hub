/**
 * One catalog for CBP conditions (audit BNA-08, FNA-10): CBP's own narrative
 * and explanation from the official tables, never invented text.
 */
import { describe, it, expect } from 'vitest';
import { describeCondition, SEVERITY_LABELS } from '../conditions.js';

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
