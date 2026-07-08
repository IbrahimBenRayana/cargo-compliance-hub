/**
 * MFA secret encryption. These blobs guard the TOTP shared secret — a decrypt
 * that silently returned garbage (or accepted a tampered blob) would be a
 * second-factor bypass, so we assert round-trip fidelity AND that tamper /
 * malformed input is rejected loudly.
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../mfaCrypto.js';

describe('mfaCrypto', () => {
  it('round-trips a secret back to the original plaintext', () => {
    const secret = 'JBSWY3DPEHPK3PXP7NGINMIBKU5DUPEF';
    const stored = encryptSecret(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it('emits the versioned v1:<iv>:<ct>:<tag> envelope', () => {
    const stored = encryptSecret('anything');
    const parts = stored.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('produces a fresh IV per encryption (no deterministic ciphertext)', () => {
    const a = encryptSecret('same-input');
    const b = encryptSecret('same-input');
    expect(a).not.toBe(b);
    // …but both still decrypt to the same plaintext.
    expect(decryptSecret(a)).toBe('same-input');
    expect(decryptSecret(b)).toBe('same-input');
  });

  it('rejects a tampered ciphertext (GCM auth tag fails)', () => {
    const stored = encryptSecret('secret-value');
    const [v, iv, ct, tag] = stored.split(':');
    // Flip the ciphertext to a different (still valid-b64) value.
    const badCt = Buffer.from(`${ct}xx`, 'base64').toString('base64');
    expect(() => decryptSecret([v, iv, badCt, tag].join(':'))).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const stored = encryptSecret('secret-value');
    const [v, iv, ct] = stored.split(':');
    const forgedTag = Buffer.alloc(16, 7).toString('base64');
    expect(() => decryptSecret([v, iv, ct, forgedTag].join(':'))).toThrow();
  });

  it('rejects a malformed / wrong-version envelope', () => {
    expect(() => decryptSecret('not-a-valid-blob')).toThrow();
    expect(() => decryptSecret('v2:a:b:c')).toThrow();
  });
});
