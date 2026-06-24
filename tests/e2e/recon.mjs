// Reconnaissance walk: log in once, visit every route, capture screenshot,
// console errors, page heading + visible text snippet. Writes recon-report.json.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:8080';
const CREDS = { email: 'demo@mycargolens.com', password: 'password123' };

const ROUTES = [
  ['dashboard', '/'],
  ['shipments-list', '/shipments'],
  ['shipments-new', '/shipments/new'],
  ['compliance', '/compliance'],
  ['tracking', '/tracking'],
  ['manifest-query', '/manifest-query'],
  ['duty-calculator', '/duty-calculator'],
  ['abi-documents', '/abi-documents'],
  ['abi-documents-new', '/abi-documents/new'],
  ['integrations-api', '/integrations/api'],
  ['integrations-logs', '/integrations/logs'],
  ['settings', '/settings'],
  ['team', '/team'],
  ['admin', '/admin'],
];

const report = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

async function snap(name, path, note) {
  errors.length = 0;
  const t0 = Date.now();
  let status = 'ok';
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    status = 'goto-timeout';
  }
  await page.waitForTimeout(800);
  const url = page.url();
  const title = await page.title().catch(() => '');
  const h1 = await page.locator('h1, h2').first().textContent({ timeout: 2000 }).catch(() => '(none)');
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 280).replace(/\s+/g, ' ');
  await page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: true }).catch(() => {});
  report.push({ name, path, landedUrl: url, status, ms: Date.now() - t0, title, heading: (h1 || '').trim(), consoleErrors: [...errors], bodyText, note });
  console.log(`[${status}] ${name.padEnd(20)} -> ${url.replace(BASE, '')}  | ${(h1 || '').trim().slice(0, 40)}  | errs:${errors.length}`);
}

// --- Unauthenticated: login page + protected redirect ---
await snap('login-page', '/login');
await snap('protected-redirect', '/shipments', 'expect redirect to /login when logged out');

// --- Log in via UI ---
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#email', CREDS.email);
await page.fill('#password', CREDS.password);
await page.click('button[type=submit]');
let loginOk = false;
try {
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  loginOk = true;
} catch { /* stays on login */ }
await page.waitForTimeout(1500);
await page.screenshot({ path: 'tests/e2e/screenshots/after-login.png', fullPage: true });
console.log('LOGIN ->', loginOk ? 'SUCCESS landed on ' + page.url() : 'FAILED still on ' + page.url());
report.push({ name: 'login-attempt', loginOk, landedUrl: page.url(), consoleErrors: [...errors] });

// save storage state for the test suite to reuse
await ctx.storageState({ path: 'tests/e2e/.auth-state.json' });

// --- Authenticated walk ---
if (loginOk) {
  for (const [name, path] of ROUTES) await snap(name, path);
}

writeFileSync('tests/e2e/recon-report.json', JSON.stringify(report, null, 2));
console.log('\nWrote tests/e2e/recon-report.json');
await browser.close();
