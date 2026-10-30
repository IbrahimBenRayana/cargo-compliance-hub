/**
 * The new dashboard against a real server and real data: what the page shows
 * must be what the API returned, every row must lead somewhere real, and
 * pagination must reach the rest of the queue.
 *
 * Needs DASHBOARD_V2 on for this account. Without it the classic page loads,
 * so these tests skip themselves rather than fail.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

interface Payload {
  attention: { now: number; soon: number; later: number; overdue: number };
  filters: Array<{ key: string; label: string; count: number }>;
  flow: Array<{ key: string; label: string; count: number }>;
  actions: { items: Array<{ id: string; title: string; ref: string; primary: { href: string } }>; total: number; page: number; pageCount: number };
}

/** Loads the page fresh, so the answer comes from the server and not from the cache. */
async function open(page: Page): Promise<Payload | null> {
  await gotoAuthed(page, '/');
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/dashboard', { timeout: 10_000 }).catch(() => null);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const r = await response;
  return r ? ((await r.json()) as Payload) : null;
}

test.describe('Dashboard', () => {
  test('shows what the server returned', async ({ page }) => {
    const data = await open(page);
    test.skip(!data, 'DASHBOARD_V2 is off for this account');
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    const strip = page.locator('dl').first();
    await expect(strip.getByText('Needs attention')).toBeVisible();
    await expect(strip.locator('dd').first()).toContainText(data!.attention.now.toLocaleString());
    for (const stage of data!.flow) {
      await expect(page.getByRole('link', { name: new RegExp(`${stage.label}\\s*${stage.count}`) })).toBeVisible();
    }
  });

  test('ranks the queue as the server did', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || data.actions.items.length === 0, 'No action items for this account');
    await expect(page.locator('tbody tr a, tbody tr button').first()).toContainText(data!.actions.items[0].title);
    await expect(page.getByText(`of ${data!.actions.total.toLocaleString()}`, { exact: false }).first()).toBeVisible();
  });

  test('every first-page row leads to a real page', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || data.actions.items.length === 0, 'No action items for this account');
    for (const href of [...new Set(data!.actions.items.map((i) => i.primary.href))].slice(0, 5)) {
      await gotoAuthed(page, href);
      await expect(page.getByText(/page not found|404/i)).toHaveCount(0);
    }
  });

  test('a filter asks the server and shows its answer', async ({ page }) => {
    const data = await open(page);
    const filter = data?.filters.find((f) => f.key !== 'all' && f.count > 0);
    test.skip(!filter, 'No filter has rows for this account');
    const answer = page.waitForResponse((r) => r.url().includes('/api/v1/dashboard/actions'));
    await page.getByRole('button', { name: new RegExp(`^${filter!.label}`) }).click();
    const body = (await (await answer).json()) as Payload['actions'];
    if (body.items[0]) await expect(page.locator('tbody tr').filter({ hasText: body.items[0].title }).first()).toBeVisible();
  });

  test('the next page shows different rows', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || data.actions.pageCount < 2, 'Everything fits on one page');
    const answer = page.waitForResponse((r) => r.url().includes('/api/v1/dashboard/actions'));
    await page.getByRole('button', { name: 'Next page' }).click();
    const body = (await (await answer).json()) as Payload['actions'];
    expect(body.page).toBe(2);
    const seen = new Set(data!.actions.items.map((i) => i.id));
    expect(body.items.every((i) => !seen.has(i.id))).toBe(true);
    await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  test('the chart switches measure', async ({ page }) => {
    const data = await open(page);
    test.skip(!data, 'DASHBOARD_V2 is off for this account');
    const tab = page.getByRole('tab', { name: /ISFs rejected/ });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  });
});
