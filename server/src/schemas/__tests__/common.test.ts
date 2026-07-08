/**
 * emailField is the single normalizer behind every account-email input
 * (login, registration, provisioning, invites). These assert the case-fold +
 * trim that fixes the "mixed-case email can't log in" bug: an address stored
 * lowercase must be reachable no matter how the user types it.
 */
import { describe, it, expect } from 'vitest';
import { emailField } from '../common.js';

describe('emailField (account email normalization)', () => {
  it('lowercases so a mixed-case login resolves to the stored row', () => {
    expect(emailField.parse('Moiz.Kashif@sigmatechllc.com')).toBe('moiz.kashif@sigmatechllc.com');
    expect(emailField.parse('FOO@BAR.COM')).toBe('foo@bar.com');
  });

  it('trims surrounding whitespace (autofill / copy-paste)', () => {
    expect(emailField.parse('  Foo.Bar@X.com \t')).toBe('foo.bar@x.com');
  });

  it('still rejects malformed addresses after normalizing', () => {
    expect(() => emailField.parse('not-an-email')).toThrow();
    expect(() => emailField.parse('missing@tld')).toThrow();
  });

  it('is idempotent — an already-normalized email passes through unchanged', () => {
    expect(emailField.parse('demo@mycargolens.com')).toBe('demo@mycargolens.com');
  });
});
