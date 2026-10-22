import { Page, expect, test } from '@playwright/test';
import { ACCOUNT, totpCode } from './env';

/** The account the suite logs in as (see env.ts); the local default is the seeded demo. */
export const DEMO = ACCOUNT;

/**
 * Fresh UI login. The access token lives in memory only, so we log in per
 * test rather than reusing a stored session (refresh tokens rotate single-use).
 */
export async function login(page: Page, creds: { email: string; password: string; totpSecret?: string } = DEMO) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Already authenticated? /login bounces to the app — nothing to do.
  if (!new URL(page.url()).pathname.startsWith('/login')) return;

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.fill('#email', creds.email);
    await page.fill('#password', creds.password);
    await page.click('button[type=submit]');
    try {
      // Accounts with MFA get a code challenge on the same page.
      const otp = page.locator("input[autocomplete='one-time-code'], input[data-input-otp]").last();
      const challenged = await otp.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
      if (challenged) {
        if (!creds.totpSecret) throw new Error('This account asks for an MFA code; set E2E_TOTP_SECRET.');
        // The server refuses a code that was already used (replay guard), and
        // parallel workers share one account; on refusal, use the next code.
        for (let step = 0; step < 3; step++) {
          await otp.pressSequentially(await totpCode(creds.totpSecret), { delay: 40 });
          const left = await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 8_000 })
            .then(() => true, () => false);
          if (left) return;
          await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
          await otp.fill('').catch(() => {});
        }
      }
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
export async function fillIsf10(page: Page, opts: { masterBol?: string; houseBol?: string; extraHouseBols?: string[] } = {}) {
  // Six steps and six trade parties: more than the default 45s.
  test.setTimeout(Math.max(test.info().timeout, 120_000));
  const next = () => page.getByRole('button', { name: /^Next/ }).click();

  // Step 1 — Filing Info
  await page.getByLabel(/Master Bill of Lading/i).fill(opts.masterBol ?? 'MAEU1234567890');
  await page.getByLabel(/House Bill of Lading/i).fill(opts.houseBol ?? 'HCLA12345678');
  // Consolidation: more house bills under the same master (one ISF each).
  for (const hbl of opts.extraHouseBols ?? []) {
    await page.getByRole('button', { name: /Add another house bill under this Master BOL/ }).click();
    await page.getByPlaceholder('e.g., HCLA12345679').last().fill(hbl);
  }
  await next();

  // Step 2 — IOR & Consignee
  await page.getByLabel(/Importer Name/i).first().fill('Acme Imports LLC');
  await page.getByLabel(/IOR Number/i).first().fill('20-493538700');
  await page.getByLabel(/Consignee Name/i).first().fill('Acme Distribution Inc');
  await page.getByLabel(/^Consignee Number/i).first().fill('20-493538700');
  await page.getByLabel(/Address Line 1/i).first().fill('100 Harbor Blvd');
  await page.getByLabel(/^City/i).first().fill('Long Beach');
  await page.getByRole('combobox', { name: /^Country/i }).first().click();
  await page.locator('[cmdk-input]').last().fill('United States');
  await page.getByRole('option', { name: /United States/i }).first().click();
  await next();

  // Step 3 — Trade Parties: every ISF-10 party needs a name and an address.
  await expect(page.getByText(/Trade Parties|Buyer|Seller/i).first()).toBeVisible();
  await fillEmptyParties(page);
  // Consolidation (buyer mode): seller and manufacturer are per house bill.
  const hblTabs = page.getByRole('tab', { name: /^HBL \d+:/ });
  for (let t = 0; t < await hblTabs.count(); t++) {
    await hblTabs.nth(t).click();
    const customize = page.getByRole('button', { name: 'Customize for this HBL' });
    while (await customize.count() > 0) {
      await customize.first().click();
      await fillEmptyParties(page);
    }
  }
  await next();

  // Step 4 — Transport
  await page.getByLabel(/SCAC Code/i).fill('MAEU');
  await page.getByLabel(/Vessel Name/i).fill('EVER GIVEN');
  await page.getByRole('combobox', { name: /US Port of Arrival/i }).click();
  await page.locator('[cmdk-input]').last().fill('Long Beach');
  await page.getByRole('option', { name: /Long Beach/i }).first().click();
  // Lading 30 days out, arrival 45 days out (ISF is filed before lading).
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  // The date inputs aren't tied to their labels (BUG-010), so go by order:
  // departure, lading, arrival.
  const dates = page.locator('input[type="date"]');
  await dates.nth(1).fill(day(30));
  await dates.nth(2).fill(day(45));
  await next();

  // Step 5 — Cargo: one commodity (HTS + country of origin)
  await page.getByPlaceholder('e.g., 731815').first().fill('847130');
  await page.getByRole('combobox', { name: /Country of Origin/i }).click();
  await page.getByPlaceholder(/Country, ISO code/i).fill('China');
  await page.getByRole('option').first().click();
  await next();
}

/** Fill every still-empty trade-party card (name, street, city, country). */
export async function fillEmptyParties(page: Page) {
  const names = page.getByPlaceholder('Letters, numbers, spaces, dashes only');
  for (let i = 0; i < await names.count(); i++) {
    const card = names.nth(i);
    if (await card.inputValue()) continue;
    await card.fill(`QA Party ${i + 1} Co`);
  }
  const streets = page.getByPlaceholder('Street address');
  for (let i = 0; i < await streets.count(); i++) {
    if (!(await streets.nth(i).inputValue())) await streets.nth(i).fill(`${100 + i} Harbor Rd`);
  }
  const cities = page.getByPlaceholder('City');
  for (let i = 0; i < await cities.count(); i++) {
    if (!(await cities.nth(i).inputValue())) await cities.nth(i).fill('Shanghai');
  }
  const countries = page.getByRole('combobox', { name: /^Country/i });
  for (let i = 0; i < await countries.count(); i++) {
    const country = countries.nth(i);
    for (let tries = 0; tries < 2 && !/Chi|Uni|[A-Z]{2}/.test((await country.textContent()) ?? ''); tries++) {
      await country.click();
      await page.locator('[cmdk-input]').last().fill('China');
      await page.getByRole('option', { name: /China/i }).first().click();
      await expect(page.locator('[cmdk-input]')).toHaveCount(0);
    }
  }
}
