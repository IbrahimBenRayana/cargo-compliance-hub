/**
 * ISF lifecycle on CBP CERT, through the screens (testing week ISF-01/03/04).
 * OPT-IN: sends real (test) traffic to CBP's certification system under S7P.
 *   RUN_CERT=1 ... playwright test specs/isf-cert-lifecycle.spec.ts
 * Each run uses fresh bill numbers so CBP never sees a duplicate.
 */
import { test, expect } from './fixtures';
import { gotoAuthed, fillIsf10 } from './helpers';

test.skip(process.env.RUN_CERT !== '1', 'Sends to CBP CERT: set RUN_CERT=1');
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString().slice(-8);
const masterBol = `MAEU26${stamp}`;
const houseBol = `HLCU26${stamp}`; // must start with a real SCAC (CBP 154 otherwise)
let shipmentUrl = '';

test('ISF-01: the wizard creates a complete draft', async ({ page }) => {
  await gotoAuthed(page, '/shipments/new');
  await fillIsf10(page, { masterBol, houseBol });
  await expect(page.getByText(/Review & Submit/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Create ISF Filing/i }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  shipmentUrl = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { name: houseBol })).toBeVisible();
});

test('ISF-03: Send to CBP shows who files it and where, then CBP accepts', async ({ page }) => {
  test.setTimeout(240_000);
  await gotoAuthed(page, shipmentUrl);
  await page.getByRole('button', { name: /Start Submission/i }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText(/Send this ISF to CBP\?/)).toBeVisible();
  await expect(dialog.getByText(/S7P/)).toBeVisible();
  await expect(dialog.getByText(/CBP certification \(test\)/)).toBeVisible();
  await expect(dialog.getByText(houseBol)).toBeVisible();
  await dialog.getByRole('button', { name: /Send to CBP/ }).click();
  // CBP answers within a minute or two; the page updates by itself.
  await expect(page.getByText(/ISF Add\s*Accepted by CBP/).first()).toBeVisible({ timeout: 200_000 });
  await expect(page.getByText('Accepted').first()).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/test-results/cert-accepted.png', fullPage: true });
});

test('ISF-04: amend (replace) is accepted, then cancel deletes it at CBP', async ({ page }) => {
  test.setTimeout(420_000);
  await gotoAuthed(page, shipmentUrl);
  await page.getByRole('button', { name: /^Amend$/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: /Send amendment to CBP/ }).click();
  await expect(page.getByText(/ISF Replace\s*Accepted by CBP/).first()).toBeVisible({ timeout: 200_000 });

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Cancel Filing/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: /Confirm Cancellation/ }).click();
  await expect(page.getByText(/ISF Delete\s*Accepted by CBP/).first()).toBeVisible({ timeout: 200_000 });
  await page.screenshot({ path: 'tests/e2e/test-results/cert-deleted.png', fullPage: true });
});
