/**
 * The redesigned Shipments page against a real server and real data: the tab
 * counts must be the server's, each control must ask the server and show its
 * answer, the filters must live in the address, and paging must reach every row.
 *
 * Needs SHIPMENTS_V2 on for this account. Without it the classic page loads,
 * so these tests skip themselves rather than fail. They drive the page instead
 * of reloading it, because every reload spends ~10 of the API's 100 requests a
 * minute.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, Response } from '@playwright/test';
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

interface Row { id: string; status: string; houseBol: string | null; masterBol: string | null; estimatedDeparture: string | null; commodities: Array<{ countryOfOrigin?: string }> }
interface ListPage { data: Row[]; pagination: { total: number; page: number; totalPages: number } }
interface Facets { status: Record<string, number>; origins: Array<{ code: string; count: number }> }

const listed = (r: Response, check: (q: URLSearchParams) => boolean = () => true) =>
  new URL(r.url()).pathname === '/api/v1/filings' && check(new URL(r.url()).searchParams);
const refOf = (r: Row) => r.houseBol || r.masterBol || r.id.slice(0, 8);
const allTab = (page: Page) => page.getByRole('button', { name: /^All\s*[\d,]+$/ });

/** The redesigned page, from a known address. False when the classic page loads instead. */
async function show(page: Page, path = '/shipments'): Promise<boolean> {
  await gotoAuthed(page, path);
  await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible({ timeout: 15_000 });
  await page.locator('table').or(page.getByText(/^No shipments/)).first().waitFor({ timeout: 15_000 }).catch(() => {});
  return (await allTab(page).count()) > 0;
}

const rowIds = async (page: Page) =>
  (await page.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelector('a[href^="/shipments/"]')?.getAttribute('href')))).filter(Boolean);

test.describe('Shipments (redesigned)', () => {
  test('the tabs and rows are what the server sent', async ({ page }) => {
    await gotoAuthed(page, '/shipments');
    const facets = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/filings/facets', { timeout: 10_000 }).catch(() => null);
    const list = page.waitForResponse((r) => listed(r), { timeout: 10_000 }).catch(() => null);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const [f, l] = await Promise.all([facets, list]);
    test.skip(!f || !l, 'SHIPMENTS_V2 is off for this account');
    const s = ((await f!.json()) as Facets).status;
    const body = (await l!.json()) as ListPage;
    const all = Object.values(s).reduce((a, b) => a + b, 0);
    await expect(allTab(page)).toHaveText(new RegExp(`^All\\s*${all.toLocaleString()}$`));
    const sent = (s.submitted ?? 0) + (s.pending_cbp ?? 0);
    await expect(page.getByRole('button', { name: new RegExp(`^Sent\\s*${sent}$`) })).toBeVisible();
    expect(body.pagination.total).toBe(all);
    if (body.data[0]) await expect(page.locator('tbody tr').first().getByRole('link').first()).toHaveText(refOf(body.data[0]));
    await expect(page.getByText(`of ${body.pagination.total.toLocaleString()}`).first()).toBeVisible();
  });

  test('a tab asks for its statuses and keeps them in the address', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    const tab = page.getByRole('button', { name: /^Accepted\s*\d+/ });
    test.skip(await tab.isDisabled(), 'Nothing accepted for this account');
    const answer = page.waitForResponse((r) => listed(r, (q) => q.get('status') === 'accepted,amended'));
    await tab.click();
    const body = (await (await answer).json()) as ListPage;
    expect(body.data.every((r) => r.status === 'accepted' || r.status === 'amended')).toBe(true);
    await expect(page).toHaveURL(/[?&]tab=accepted/);
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
  });

  test('the next page shows different rows', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    const next = page.getByRole('button', { name: 'Next page' });
    test.skip((await next.count()) === 0 || (await next.isDisabled()), 'Everything fits on one page');
    const before = new Set(await rowIds(page));
    const answer = page.waitForResponse((r) => listed(r, (q) => q.get('page') === '2'));
    await next.click();
    await answer;
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(async () => (await rowIds(page)).some((id) => before.has(id))).toBe(false);
  });

  test('search finds a bill on the server', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    const ref = (await page.locator('tbody tr').first().getByRole('link').first().textContent())?.trim();
    test.skip(!ref, 'No shipments for this account');
    const answer = page.waitForResponse((r) => listed(r, (q) => q.get('search') === ref));
    await page.getByRole('searchbox', { name: 'Search shipments' }).fill(ref!);
    const body = (await (await answer).json()) as ListPage;
    expect(body.data.some((r) => refOf(r) === ref)).toBe(true);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(ref!)}`));
  });

  test('an origin filter returns only shipments from there', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    await page.getByRole('button', { name: /^Origin/ }).click();
    const option = page.locator('[role="dialog"] label').first();
    test.skip((await option.count()) === 0, 'No countries of origin on file');
    const shown = Number((await option.locator('span').last().textContent())!.replace(/,/g, ''));
    const answer = page.waitForResponse((r) => listed(r, (q) => q.has('origin')));
    await option.click();
    const response = await answer;
    const code = new URL(response.url()).searchParams.get('origin')!;
    const body = (await response.json()) as ListPage;
    expect(body.pagination.total).toBe(shown);
    expect(body.data.every((r) => r.commodities[0]?.countryOfOrigin === code)).toBe(true);
    await page.keyboard.press('Escape');
  });

  test('a departure range returns only shipments sailing inside it', async ({ page }) => {
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const path = `/shipments?from=${day(new Date(Date.now() - 2 * 86_400_000))}&to=${day(new Date(Date.now() + 5 * 86_400_000))}`;
    const answer = page.waitForResponse((r) => listed(r, (q) => q.has('etdFrom') && q.has('etdTo')), { timeout: 15_000 }).catch(() => null);
    const v2 = await show(page, path);
    test.skip(!v2, 'SHIPMENTS_V2 is off for this account');
    const response = await answer;
    expect(response, 'the list asked with the range').not.toBeNull();
    const q = new URL(response!.url()).searchParams;
    for (const r of ((await response!.json()) as ListPage).data) {
      const etd = new Date(r.estimatedDeparture!).getTime();
      expect(etd).toBeGreaterThanOrEqual(new Date(q.get('etdFrom')!).getTime());
      expect(etd).toBeLessThanOrEqual(new Date(q.get('etdTo')!).getTime());
    }
    await expect(page.getByRole('button', { name: /^Departs \w{3} \d+ – \w{3} \d+/ })).toBeVisible();
  });

  test('a filtered view survives a reload', async ({ page }) => {
    test.skip(!(await show(page, '/shipments?tab=draft&sort=importerName&dir=asc')), 'SHIPMENTS_V2 is off for this account');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Drafts\s*\d+/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: /Importer/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('passes an accessibility scan', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    const scan = await new AxeBuilder({ page }).include('#main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test('fits a phone without scrolling sideways, and still shows each bill', async ({ page }) => {
    test.skip(!(await show(page)), 'SHIPMENTS_V2 is off for this account');
    // The page is shared by every spec in this worker, so put the size back afterwards.
    await page.setViewportSize({ width: 375, height: 812 });
    try {
      const ref = page.locator('tbody tr').first().getByRole('link').first();
      if (await ref.count()) {
        await expect(ref).toBeVisible();
        expect((await ref.boundingBox())!.width).toBeGreaterThan(60);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  });
});
