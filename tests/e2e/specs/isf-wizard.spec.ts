import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.describe('ISF filing wizard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/shipments/new');
    await expect(page.getByText(/new isf filing/i)).toBeVisible();
  });

  test('step 1 shows filing type, bond type and bill-of-lading fields', async ({ page }) => {
    await expect(page.getByText(/filing info/i).first()).toBeVisible();
    await expect(page.getByText(/master bill of lading/i)).toBeVisible();
    await expect(page.getByText(/house bill of lading/i)).toBeVisible();
    // stepper shows the 6 stages
    await expect(page.getByText(/ior & consignee/i)).toBeVisible();
    await expect(page.getByText(/review & submit/i)).toBeVisible();
  });

  test('advancing to step 2 after entering bill-of-lading numbers', async ({ page }) => {
    await page.getByPlaceholder(/MAEU/i).fill('MAEU1234567890');
    await page.getByPlaceholder(/HCLA/i).fill('HCLA12345678');
    await page.getByRole('button', { name: /next/i }).click();
    // Step 2 is "IOR & Consignee" — its form content should now be active.
    await expect(page.getByText(/ior & consignee/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
  });

  test('back button returns to the previous step', async ({ page }) => {
    await page.getByPlaceholder(/MAEU/i).fill('MAEU1234567890');
    await page.getByPlaceholder(/HCLA/i).fill('HCLA12345678');
    await page.getByRole('button', { name: /next/i }).click();
    const back = page.getByRole('button', { name: /back/i });
    await expect(back).toBeVisible();
    await back.click();
    // Back on step 1 — the bill-of-lading inputs are visible again.
    await expect(page.getByPlaceholder(/MAEU/i)).toBeVisible();
  });
});
