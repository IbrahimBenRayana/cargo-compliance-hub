/**
 * Sessions across tabs and users (testing week AUTH-07).
 *
 * Needs a second account in another org (E2E_EMAIL_2 / E2E_PASSWORD_2 /
 * E2E_TOTP_SECRET_2), so it is skipped unless those are set.
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoAuthed } from './helpers';
import { ACCOUNT, totpCode } from './env';

const SECOND = {
  email: process.env.E2E_EMAIL_2 || '',
  password: process.env.E2E_PASSWORD_2 || '',
  totpSecret: process.env.E2E_TOTP_SECRET_2 || '',
};

test.skip(!SECOND.email, 'set E2E_EMAIL_2 / E2E_PASSWORD_2 / E2E_TOTP_SECRET_2 (an account in another org)');

async function planName(page: Page) {
  await gotoAuthed(page, '/settings?tab=billing');
  const name = page.getByText(/per shipment filed|Custom pricing/).locator('xpath=preceding-sibling::div[1]');
  await expect(name).toBeVisible({ timeout: 15_000 });
  return (await name.textContent())?.trim();
}

async function signOut(page: Page) {
  // The user menu button shows the signed-in user's name (all QA bots are "QA Bot …").
  await page.getByRole('button', { name: /QA Bot/ }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Sign in on the /login screen already showing, without loading the page again. */
async function signInHere(page: Page, creds: typeof SECOND) {
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await page.click('button[type=submit]');
  const otp = page.locator("input[autocomplete='one-time-code'], input[data-input-otp]").last();
  await otp.waitFor({ state: 'visible', timeout: 15_000 });
  await otp.pressSequentially(await totpCode(creds.totpSecret), { delay: 40 });
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

test('a second tab shares the session, and the first tab stays signed in', async ({ context }) => {
  const first = await context.newPage();
  await login(first, ACCOUNT);
  const second = await context.newPage();
  await second.goto('/shipments', { waitUntil: 'domcontentloaded' });
  await expect(second).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(second.getByRole('button', { name: /QA Bot/ })).toBeVisible({ timeout: 15_000 });
  // Both tabs refreshed the session; the first must still be signed in.
  await first.reload({ waitUntil: 'domcontentloaded' });
  await expect(first.getByRole('button', { name: /QA Bot/ })).toBeVisible({ timeout: 15_000 });
  await expect(first).not.toHaveURL(/\/login/);
});

test("signing out clears the first user's data before the next user signs in", async ({ page }) => {
  await login(page, ACCOUNT);
  const firstPlan = await planName(page);

  await signOut(page);
  await signInHere(page, SECOND);
  const secondPlan = await planName(page);

  expect(secondPlan, `the second user still sees the first user's plan (${firstPlan})`).not.toBe(firstPlan);
});
