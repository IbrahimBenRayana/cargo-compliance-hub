import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

// A 1x1 PNG (valid magic bytes so the server's file-type check accepts it).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Filing documents', () => {
  test('upload a document to a filing, see it listed, then delete it', async ({ page }) => {
    // Open a filing's detail page via the shipments list.
    await gotoAuthed(page, '/shipments');
    await page.locator('table tbody tr a[href^="/shipments/"]').first().click();
    await expect(page).toHaveURL(/\/shipments\/[^/]+$/);

    const fileName = `e2e-upload-${Date.now()}.png`;

    // Open the upload dialog and attach the file.
    await page.getByRole('button', { name: /^Upload$/ }).first().click();
    const dialog = page.getByRole('dialog').filter({ hasText: /Upload Document/i });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });
    await dialog.getByRole('button', { name: /^Upload$/ }).click();

    // Confirmation toast + the document appears in the list.
    await expect(page.getByText(/file\(s\) uploaded/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(fileName)).toBeVisible();

    // Clean up: delete the document we just uploaded.
    const docRow = page.locator('div', { hasText: fileName }).filter({ has: page.getByRole('button', { name: /Delete/i }) }).last();
    await docRow.getByRole('button', { name: /Delete/i }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(fileName)).toHaveCount(0, { timeout: 15000 });
  });
});
