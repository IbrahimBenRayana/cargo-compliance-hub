/**
 * ISF consolidation on CBP CERT (testing week ISF-02 + ISF-06 bulk submit):
 * one master bill, three house bills -> three ISF drafts -> bulk submit ->
 * CBP accepts each. OPT-IN: RUN_CERT=1 (sends test traffic to CBP CERT).
 */
import { test, expect } from './fixtures';
import { gotoAuthed, fillIsf10 } from './helpers';

test.skip(process.env.RUN_CERT !== '1', 'Sends to CBP CERT: set RUN_CERT=1');

test('three house bills become three ISFs; bulk submit; CBP accepts each', async ({ page }) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString().slice(-7);
  const masterBol = `MAEU27${stamp}`;
  const hbls = [`HLCU27${stamp}1`, `HLCU27${stamp}2`, `HLCU27${stamp}3`];

  await gotoAuthed(page, '/shipments/new');
  await fillIsf10(page, { masterBol, houseBol: hbls[0], extraHouseBols: hbls.slice(1) });
  await page.getByRole('button', { name: /Create ISF Filing|Create \d+ ISF/i }).click();
  await expect(page.getByText(/consolidation created — 3 ISF drafts/)).toBeVisible({ timeout: 20_000 });

  await gotoAuthed(page, '/shipments');
  await page.getByPlaceholder(/Search bill of lading/).fill(masterBol);
  const rows = page.locator('tbody tr').filter({ has: page.getByRole('checkbox') });
  await expect(rows).toHaveCount(3, { timeout: 15_000 });
  for (let i = 0; i < 3; i++) await rows.nth(i).getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Submit 3$/ }).click();
  const confirm = page.getByRole('alertdialog');
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /Send|Submit|Confirm/ }).last().click();

  // CBP answers each within a couple of minutes; the list shows the result.
  await expect.poll(async () => {
    await page.reload();
    await page.getByPlaceholder(/Search bill of lading/).fill(masterBol);
    await page.waitForTimeout(1500);
    return (await rows.allInnerTexts()).filter((t) => /Accepted/.test(t)).length;
  }, { timeout: 300_000, intervals: [20_000] }).toBe(3);
});
