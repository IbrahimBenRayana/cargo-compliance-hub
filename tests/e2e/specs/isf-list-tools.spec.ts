/**
 * Shipments list tools (testing week ISF-06): status filters, search, CSV and
 * PDF export, duplicate, save as template, start from template, use as
 * starting point, bulk delete of drafts.
 * OPT-IN (creates and deletes data): RUN_LIST_TOOLS=1. Needs an accepted ISF
 * with master bill E2E_ACCEPTED_BOL in the account's org.
 */
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.skip(process.env.RUN_LIST_TOOLS !== '1', 'Creates and deletes data: set RUN_LIST_TOOLS=1');
test.describe.configure({ mode: 'serial' });

const BOL = process.env.E2E_ACCEPTED_BOL ?? 'MAEU26102210003';
/** The wizard's completion meter: a copied filing is mostly filled in already. */
async function expectMostlyFilled(page: import('@playwright/test').Page) {
  await expect(page.getByText(/^\d+%$/).first()).toBeVisible({ timeout: 15_000 });
  const pct = Number((await page.getByText(/^\d+%$/).first().innerText()).replace('%', ''));
  expect(pct).toBeGreaterThanOrEqual(60);
}

const templateName = `QA template ${Date.now().toString().slice(-6)}`;
// Shipment rows only (the table also has spacer/detail rows).
const rows = (page: import('@playwright/test').Page) => page.locator('tbody tr').filter({ has: page.getByRole('checkbox') });

test('status filter chips show only that status; search finds one bill', async ({ page }) => {
  await gotoAuthed(page, '/shipments');
  await page.getByRole('button', { name: /^Rejected \d+/ }).click();
  await expect(rows(page).first()).toBeVisible();
  for (const text of await rows(page).allInnerTexts()) expect(text).toMatch(/Rejected/);
  await page.getByRole('button', { name: /^Rejected \d+/ }).click(); // clear
  await page.getByPlaceholder(/Search bill of lading/).fill(BOL);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText(BOL);
});

test('export CSV and summary PDF download real files', async ({ page }) => {
  await gotoAuthed(page, '/shipments');
  for (const [item, ext] of [['Export CSV', '.csv'], ['Export Summary PDF', '.pdf']] as const) {
    await page.getByRole('button', { name: 'Export' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: item }).click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\${ext}$`));
    const size = (await (await download.createReadStream())!.toArray()).reduce((n, b) => n + b.length, 0);
    expect(size).toBeGreaterThan(200);
  }
});

test('duplicate, save as template, start from template, use as starting point', async ({ page }) => {
  await gotoAuthed(page, '/shipments');
  await page.getByPlaceholder(/Search bill of lading/).fill(BOL);
  await rows(page).first().getByRole('link', { name: 'View shipment' }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}$/);
  const shipmentUrl = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Duplicate as New Draft/ }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });

  await gotoAuthed(page, shipmentUrl);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Save as Template/ }).click();
  await page.getByPlaceholder(/China → LA/).fill(templateName);
  await page.getByRole('button', { name: /^Save Template$/ }).click();
  await expect(page.getByText(`Template "${templateName}" saved!`)).toBeVisible();

  await gotoAuthed(page, '/shipments');
  await page.getByRole('button', { name: /From Template/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(templateName) }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
  await expectMostlyFilled(page); // parties, ports, cargo carried over; bills left blank

  await gotoAuthed(page, shipmentUrl);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Use as starting point/ }).click();
  await expect(page).toHaveURL(/\/shipments\/new\?fromFiling=/);
  await expectMostlyFilled(page);
});

test('bulk delete removes the selected drafts after confirmation', async ({ page }) => {
  await gotoAuthed(page, '/shipments');
  const draftChip = page.getByRole('button', { name: /^Draft \d+/ });
  const before = Number((await draftChip.innerText()).match(/\d+/)![0]);
  expect(before).toBeGreaterThanOrEqual(2);
  await draftChip.click();
  await rows(page).nth(0).getByRole('checkbox').check();
  await rows(page).nth(1).getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Delete 2$/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete drafts' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Draft ${before - 2}$`) })).toBeVisible({ timeout: 15_000 });
});
