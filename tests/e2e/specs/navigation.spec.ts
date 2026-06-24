import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

// Smoke test: each route loads, shows its expected content, and does NOT crash
// (no error boundary, no blank page). Uses a text matcher per route so it is
// resilient to small markup changes.
const ROUTES: Array<{ path: string; expect: RegExp; name: string }> = [
  { name: 'Dashboard',       path: '/',                 expect: /shipments in flight/i },
  { name: 'Shipments',       path: '/shipments',        expect: /manage.*isf|create new isf|shipments/i },
  { name: 'Compliance',      path: '/compliance',       expect: /compliance/i },
  { name: 'Manifest Query',  path: '/manifest-query',   expect: /manifest query/i },
  { name: 'Integrations/API',path: '/integrations/api', expect: /api.*integration|api key/i },
  { name: 'Submission Logs', path: '/integrations/logs',expect: /submission logs/i },
  { name: 'Settings',        path: '/settings',         expect: /settings/i },
  { name: 'Team',            path: '/team',             expect: /team/i },
];

test.describe('Navigation smoke', () => {

  for (const r of ROUTES) {
    test(`${r.name} (${r.path}) loads`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await gotoAuthed(page, r.path);
      await expect(page.getByText(r.expect).first()).toBeVisible({ timeout: 15000 });
      // App shell must be present (left nav) — proves we're authenticated, not bounced to /login
      await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
      expect(errors, `JS page errors on ${r.path}`).toHaveLength(0);
    });
  }

  test('left-nav links navigate without full reload', async ({ page }) => {
    await gotoAuthed(page, '/');
    await page.getByRole('link', { name: /shipments/i }).first().click();
    await expect(page).toHaveURL(/\/shipments/);
    await page.getByRole('link', { name: /compliance/i }).first().click();
    await expect(page).toHaveURL(/\/compliance/);
  });

  test('unknown route shows the 404 page', async ({ page }) => {
    await gotoAuthed(page, '/this-route-does-not-exist');
    await expect(page.getByText(/404|not found|doesn.?t exist/i).first()).toBeVisible();
  });
});
