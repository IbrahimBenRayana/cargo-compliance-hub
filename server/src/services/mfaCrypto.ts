/**
 * MFA secret encryption — AES-256-GCM at rest.
 *
 * TOTP secrets are long-lived shared secrets: a DB dump that leaks them is a
 * full second-factor bypass. We encrypt them application-side with an
 * authenticated cipher (GCM) so the stored blob is both confidential and
 * tamper-evident (a flipped byte fails the auth tag on decrypt).
 *
 * Key resolution:
 *   • env.MFA_ENC_KEY (64 hex chars → 32 bytes) — the real key, required in prod.
 *   • dev/test fallback: sha256(JWT_ACCESS_SECRET + ':mfa-enc'). Deterministic
 *     so secrets survive a restart locally, but NEVER used in production
 *     (env.ts hard-requires MFA_ENC_KEY there).
 *
 * Stored format: `v1:<iv b64>:<ciphertext b64>:<authTag b64>`.
 * Inputs and outputs are NEVER logged.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

/** Resolve (and memoize) the 32-byte encryption key. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  if (env.MFA_ENC_KEY) {
    cachedKey = Buffer.from(env.MFA_ENC_KEY, 'hex');
    return cachedKey;
  }

  if (env.NODE_ENV === 'production') {
    // Should be unreachable — env.ts fails boot in prod without MFA_ENC_KEY —
    // but fail closed rather than silently derive a weaker key.
    throw new Error('MFA_ENC_KEY is required in production');
  }

  // Dev/test fallback: derive a stable 32-byte key from the JWT secret.
  cachedKey = createHash('sha256')
    .update(`${env.JWT_ACCESS_SECRET}:mfa-enc`)
    .digest();
  return cachedKey;
}

/** Encrypt a plaintext TOTP secret. Returns `v1:<iv>:<ct>:<tag>` (base64 parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    ciphertext.toString('base64'),
    authTag.toString('base64'),
  ].join(':');
}

/** Decrypt a `v1:...` blob back to plaintext. Throws on tamper or bad format. */
export function decryptSecret(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted MFA secret');
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  // .final() throws if the auth tag doesn't verify — i.e. the blob was tampered
  // with or encrypted under a different key.
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/** Test-only hook to reset the memoized key (e.g. after mutating env in a test). */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}
