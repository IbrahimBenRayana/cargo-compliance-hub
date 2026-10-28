/**
 * Where the suite runs and as whom. Defaults to the local dev stack with
 * the seeded demo account; the testing week points it at staging:
 *
 *   E2E_BASE_URL=https://staging.mycargolens.com \
 *   E2E_EMAIL=... E2E_PASSWORD=... E2E_TOTP_SECRET=<base32> \
 *   npx playwright test --config tests/e2e/playwright.e2e.config.ts
 *
 * E2E_TOTP_SECRET answers the MFA challenge for accounts that have it on
 * (every new account on staging must enrol). Secrets come from the
 * environment only; nothing is committed.
 */
import * as OTPAuth from 'otpauth';

export const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export const ACCOUNT = {
  email: process.env.E2E_EMAIL || 'demo@mycargolens.com',
  password: process.env.E2E_PASSWORD || 'password123',
  totpSecret: process.env.E2E_TOTP_SECRET || '',
};

/** True when the suite targets a deployed environment rather than local dev. */
export const REMOTE = !/localhost|127\.0\.0\.1/.test(BASE_URL);

/** A current authenticator code for `secret`, waiting out a code that is
 *  about to expire so the server never sees a stale one. */
export async function totpCode(secret: string): Promise<string> {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' });
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (left < 4) await new Promise((r) => setTimeout(r, (left + 1) * 1000));
  return totp.generate();
}
