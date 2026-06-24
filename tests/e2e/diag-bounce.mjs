import { chromium } from '@playwright/test';
const BASE = 'http://localhost:8080';
const browser = await chromium.launch({ headless: true });

// Real-user scenario: log in ONCE, establish a settled session, then hard-reload
// repeatedly (like pressing browser refresh) and count logouts.
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
const refreshLog = [];
page.on('response', (r) => { if (r.url().includes('/auth/refresh')) refreshLog.push(r.status()); });

await page.goto('/login', { waitUntil: 'domcontentloaded' });
await page.fill('#email', 'demo@mycargolens.com');
await page.fill('#password', 'password123');
await page.click('button[type=submit]');
await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
await page.waitForTimeout(1500); // let cookie + session settle

const routes = ['/compliance', '/integrations/api', '/settings', '/shipments', '/'];
let bounced = 0, total = 0;
for (let i = 0; i < 15; i++) {
  const path = routes[i % routes.length];
  // establish we're on an app page via SPA nav (no reload)
  await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(400);
  refreshLog.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });   // hard reload = the real "press refresh"
  await page.waitForTimeout(2500);
  total++;
  const onLogin = page.url().includes('/login');
  if (onLogin) bounced++;
  console.log(`#${String(i).padStart(2)} reload ${path.padEnd(18)} refreshes=[${refreshLog.join(',')}] ${onLogin ? 'BOUNCED' : 'ok'}`);
}
console.log(`\nLogged out on ${bounced}/${total} hard reloads`);
await browser.close();
