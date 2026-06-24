import { Page, expect } from '@playwright/test';

export const DEMO = { email: 'demo@mycargolens.com', password: 'password123' };

/**
 * Fresh UI login. The access token lives in memory only, so we log in per
 * test rather than reusing a stored session (refresh tokens rotate single-use).
 */
export async function login(page: Page, creds = DEMO) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Already authenticated? /login bounces to the app — nothing to do.
  if (!new URL(page.url()).pathname.startsWith('/login')) return;

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.fill('#email', creds.email);
    await page.fill('#password', creds.password);
    await page.click('button[type=submit]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
      return;
    } catch {
      // /login is rate-limited to 10/min/IP. If we tripped it, wait out the
      // window once and retry rather than failing the whole worker.
      const limited = await page.getByText(/too many|rate.?limit|try again in a minute/i)
        .first().isVisible().catch(() => false);
      if (!limited || attempt === 1) throw new Error('Login did not complete (not rate-limited)');
      await page.waitForTimeout(61_000);
    }
  }
}

/**
 * Navigate within the already-loaded SPA WITHOUT a hard reload, using the
 * History API (React Router listens to popstate). This keeps the in-memory
 * access token alive, so there is no /auth/refresh round-trip on every
 * navigation — which both avoids the intermittent logout-on-reload race (see
 * FINDINGS.md) and means we only ever hit the rate-limited /login once (in the
 * shared fixture). The page must already be inside the authenticated app.
 */
export async function gotoAuthed(page: Page, path: string) {
  if (page.url() === 'about:blank' || new URL(page.url()).pathname.startsWith('/login')) {
    await login(page); // safety net; normally the fixture already authed us
  }
  // If we're already on this exact path, bounce through "/" first so the route
  // component remounts fresh (avoids stale state leaking between tests, e.g. a
  // half-completed wizard).
  if (new URL(page.url()).pathname === new URL(path, page.url()).pathname) {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(150);
  }
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Bounded: some pages (e.g. /integrations/api) poll continuously and never
  // reach networkidle, so cap the wait instead of blocking to the test timeout.
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** Heading text helper — pages use h1/h2 for their title. */
export async function expectHeading(page: Page, text: string | RegExp) {
  await expect(page.getByRole('heading', { name: text }).first()).toBeVisible();
}

/**
 * Fills all six steps of the ISF-10 wizard with the minimum valid data the
 * backend accepts. Leaves the wizard on the final Review & Submit step.
 * The caller clicks "Create ISF Filing". Importer is "Acme Imports LLC" so
 * test drafts are easy to bulk-clean from the DB.
 */
export async function fillIsf10(page: Page) {
  const next = () => page.getByRole('button', { name: /^Next/ }).click();

  // Step 1 — Filing Info
  await page.getByLabel(/Master Bill of Lading/i).fill('MAEU1234567890');
  await page.getByLabel(/House Bill of Lading/i).fill('HCLA12345678');
  await next();

  // Step 2 — IOR & Consignee
  await page.getByLabel(/Importer Name/i).first().fill('Acme Imports LLC');
  await page.getByLabel(/IOR Number/i).first().fill('20-493538700');
  await page.getByLabel(/Consignee Name/i).first().fill('Acme Distribution Inc');
  await next();

  // Step 3 — Trade Parties (no required fields for ISF-10)
  await expect(page.getByText(/Trade Parties|Buyer|Seller/i).first()).toBeVisible();
  await next();

  // Step 4 — Transport
  await page.getByLabel(/SCAC Code/i).fill('MAEU');
  await page.getByLabel(/Vessel Name/i).fill('EVER GIVEN');
  await page.locator('input[type="date"]').nth(1).fill('2026-09-15'); // Est. Arrival
  await next();

  // Step 5 — Cargo: one commodity (HTS + country of origin)
  await page.getByPlaceholder('e.g., 731815').first().fill('847130');
  await page.getByRole('combobox', { name: /Country of Origin/i }).click();
  await page.getByPlaceholder(/Country, ISO code/i).fill('China');
  await page.getByRole('option').first().click();
  await next();
}
