import { chromium } from '@playwright/test';
const BASE = 'http://localhost:8080';
const targets = ['/tracking', '/duty-calculator', '/integrations/api', '/integrations/logs', '/settings', '/compliance'];
const browser = await chromium.launch({ headless: true });

for (const path of targets) {
  let bounced = 0;
  const N = 4;
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const refreshes = [];
    page.on('response', (r) => { if (r.url().includes('/auth/refresh')) refreshes.push(r.status()); });
    // fresh login
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#email', 'demo@mycargolens.com');
    await page.fill('#password', 'password123');
    await page.click('button[type=submit]');
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(()=>{});
    // hard navigate to target (drops in-memory token -> relies on refresh)
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const onLogin = page.url().includes('/login');
    if (onLogin) bounced++;
    if (i === 0) console.log(`  ${path} run0 refresh statuses=[${refreshes.join(',')}] finalURL=${page.url().replace(BASE,'')}`);
    await ctx.close();
  }
  console.log(`${path}: bounced to /login ${bounced}/${N}`);
}
await browser.close();
