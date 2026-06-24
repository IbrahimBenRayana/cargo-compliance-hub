import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

// Exercises the public-API key lifecycle on /integrations/api:
// create (one-time secret reveal) -> appears in list -> revoke.
test.describe('API keys', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/integrations/api');
    await expect(page.getByText(/api.*integration|api key/i).first()).toBeVisible();
  });

  test('create a key, see the one-time secret, then revoke it', async ({ page }) => {
    const keyName = `e2e-key-${Date.now()}`;

    // --- Create ---
    await page.getByRole('button', { name: /^Create (API key|your first key)/i }).first().click();
    await page.locator('#api-key-name').fill(keyName);
    await page.locator('[id="scope-filings:write"]').click();
    await page.getByRole('button', { name: /^Create key$/i }).click();

    // --- One-time secret reveal ---
    const dialog = page.getByRole('dialog').filter({ hasText: /API key created/i });
    await expect(dialog).toBeVisible();
    const secret = await dialog.locator('input').first().inputValue();
    expect(secret).toMatch(/^mcl_live_/);
    await page.getByRole('button', { name: /^Done$/i }).click();

    // --- Appears in the list, active (has a Revoke control) ---
    const row = page.getByRole('row', { name: new RegExp(keyName) });
    await expect(row).toBeVisible();
    await expect(row.getByText('filings:write')).toBeVisible();
    const revokeBtn = row.getByRole('button', { name: /Revoke key/i });
    await expect(revokeBtn).toBeVisible();

    // --- Revoke ---
    await revokeBtn.click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^Revoke key$/i }).click();

    // --- Now shown as revoked ---
    await expect(page.getByRole('row', { name: new RegExp(keyName) }).getByText(/revoked/i)).toBeVisible();
  });

  test('create dialog validates and lists available scopes', async ({ page }) => {
    await page.getByRole('button', { name: /^Create (API key|your first key)/i }).first().click();
    const dialog = page.getByRole('dialog').filter({ hasText: /Create API key/i });
    await expect(dialog.getByText('filings:write')).toBeVisible();
    await expect(dialog.getByText('filings:read')).toBeVisible();
    await expect(dialog.getByText('entries:write')).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
  });
});
