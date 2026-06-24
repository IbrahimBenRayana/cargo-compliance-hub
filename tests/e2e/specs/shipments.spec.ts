import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.describe('Shipments', () => {

  test('list shows seeded shipments in a table', async ({ page }) => {
    await gotoAuthed(page, '/shipments');
    await expect(page.getByRole('heading', { name: /shipments/i }).first()).toBeVisible();
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('status filter chips are present and clickable', async ({ page }) => {
    await gotoAuthed(page, '/shipments');
    const submitted = page.getByText(/submitted/i).first();
    await expect(submitted).toBeVisible();
    await submitted.click(); // should not throw / crash
    await expect(page).toHaveURL(/\/shipments/);
  });

  test('"Create New ISF" opens the filing wizard', async ({ page }) => {
    await gotoAuthed(page, '/shipments');
    await page.getByRole('link', { name: /create new isf/i }).first().click();
    await expect(page).toHaveURL(/\/shipments\/new/);
    await expect(page.getByText(/new isf filing/i)).toBeVisible();
  });

  test('clicking a shipment opens its detail page', async ({ page }) => {
    await gotoAuthed(page, '/shipments');
    // Each row's bill-of-lading cell is a link to /shipments/:id
    const detailLink = page.locator('table tbody tr a[href^="/shipments/"]').first();
    await expect(detailLink).toBeVisible({ timeout: 15000 });
    await detailLink.click();
    await expect(page).toHaveURL(/\/shipments\/[^/]+$/);
  });
});
