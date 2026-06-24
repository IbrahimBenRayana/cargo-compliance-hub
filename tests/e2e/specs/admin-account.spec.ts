import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.describe('Platform admin', () => {

  test('admin clients page loads for a platform admin', async ({ page }) => {
    await gotoAuthed(page, '/admin');
    await expect(page.getByRole('heading', { name: /clients/i }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Account & lookups', () => {

  test('Settings page renders', async ({ page }) => {
    await gotoAuthed(page, '/settings');
    await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible();
  });

  test('Team management page renders', async ({ page }) => {
    await gotoAuthed(page, '/team');
    await expect(page.getByRole('heading', { name: /team/i }).first()).toBeVisible();
  });

  test('API & Integrations page shows API key management', async ({ page }) => {
    await gotoAuthed(page, '/integrations/api');
    await expect(page.getByText(/api.*integration|api key/i).first()).toBeVisible();
  });

  test('Submission Logs page renders', async ({ page }) => {
    await gotoAuthed(page, '/integrations/logs');
    await expect(page.getByRole('heading', { name: /submission logs/i }).first()).toBeVisible();
  });

  test('Manifest Query page renders a search interface', async ({ page }) => {
    await gotoAuthed(page, '/manifest-query');
    await expect(page.getByRole('heading', { name: /manifest query/i }).first()).toBeVisible();
  });

  test('Compliance page renders the compliance overview', async ({ page }) => {
    await gotoAuthed(page, '/compliance');
    await expect(page.getByText(/compliance/i).first()).toBeVisible();
  });
});
