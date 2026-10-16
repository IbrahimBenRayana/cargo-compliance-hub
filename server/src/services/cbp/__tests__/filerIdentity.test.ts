/**
 * Filer identity (native go-live Phase 2; audit BNA-01, FNA-04): the org's
 * CBP config is the only source of who files. Clients can never file
 * entries under Sigma's S7P or another org's code, and nothing transmits
 * under a client code until their CBP client rep has approved our queue.
 */
import { describe, it, expect } from 'vitest';
import { resolveIsfFiler, checkEntryFiler, SIGMA_FILER_CODE } from '../filerIdentity.js';
import { computeEntryCheckDigit } from '../../../abi-engine/ae/checkDigit.js';

const approved = { filerCode: 'ABC', isfFilerModeDefault: 'CLIENT', serviceCenterApprovedAt: new Date('2026-10-01') };
const entry = (filer: string, seq: string) => `${filer}-${seq}-${computeEntryCheckDigit(filer, seq)}`;

describe('resolveIsfFiler', () => {
  it('files under S7P when Sigma is the ISF filer, with no client approval needed', () => {
    expect(resolveIsfFiler(null, 'SIGMA')).toEqual({ ok: true, filerCode: SIGMA_FILER_CODE, mode: 'SIGMA' });
  });

  it('defaults to Sigma for an org with no CBP setup', () => {
    expect(resolveIsfFiler(null, null)).toMatchObject({ ok: true, filerCode: 'S7P', mode: 'SIGMA' });
  });

  it('files under the client code when the rep approved our queue', () => {
    expect(resolveIsfFiler(approved, null)).toEqual({ ok: true, filerCode: 'ABC', mode: 'CLIENT' });
  });

  it('a per-filing choice overrides the org default', () => {
    expect(resolveIsfFiler(approved, 'SIGMA')).toMatchObject({ filerCode: 'S7P' });
  });

  it('refuses CLIENT mode without a filer code or without approval', () => {
    expect(resolveIsfFiler({ ...approved, filerCode: null }, 'CLIENT')).toMatchObject({ ok: false, code: 'CBP_SETUP_INCOMPLETE' });
    expect(resolveIsfFiler({ ...approved, serviceCenterApprovedAt: null }, 'CLIENT')).toMatchObject({ ok: false, code: 'SERVICE_CENTER_NOT_APPROVED' });
  });
});

describe('checkEntryFiler', () => {
  it('accepts an entry number under the org code with a valid check digit', () => {
    expect(checkEntryFiler(approved, entry('ABC', '1234567'))).toEqual({ ok: true, filerCode: 'ABC' });
    expect(checkEntryFiler(approved, entry('ABC', '1234567').replace(/-/g, ''))).toMatchObject({ ok: true });
  });

  it('refuses another filer code, including S7P', () => {
    expect(checkEntryFiler(approved, entry('S7P', '1234567'))).toMatchObject({ ok: false, code: 'ENTRY_FILER_MISMATCH' });
    expect(checkEntryFiler(approved, entry('XYZ', '1234567'))).toMatchObject({ ok: false, code: 'ENTRY_FILER_MISMATCH' });
  });

  it('refuses a bad check digit', () => {
    const good = entry('ABC', '1234567');
    const bad = good.slice(0, -1) + String((Number(good.slice(-1)) + 1) % 10);
    expect(checkEntryFiler(approved, bad)).toMatchObject({ ok: false, code: 'ENTRY_CHECK_DIGIT' });
  });

  it('refuses entries without a filer code or approval', () => {
    expect(checkEntryFiler(null, entry('ABC', '1234567'))).toMatchObject({ ok: false, code: 'CBP_SETUP_INCOMPLETE' });
    expect(checkEntryFiler({ ...approved, serviceCenterApprovedAt: null }, entry('ABC', '1234567'))).toMatchObject({ ok: false, code: 'SERVICE_CENTER_NOT_APPROVED' });
  });
});
