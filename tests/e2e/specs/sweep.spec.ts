/**
 * Screen sweep (testing week SETUP-06 / X-01): every app route at desktop,
 * tablet and phone width, in light and dark, for the logged-in account.
 *
 * For each screen it saves a full-page screenshot and records what a
 * reviewer would otherwise hunt for by hand:
 *   - horizontal page overflow (the page body scrolls sideways)
 *   - console errors and failed API calls while the screen loads
 *   - axe accessibility violations rated serious or critical (desktop, light)
 *
 * Opt-in, because it takes a while: E2E_SWEEP=1. Output goes to
 * tests/e2e/sweep-output/<label>/ with a report.json beside the images;
 * E2E_SWEEP_LABEL names the run (e.g. the plan tier of the account).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

/** Static routes; detail pages are discovered from the lists below. */
const ROUTES = [
  '/', '/shipments', '/shipments/new', '/abi-documents', '/abi-documents/new',
  '/inbond', '/inbond/new', '/manifest-query', '/duty-calculator', '/tracking',
  '/compliance', '/compliance?tab=risk', '/compliance?tab=classification', '/compliance?tab=records',
  '/settings', '/team', '/integrations/api', '/integrations/logs', '/upgrade',
  '/admin', '/admin/chat', '/admin/cert', '/admin/cbp',
];
/** List page → pattern of its detail links, to sweep one real record each. */
const DETAIL_FROM: Array<[string, RegExp]> = [
  ['/shipments', /^\/shipments\/[0-9a-f-]{36}$/],
  ['/abi-documents', /^\/abi-documents\/[0-9a-f-]{36}$/],
  ['/inbond', /^\/inbond\/[0-9a-f-]{36}$/],
  ['/tracking', /^\/tracking\/[0-9a-f-]{36}$/],
];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'sweep-output', process.env.E2E_SWEEP_LABEL || 'run');
const slug = (route: string) => (route === '/' ? 'dashboard' : route.replace(/^\//, '').replace(/[/?=&]+/g, '_'));

interface ScreenResult {
  route: string;
  width: string;
  scheme: string;
  finalPath: string;
  overflowPx: number;
  consoleErrors: string[];
  failedRequests: string[];
  axe?: Array<{ id: string; impact: string | null; help: string; nodes: number }>;
  screenshot: string;
}

async function discoverDetails(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const [list, pattern] of DETAIL_FROM) {
    await gotoAuthed(page, list);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    const hit = hrefs.find((h) => pattern.test(h));
    if (hit) found.push(hit);
  }
  return found;
}

test.describe('Screen sweep', () => {
  test.skip(!process.env.E2E_SWEEP, 'Set E2E_SWEEP=1 to run the screen sweep');
  test.setTimeout(30 * 60_000);

  test('every route at three widths, light and dark', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const routes = [...ROUTES, ...(await discoverDetails(page))];
    const results: ScreenResult[] = [];

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    page.on('response', (r) => {
      const url = r.url();
      if (r.status() >= 400 && url.includes('/api/')) failedRequests.push(`${r.status()} ${r.request().method()} ${new URL(url).pathname}`);
    });

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w.width, height: w.height });
        for (const route of routes) {
          consoleErrors.length = 0;
          failedRequests.length = 0;
          await gotoAuthed(page, route);
          await page.waitForTimeout(900);
          // Page width AND the main scroll area: the main content can scroll sideways
          // on its own while the page doesn't (missed until X-02, Oct 27).
          const overflowPx = await page.evaluate(() => {
            const main = document.getElementById('main-content');
            return Math.max(
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              main ? main.scrollWidth - main.clientWidth : 0,
            );
          });
          const file = path.join(OUT, `${slug(route)}--${w.name}--${scheme}.png`);
          await page.screenshot({ path: file, fullPage: true });
          const result: ScreenResult = {
            route, width: w.name, scheme, finalPath: new URL(page.url()).pathname + new URL(page.url()).search,
            overflowPx, consoleErrors: [...consoleErrors], failedRequests: [...failedRequests], screenshot: path.basename(file),
          };
          if (w.name === 'desktop' && scheme === 'light') {
            const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
            result.axe = axe.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.length }));
          }
          results.push(result);
        }
      }
    }

    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), base: page.url(), results }, null, 2));
    const problems = results.filter((r) => r.overflowPx > 0 || r.consoleErrors.length || r.failedRequests.length || (r.axe?.length ?? 0));
    console.log(`Sweep: ${results.length} screens, ${problems.length} with findings → ${OUT}`);
    // The sweep reports; reviewing the findings is the human step, so it
    // only fails when nothing was captured at all.
    expect(results.length).toBeGreaterThan(0);
  });
});
