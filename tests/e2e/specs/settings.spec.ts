/**
 * Settings (testing week SET-01 / SET-02), run as an org admin.
 * OPT-IN (changes and restores account data): RUN_SETTINGS=1.
 * The password test needs E2E_NEW_PASSWORD; the caller restores the old one.
 */
import fs from 'node:fs';
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';
import { ACCOUNT } from './env';

/** Click a save button and wait for the API to answer, reporting its status. */
async function saveAndWait(page: import('@playwright/test').Page, button: string, urlPart: string) {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(urlPart) && ['PATCH', 'PUT', 'POST'].includes(r.request().method()), { timeout: 15_000 }),
    page.getByRole('button', { name: button }).click(),
  ]);
  expect(resp.status(), `${button} -> ${resp.status()} ${await resp.text().catch(() => '')}`).toBeLessThan(300);
}

test.skip(process.env.RUN_SETTINGS !== '1', 'Changes account data: set RUN_SETTINGS=1');
test.describe.configure({ mode: 'serial' });

test('SET-01 profile: a name change saves, survives a reload, and is reverted', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=profile');
  const last = page.getByRole('textbox', { name: 'Last Name' });
  const original = await last.inputValue();
  await last.fill(`${original} Edited`);
  await saveAndWait(page, 'Save Changes', '/settings/profile');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Last Name' })).toHaveValue(`${original} Edited`, { timeout: 15_000 });
  await page.getByRole('textbox', { name: 'Last Name' }).fill(original);
  await saveAndWait(page, 'Save Changes', '/settings/profile');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Last Name' })).toHaveValue(original, { timeout: 15_000 });
});

test('SET-01 notification preferences save and survive a reload', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=notifications');
  const box = page.getByRole('checkbox', { name: 'Amended — email' });
  const was = await box.isChecked();
  await box.click();
  await saveAndWait(page, 'Save preferences', '/notification');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Amended — email' })).toBeChecked({ checked: !was, timeout: 15_000 });
  await page.getByRole('checkbox', { name: 'Amended — email' }).click();
  await saveAndWait(page, 'Save preferences', '/notification');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Amended — email' })).toBeChecked({ checked: was, timeout: 15_000 });
});

test('SET-01 audit log lists recent actions', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=activity');
  await expect(page.getByText(/Audit Log/).first()).toBeVisible();
  await expect(page.locator('main')).toContainText(/updated|created|removed|saved|sign|login|invit/i, { timeout: 15_000 });
});

test('SET-02 organization details save and are reverted', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=organization');
  const name = page.getByRole('textbox', { name: 'Company Name' });
  const original = await name.inputValue();
  await name.fill(`${original} QA`);
  await saveAndWait(page, 'Save Organization', '/settings/organization');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Company Name' })).toHaveValue(`${original} QA`, { timeout: 15_000 });
  await page.getByRole('textbox', { name: 'Company Name' }).fill(original);
  await saveAndWait(page, 'Save Organization', '/settings/organization');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Company Name' })).toHaveValue(original, { timeout: 15_000 });
});

test('SET-02 CBP identity shows who files the org\'s ISFs', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=api');
  await expect(page.locator('main')).toContainText(/S7P/, { timeout: 15_000 });
});

test('SET-02 entry-number block: add one, then deactivate it', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=organization');
  await page.getByRole('button', { name: 'Add block' }).click();
  const label = `QA block ${Date.now().toString().slice(-5)}`;
  const start = 3_000_000 + Math.floor(Math.random() * 900_000);
  await page.getByPlaceholder('2026 block').fill(label);
  await page.getByPlaceholder('1000000').fill(String(start));
  await page.getByPlaceholder('1999999').fill(String(start + 99));
  await page.getByRole('button', { name: 'Save block' }).click();
  await expect(page.getByText(label)).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByRole('switch', { name: /Deactivate block/ }).last();
  await toggle.click();
  await expect(page.getByText('Inactive').first()).toBeVisible({ timeout: 15_000 });
});

test('SET-01 regenerate recovery codes shows a new set', async ({ page }) => {
  await gotoAuthed(page, '/settings?tab=profile');
  await page.getByRole('button', { name: 'Regenerate recovery codes' }).click();
  await page.getByPlaceholder(/password/i).last().fill(ACCOUNT.password);
  await page.getByRole('button', { name: /Regenerate|Continue|Confirm/ }).last().click();
  const codes = page.getByText(/^[A-Z0-9]{4,6}-[A-Z0-9]{4,6}$/);
  await expect(codes.first()).toBeVisible({ timeout: 15_000 });
  expect(await codes.count()).toBeGreaterThanOrEqual(8);
  if (process.env.CODES_OUT) fs.writeFileSync(process.env.CODES_OUT, (await codes.allInnerTexts()).join(','));
});

test('SET-01 password change succeeds with the current password', async ({ page }) => {
  test.skip(!process.env.E2E_NEW_PASSWORD, 'set E2E_NEW_PASSWORD');
  await gotoAuthed(page, '/settings?tab=profile');
  await page.getByRole('textbox', { name: 'Current password' }).fill(ACCOUNT.password);
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(process.env.E2E_NEW_PASSWORD!);
  await page.getByRole('textbox', { name: 'Confirm new password' }).fill(process.env.E2E_NEW_PASSWORD!);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText(/password (updated|changed)/i).first()).toBeVisible({ timeout: 15_000 });
});
