/**
 * Tests for canonicaliseEntryNumber (audit Phase 10b).
 *
 * CC's `/api/abi/send` endpoint only finds entries by the canonical
 * hyphenated form `XXX-NNNNNNN-N`. We canonicalise on both create AND
 * send so the value CC stores matches what we look up by — these tests
 * anchor that behaviour to the CC contract (memory: "CC entry number
 * canonical form", Apr 24 2026).
 */

import { describe, it, expect } from 'vitest';
import { canonicaliseEntryNumber } from '../abiDocumentMapper.js';

describe('canonicaliseEntryNumber', () => {
  it('inserts hyphens into a hyphen-less 11-char entry number', () => {
    expect(canonicaliseEntryNumber('ABC12345678')).toBe('ABC-1234567-8');
  });

  it('uppercases lowercase letter codes', () => {
    expect(canonicaliseEntryNumber('abc12345678')).toBe('ABC-1234567-8');
  });

  it('passes through an already-hyphenated canonical form', () => {
    expect(canonicaliseEntryNumber('ABC-1234567-8')).toBe('ABC-1234567-8');
  });

  it('strips mixed-position hyphens before re-canonicalising', () => {
    expect(canonicaliseEntryNumber('A-B-C-1234567-8')).toBe('ABC-1234567-8');
  });

  it('handles uppercase + hyphens regardless of case in the filer prefix', () => {
    expect(canonicaliseEntryNumber('abc-1234567-8')).toBe('ABC-1234567-8');
  });

  it('falls back to the stripped uppercase value on non-standard input', () => {
    // Too short — defensive path. Should not throw; Zod-level validation
    // catches the real bad cases higher up.
    expect(canonicaliseEntryNumber('SHORT')).toBe('SHORT');
  });

  it('falls back when the input has the wrong character class', () => {
    // 11-char but with a symbol — falls back to stripped uppercase.
    expect(canonicaliseEntryNumber('abc12345!@#')).toBe('ABC12345!@#');
  });

  it('idempotent — canonicalising twice produces the same string', () => {
    const once = canonicaliseEntryNumber('ABC12345678');
    const twice = canonicaliseEntryNumber(once);
    expect(twice).toBe(once);
  });
});
