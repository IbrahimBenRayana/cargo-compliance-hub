/**
 * ENT-08 (testing week): the entry wizard saves before it transmits. Offline,
 * the edit shows "Not saved, retry" and Transmit sends nothing; back online,
 * the edited entry is what goes out. OPT-IN: RUN_CERT=1 and ENT_DOC=<draft id>
 * (sends to CBP CERT under the org's filer code).
 */
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.skip(process.env.RUN_CERT !== '1' || !process.env.ENT_DOC, 'Sends to CBP CERT: set RUN_CERT=1 and ENT_DOC');

test('edit then transmit: offline sends nothing, online sends the edit', async ({ page }) => {
  test.setTimeout(180_000);
  const id = process.env.ENT_DOC!;
  await gotoAuthed(page, `/abi-documents/${id}/edit`);
  const next = page.getByRole('button', { name: /^Next/ });
  for (let i = 0; i < 4; i++) await next.click();
  const desc = page.getByLabel(/^Description/).first();
  await expect(desc).toBeVisible();
  await desc.fill('EDITED ONLINE A');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.context().setOffline(true);
  await desc.fill('EDITED OFFLINE B');
  await expect(page.getByText('Not saved, retry')).toBeVisible({ timeout: 20_000 });
  await next.click();
  await page.getByRole('button', { name: /Transmit to CBP/ }).click();
  await page.getByRole('button', { name: 'Transmit now' }).click();
  await expect(page.getByText(/nothing was sent/)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(new RegExp(`/abi-documents/${id}/edit`));

  await page.context().setOffline(false);
  await page.getByText('Not saved, retry').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Transmit to CBP/ }).click();
  await page.getByRole('button', { name: 'Transmit now' }).click();
  await expect(page).toHaveURL(new RegExp(`/abi-documents/${id}$`), { timeout: 20_000 });
});
