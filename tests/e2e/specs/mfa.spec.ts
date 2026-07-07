import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OTPAuth from 'otpauth';
import { DEMO, login } from './helpers';

/**
 * MFA: settings enrollment → TOTP challenge login → disable.
 *
 * Uses the demo user, so state hygiene is critical: the suite's other specs
 * assume demo logs in with password only. Both beforeAll AND afterAll reset
 * the demo user's MFA state directly in the dev DB (same idempotent SQL the
 * server migration created), so a mid-run crash can't strand the suite.
 *
 * Serial: later tests consume the TOTP secret captured during enrollment.
 * Codes are time-step scoped (RFC 6238) and the server enforces one-use-per-
 * step (replay guard), so `freshCode()` waits for a new 30s window when the
 * current one was already spent.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function dbUrl(): string {
  const env = readFileSync(path.join(REPO, 'server/.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in server/.env');
  return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '').split('?')[0];
}

function resetDemoMfa(): void {
  const sql = `
    UPDATE users SET mfa_enabled=false, mfa_secret_enc=NULL, mfa_pending_secret_enc=NULL,
      mfa_pending_created_at=NULL, mfa_last_used_step=NULL, mfa_enrolled_at=NULL,
      mfa_enforced=false, mfa_failed_attempts=0, locked_until=NULL
    WHERE email='${DEMO.email}';
    DELETE FROM mfa_recovery_codes WHERE user_id=(SELECT id FROM users WHERE email='${DEMO.email}');
    DELETE FROM mfa_email_codes WHERE user_id=(SELECT id FROM users WHERE email='${DEMO.email}');
  `;
  execFileSync('psql', [dbUrl(), '-c', sql], { stdio: 'pipe' });
}

const usedSteps = new Set<number>();

/** A valid TOTP for a time-step not yet consumed in this run. */
async function freshCode(secretB32: string): Promise<string> {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secretB32), digits: 6, period: 30, algorithm: 'SHA1' });
  let step = Math.floor(Date.now() / 30000);
  if (usedSteps.has(step)) {
    const waitMs = (step + 1) * 30000 - Date.now() + 700;
    await new Promise((r) => setTimeout(r, waitMs));
    step = Math.floor(Date.now() / 30000);
  }
  usedSteps.add(step);
  return totp.generate();
}

async function typeOtp(page: Page, code: string): Promise<void> {
  const input = page.locator("input[autocomplete='one-time-code'], input[data-input-otp]").last();
  await input.click();
  await input.fill('');
  await input.pressSequentially(code, { delay: 40 });
}

test.describe.serial('MFA (TOTP)', () => {
  let secret = '';

  test.beforeAll(() => resetDemoMfa());
  test.afterAll(() => resetDemoMfa());

  test('enrolls an authenticator from settings and shows recovery codes', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto('/settings?tab=profile');
    await page.getByRole('button', { name: /set up authenticator/i }).click();

    // Step 1: re-auth with password
    await page.getByPlaceholder('Enter your password').last().fill(DEMO.password);
    await page.getByRole('button', { name: /continue/i }).last().click();

    // Step 2: capture the Base32 secret shown next to the QR, confirm a live code
    await expect(page.locator('text=/[A-Z2-7]{4}( [A-Z2-7]{4}){7}/')).toBeVisible({ timeout: 10_000 });
    const body = await page.evaluate(() => document.body.innerText);
    const m = body.match(/([A-Z2-7]{4}(?: [A-Z2-7]{4}){7})/);
    expect(m, 'Base32 secret rendered for manual entry').toBeTruthy();
    secret = m![1].replace(/ /g, '');
    await typeOtp(page, await freshCode(secret));

    // Step 3: 10 single-use recovery codes, shown exactly once
    await expect(page.locator('text=/recovery/i').first()).toBeVisible({ timeout: 10_000 });
    const codesText = await page.evaluate(() => document.body.innerText);
    const codes = codesText.match(/\b[A-Z2-9]{5}-[A-Z2-9]{5}\b/g) ?? [];
    expect(codes).toHaveLength(10);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /done|finish|continue/i }).first().click();

    await expect(page.locator('text=/enabled/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('login demands the second factor; wrong code rejected, valid code completes', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/login');
    await page.fill('#email', DEMO.email);
    await page.fill('#password', DEMO.password);
    await page.click('button[type=submit]');

    // Challenge shown, still unauthenticated
    await expect(page.locator("input[autocomplete='one-time-code'], input[data-input-otp]").last()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);

    // Wrong code → inline rejection with attempts remaining, no session
    await typeOtp(page, '000000');
    await expect(page.locator('text=/invalid code|attempts/i').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Valid code → real session
    await typeOtp(page, await freshCode(secret));
    await page.waitForURL(/localhost:8080\/(?!login)/, { timeout: 15_000 });
    await expect(page.getByText(/shipments in flight/i)).toBeVisible({ timeout: 15_000 });
  });

  test('disable requires password + code and restores password-only login', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/login');
    await page.fill('#email', DEMO.email);
    await page.fill('#password', DEMO.password);
    await page.click('button[type=submit]');
    await expect(page.locator("input[autocomplete='one-time-code'], input[data-input-otp]").last()).toBeVisible({ timeout: 15_000 });
    await typeOtp(page, await freshCode(secret));
    await page.waitForURL(/localhost:8080\/(?!login)/, { timeout: 15_000 });

    await page.goto('/settings?tab=profile');
    await page.getByRole('button', { name: /disable/i }).first().click();
    await page.getByPlaceholder('Enter your password').last().fill(DEMO.password);
    await page.getByPlaceholder(/123456/).last().fill(await freshCode(secret));
    await page.getByRole('button', { name: /disable/i }).last().click();

    await expect(page.getByRole('button', { name: /set up authenticator/i })).toBeVisible({ timeout: 10_000 });
  });
});
