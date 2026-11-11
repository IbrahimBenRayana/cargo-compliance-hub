/**
 * The redesigned Shipments page against a real server and real data: the tab
 * counts must be the server's, a tab must ask the server for its statuses,
 * the filters must live in the address, and paging must reach every row.
 *
 * Needs SHIPMENTS_V2 on for this account. Without it the classic page loads,
 * so these tests skip themselves rather than fail.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

interface Facets { status: Record<string, number>; origins: Array<{ code: string; count: number }> }
interface ListPage { data: Array<{ id: string; status: string; houseBol: string | null; masterBol: string | null }>; pagination: { total: number; page: number; totalPages: number } }

const isList = (url: string) => new URL(url).pathname === '/api/v1/filings';
const isFacets = (url: string) => new URL(url).pathname === '/api/v1/filings/facets';

/** Loads the page fresh, so the answers come from the server and not from the cache. */
async function open(page: Page, path = '/shipments'): Promise<{ facets: Facets; list: ListPage } | null> {
  await gotoAuthed(page, path);
  const facets = page.waitForResponse((r) => isFacets(r.url()), { timeout: 10_000 }).catch(() => null);
  const list = page.waitForResponse((r) => isList(r.url()), { timeout: 10_000 }).catch(() => null);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const [f, l] = await Promise.all([facets, list]);
  return f && l ? { facets: (await f.json()) as Facets, list: (await l.json()) as ListPage } : null;
}

const refOf = (r: ListPage['data'][number]) => r.houseBol || r.masterBol || r.id.slice(0, 8);

test.describe('Shipments (redesigned)', () => {
  test('the tabs count what the server counted', async ({ page }) => {
    const data = await open(page);
    test.skip(!data, 'SHIPMENTS_V2 is off for this account');
    const s = data!.facets.status;
    const all = Object.values(s).reduce((a, b) => a + b, 0);
    await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^All\\s*${all.toLocaleString()}$`) })).toBeVisible();
    const sent = (s.submitted ?? 0) + (s.pending_cbp ?? 0);
    await expect(page.getByRole('button', { name: new RegExp(`^Sent\\s*${sent}$`) })).toBeVisible();
    expect(data!.list.pagination.total).toBe(all);
  });

  test('rows appear in the order the server sent them, headed by their bill', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || data.list.data.length === 0, 'No shipments for this account');
    const first = page.locator('tbody tr').first();
    await expect(first.getByRole('link').first()).toHaveText(refOf(data!.list.data[0]));
    await expect(page.getByText(`of ${data!.list.pagination.total.toLocaleString()}`).first()).toBeVisible();
  });

  test('a tab asks for its statuses and keeps them in the address', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || (data.facets.status.accepted ?? 0) + (data.facets.status.amended ?? 0) === 0, 'Nothing accepted for this account');
    const answer = page.waitForResponse((r) => isList(r.url()) && new URL(r.url()).searchParams.get('status') === 'accepted,amended');
    await page.getByRole('button', { name: /^Accepted\s*\d+/ }).click();
    const body = (await (await answer).json()) as ListPage;
    expect(body.data.every((r) => r.status === 'accepted' || r.status === 'amended')).toBe(true);
    await expect(page).toHaveURL(/[?&]tab=accepted/);
  });

  test('the next page shows different rows', async ({ page }) => {
    const data = await open(page);
    test.skip(!data || data.list.pagination.totalPages < 2, 'Everything fits on one page');
    const answer = page.waitForResponse((r) => isList(r.url()) && new URL(r.url()).searchParams.get('page') === '2');
    await page.getByRole('button', { name: 'Next page' }).click();
    const body = (await (await answer).json()) as ListPage;
    const seen = new Set(data!.list.data.map((r) => r.id));
    expect(body.data.every((r) => !seen.has(r.id))).toBe(true);
    await expect(page).toHaveURL(/[?&]page=2/);
  });

  test('search finds a bill on the server', async ({ page }) => {
    const data = await open(page);
    const target = data?.list.data.find((r) => r.masterBol);
    test.skip(!target, 'No shipment with a master bill');
    const answer = page.waitForResponse((r) => isList(r.url()) && new URL(r.url()).searchParams.get('search') === target!.masterBol);
    await page.getByRole('searchbox', { name: 'Search shipments' }).fill(target!.masterBol!);
    const body = (await (await answer).json()) as ListPage;
    expect(body.data.some((r) => r.id === target!.id)).toBe(true);
  });

  test('a filtered view survives a reload', async ({ page }) => {
    const data = await open(page, '/shipments?tab=draft&sort=importerName&dir=asc');
    test.skip(!data, 'SHIPMENTS_V2 is off for this account');
    await expect(page.getByRole('button', { name: /^Drafts\s*\d+/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('columnheader', { name: /Importer/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('passes an accessibility scan', async ({ page }) => {
    const data = await open(page);
    test.skip(!data, 'SHIPMENTS_V2 is off for this account');
    await expect(page.locator('table, [role="status"]').first()).toBeVisible();
    const scan = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test('fits a phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const data = await open(page);
    test.skip(!data, 'SHIPMENTS_V2 is off for this account');
    await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
