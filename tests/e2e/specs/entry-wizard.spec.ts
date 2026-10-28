/**
 * ENT-01 (testing week): a new entry through the 6-step wizard. Each step is
 * first tried empty (Next must show the step's errors and stay put), then
 * filled; the entry number is drawn from the org's block; Review shows the
 * duty estimate and a ready preflight. Saves a draft; never transmits.
 */
import { test, expect, type Page } from './fixtures';
import { gotoAuthed } from './helpers';

const field = (page: Page, label: string) => page.getByLabel(new RegExp(`^${label}`)).first();
async function text(page: Page, label: string, value: string) { await field(page, label).fill(value); }
async function pick(page: Page, label: string, option: RegExp) {
  await field(page, label).click();
  await page.getByRole('option', { name: option }).first().click({ timeout: 10_000 });
}
async function combo(page: Page, label: string, search: string, option: RegExp) {
  await field(page, label).click();
  await page.locator('[cmdk-input]').last().fill(search);
  await page.getByRole('option', { name: option }).first().click({ timeout: 10_000 });
}
async function emptyNextShowsErrors(page: Page, step: string) {
  await page.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByText(/Fix \d+ issues? above to continue/)).toBeVisible();
  const n = await page.getByText(/^Required/).count();
  console.log(`${step}: empty Next -> ${await page.getByText(/Fix \d+ issues?/).innerText()} (${n} 'Required' messages)`);
}
const ymd = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

