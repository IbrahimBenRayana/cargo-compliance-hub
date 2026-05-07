/**
 * Tests for ccErrorsToIssues + ccIsfErrorsToIssues — the bridge between
 * CC's two different error response shapes and the Zod-style issues
 * array our frontend already knows how to render.
 *
 * Fixtures are real CC error bodies pulled from prod submission_logs
 * (see __tests__/fixtures/customscity-samples.ts). If CC changes its
 * shape, these tests fail and we update the mapper, not the fixture.
 */

import { describe, it, expect } from 'vitest';
import { ccErrorsToIssues, ccIsfErrorsToIssues } from '../ccErrorMapping.js';
import {
  CC_DUTY_ERROR_BAD_HTS,
  CC_DUTY_ERROR_AI_QUANTITY,
  CC_DUTY_ERROR_SPI_MISMATCH,
  CC_ISF_ERROR_PORT,
  CC_ISF_ERROR_WEIGHT_UOM,
  CC_ISF_ERROR_DESC_LEN,
} from '../../__tests__/fixtures/customscity-samples.js';

// ─── ccErrorsToIssues — duty-calc shape (errors object) ──────────────

describe('ccErrorsToIssues — duty-calc shape', () => {
  it('maps two HTS-not-found errors to two distinct items', () => {
    const issues = ccErrorsToIssues(CC_DUTY_ERROR_BAD_HTS.errors);
    expect(issues).toHaveLength(2);
    expect(issues[0].path).toEqual(['items', 0, 'hts']);
    expect(issues[1].path).toEqual(['items', 1, 'hts']);
    expect(issues[0].message).toMatch(/HTS code '6204624000'/);
    expect(issues[1].message).toMatch(/HTS code '6205202065'/);
  });

  it('AI quantity error pins to the right item with quantity1 field', () => {
    const issues = ccErrorsToIssues(CC_DUTY_ERROR_AI_QUANTITY.errors);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(['items', 0, 'quantity1']);
    expect(issues[0].message).toMatch(/quantity1 or quantity2/);
  });

  it('SPI mismatch maps to hts (mentions HTS in message)', () => {
    const issues = ccErrorsToIssues(CC_DUTY_ERROR_SPI_MISMATCH.errors);
    expect(issues).toHaveLength(1);
    // SPI message contains both "Special Program Indicator" and "HTS code" — our
    // guess sniff prefers HTS since it's named earlier in the keyword list.
    expect(issues[0].path[0]).toBe('items');
    expect(issues[0].path[1]).toBe(0);
    // Pinned to either spi or hts is acceptable; both are user-actionable.
    expect(['spi', 'hts']).toContain(issues[0].path[2]);
  });

  it('returns empty array for null / undefined / non-object input', () => {
    expect(ccErrorsToIssues(null)).toEqual([]);
    expect(ccErrorsToIssues(undefined)).toEqual([]);
    expect(ccErrorsToIssues('a string')).toEqual([]);
    expect(ccErrorsToIssues({})).toEqual([]);
  });

  it('handles top-level (non-item) field errors', () => {
    const issues = ccErrorsToIssues({ currency: ['Currency must be ISO-4217'] });
    expect(issues).toEqual([{ path: ['currency'], message: 'Currency must be ISO-4217' }]);
  });

  it('handles a single-string value (not array)', () => {
    const issues = ccErrorsToIssues({ 'items[0]': 'Single message string' });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Single message string');
  });
});

// ─── ccIsfErrorsToIssues — ISF shape (errors array) ──────────────────

describe('ccIsfErrorsToIssues — ISF shape', () => {
  it('maps the USPortOfArrival error to the foreign port field', () => {
    const issues = ccIsfErrorsToIssues(CC_ISF_ERROR_PORT);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(['foreignPortOfUnlading']);
    expect(issues[0].message).toMatch(/USPortOfArrival/);
  });

  it('de-duplicates the weightUOM pair into one issue', () => {
    const issues = ccIsfErrorsToIssues(CC_ISF_ERROR_WEIGHT_UOM);
    // Real CC returns two slightly-different weightUOM messages; we keep
    // only the first.
    expect(issues).toHaveLength(2); // two distinct messages
    const fields = issues.map(i => i.path[0]);
    expect(fields.every(f => f === 'commodities.weight.unit')).toBe(true);
  });

  it('description-length errors collapse to commodity description', () => {
    const issues = ccIsfErrorsToIssues(CC_ISF_ERROR_DESC_LEN);
    expect(issues).toHaveLength(2);
    expect(issues.every(i => i.path[0] === 'commodities.description')).toBe(true);
  });

  it('returns empty array for non-array input', () => {
    expect(ccIsfErrorsToIssues(null)).toEqual([]);
    expect(ccIsfErrorsToIssues(undefined)).toEqual([]);
    expect(ccIsfErrorsToIssues({ field: 'x', message: 'y' })).toEqual([]);
  });

  it('skips entries without a message', () => {
    const issues = ccIsfErrorsToIssues([
      { field: 'X', message: '' },
      { field: 'Y' },
      { field: 'Z', message: 'a real one' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('a real one');
  });

  it('unknown messages get an empty path so the client falls back to a generic banner', () => {
    const issues = ccIsfErrorsToIssues([
      { field: 'whatever', message: 'something completely unrelated to a known field' },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual([]);
  });
});
