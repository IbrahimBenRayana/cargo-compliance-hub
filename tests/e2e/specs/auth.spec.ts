import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers';
import { BASE_URL, REMOTE } from './env';

test.describe('Authentication', () => {
  test('login page renders with demo credentials hint', async ({ page }) => {
    test.skip(REMOTE, 'The demo hint only exists on the local dev stack');
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByText(DEMO.email)).toBeVisible();
  });

  test('unauthenticated user is redirected to /login from a protected route', async ({ page }) => {
    await page.goto('/shipments');
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid credentials log in and land on the dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/$`));
    await expect(page.getByText(/shipments? in flight|your shipments will flow through here/i).first()).toBeVisible();
  });

  test('invalid credentials are rejected and keep the user on /login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', DEMO.email);
    await page.fill('#password', 'wrong-password-xyz');
    await page.click('button[type=submit]');
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('session survives a hard page reload (refresh-token recovery)', async ({ page }) => {
    await login(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/shipments? in flight|your shipments will flow through here/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});
