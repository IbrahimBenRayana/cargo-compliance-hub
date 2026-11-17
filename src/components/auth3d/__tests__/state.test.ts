import { describe, expect, it } from 'vitest';
import { emailDomain, passwordStrength } from '../state';

describe('emailDomain', () => {
  it('returns the lower-cased part after the last @', () => {
    expect(emailDomain('Ops@SeaGold.com')).toBe('seagold.com');
    expect(emailDomain('a@b@c.io')).toBe('c.io');
  });
  it('is empty until an @ is typed', () => {
    expect(emailDomain('')).toBe('');
    expect(emailDomain('ops')).toBe('');
    expect(emailDomain('ops@')).toBe('');
  });
});

describe('passwordStrength', () => {
  it('is 0 for an empty password', () => {
    expect(passwordStrength('')).toBe(0);
  });
  it('grows with length and character variety, capped at 1', () => {
    const weak = passwordStrength('abcdefgh');
    const mixed = passwordStrength('abcdEFGH');
    const strong = passwordStrength('abcdEFGH12!?long');
    expect(weak).toBeGreaterThan(0);
    expect(mixed).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(mixed);
    expect(strong).toBeLessThanOrEqual(1);
    expect(passwordStrength('Aa1!'.repeat(10))).toBe(1);
  });
});