test('new entry: every step validates, then a complete draft is ready to send', async ({ page }) => {
  test.setTimeout(240_000);
  await gotoAuthed(page, '/abi-documents/new');
  const next = () => page.getByRole('button', { name: /^Next/ }).click();

  // Step 1 — Entry
  await emptyNextShowsErrors(page, 'Entry');
  await pick(page, 'Entry Type', /Consumption Entry \(Formal\)/);
  await pick(page, 'Mode of Transport', /^11 —/);
  await page.getByRole('button', { name: /Assign next number/ }).click();
  await expect(field(page, 'Entry Number')).toHaveValue(/^[A-Z0-9]{3}-\d{7}-\d$/, { timeout: 15_000 });
  console.log('hint shown:', await page.getByText(/Drawn from your block/).isVisible());
  console.log('drawn:', await field(page, 'Entry Number').inputValue());
  await field(page, 'Entry Date').fill(ymd(0));
  await field(page, 'Import Date').fill(ymd(-2));
  await field(page, 'Arrival Date').fill(ymd(-3));
  await combo(page, 'Port of Entry', '2704', /2704/);
  await pick(page, 'Destination State', /California/);
  await text(page, 'FIRMS Code', 'Y123');
  await next();

  // Step 2 — Importer & bond
  await expect(field(page, 'IOR Number')).toBeVisible();
  await emptyNextShowsErrors(page, 'Importer');
  await text(page, 'IOR Number', '57-123456789');
  await text(page, 'IOR Name', 'QA FULL BROKER IMPORTS');
  await pick(page, 'Bond Type', /Continuous/);
  await text(page, 'Bond Tax ID', '57-123456789');
  await text(page, 'Surety Code', '123');
  await pick(page, 'Payment Type Code', /Individual payment/);
  await next();

  // Step 3 — Consignee
  await expect(field(page, 'Name')).toBeVisible();
  await emptyNextShowsErrors(page, 'Consignee');
  await text(page, 'Name', 'QA FULL BROKER IMPORTS');
  await text(page, 'Tax ID', '57-123456789');
  await text(page, 'Address', '1 MAIN ST');
  await text(page, 'City', 'LOS ANGELES');
  const state = field(page, 'State');
  if ((await state.getAttribute('role')) === 'combobox' || (await state.evaluate((e) => e.tagName)) === 'BUTTON') await combo(page, 'State', 'California', /California/);
  else await state.fill('CA');
  await text(page, 'Postal Code', '90001');
  await combo(page, 'Country', 'United States', /United States(?! Minor)/);
  await next();

  // Step 4 — Manifest
  await expect(field(page, 'Master BOL')).toBeVisible();
  await emptyNextShowsErrors(page, 'Manifest');
  const bol = `MAEU2610${Date.now().toString().slice(-6)}`;
  await pick(page, 'Bill Type', /^Master$/);
  await text(page, 'Master BOL', bol);
  await text(page, 'House BOL', bol);
  await text(page, 'Carrier SCAC Code', 'MAEU');
  await combo(page, 'Port of Unlading', '2704', /2704/);
  await text(page, 'Foreign Port of Lading', '57069');
  await text(page, 'Quantity', '100');
  await pick(page, 'Qty UOM', /^PCS/);
  await next();

  // Step 5 — Invoices (one invoice, one line, one manufacturer + seller)
  await page.getByRole('button', { name: /Add invoice/ }).first().click();
  await expect(field(page, 'Purchase Order')).toBeVisible();
  await emptyNextShowsErrors(page, 'Invoices');
  if (!(await field(page, 'SKU / Part #').isVisible().catch(() => false))) await page.getByRole('button', { name: /Add item/ }).first().click();
  await text(page, 'Purchase Order', 'PO-UI-1');
  await text(page, 'Invoice Number', 'INV-UI-1');
  await field(page, 'Export Date').fill(ymd(-20));
  await combo(page, 'Country of Export', 'China', /China/);
  await text(page, 'SKU / Part #', 'BAT-UI');
  await text(page, 'HTS Number', '8507600030');
  await text(page, 'Description', 'LITHIUM ION BATTERY PACKS');
  await combo(page, 'Country of Origin', 'China', /China/);
  await text(page, 'Total Value of Goods', '10000');
  await text(page, 'Quantity \\(Unit 1\\)', '500');
  await text(page, 'Gross Weight', '1200');
  await pick(page, 'Weight UOM', /Kilograms/);
  for (const [i, [type, name]] of [['Manufacturer', 'SHENZHEN BATTERY CO'], ['Seller', 'SHENZHEN TRADING CO'], ['Buyer', 'QA FULL BROKER IMPORTS']].entries()) {
    if (type === 'Buyer') {
      // Without a buyer, Next must name the missing "sold to" party (BUG-039).
      await page.getByRole('button', { name: /^Next/ }).click();
      await expect(page.getByText(/Add a Buyer party with its tax ID/)).toBeVisible();
    }
    const parties = page.getByLabel(/^Party Type/);
    if ((await parties.count()) <= i) await page.getByRole('button', { name: /Add party/ }).first().click();
    await parties.nth(i).click();
    await page.getByRole('option', { name: new RegExp(`^${type}$`) }).click({ timeout: 10_000 });
    await page.getByLabel(/^Name/).nth(i).fill(name);
    await page.getByLabel(/^Address/).nth(i).fill(`${8 + i} INDUSTRY RD`);
    await page.getByLabel(/^City/).nth(i).fill(type === 'Buyer' ? 'LOS ANGELES' : 'SHENZHEN');
    if (type === 'Buyer') await page.getByLabel(/^Tax ID/).nth(i).fill('57-123456789');
    await page.getByLabel(/^Country\W*$/).nth(i).click();
    await page.locator('[cmdk-input]').last().fill(type === 'Buyer' ? 'United States' : 'China');
    await page.getByRole('option', { name: type === 'Buyer' ? /United States(?! Minor)/ : /China/ }).first().click();
    if (type === 'Buyer') await pick(page, 'State', /California/).catch(() => undefined);
  }
  await page.screenshot({ path: 'tests/e2e/test-results/entry-wizard-step5.png', fullPage: true });
  await next();
  const stuck = await page.getByText(/Fix \d+ issues?/).isVisible().catch(() => false);
  if (stuck) {
    const errs = await page.locator('p.text-red-500').allInnerTexts();
    console.log('Step 5 still blocked:', errs);
  }

  // Step 6 — Review
  await expect(page.getByRole('button', { name: /Transmit to CBP/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tests/e2e/test-results/entry-wizard-review.png', fullPage: true });
  console.log('REVIEW:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 1500));
  // The saved entry is complete: server preflight clean, duty priced
  // ($10,000 x 3.4% + MPF 34.64 + HMF 12.50).
  await expect(page.getByText('Fix these before sending to CBP')).toHaveCount(0);
  await expect(page.getByText('$387.14').first()).toBeVisible();
});
