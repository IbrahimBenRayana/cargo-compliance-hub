import { test as base, expect, BrowserContext, Page } from '@playwright/test';
import { login } from './helpers';

const BASE = 'http://localhost:8080';

// The login endpoint is rate-limited to 10 requests/min/IP, and refresh tokens
// rotate single-use — so logging in per-test is both throttled and fragile.
// Instead we log in ONCE per worker and share one authenticated page across all
// navigation tests. `auth.spec.ts` keeps its own fresh contexts (it tests login
// itself) and must NOT import this fixture.
type WorkerFixtures = { sharedCtx: BrowserContext };

export const test = base.extend<{}, WorkerFixtures>({
  sharedCtx: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await login(page); // exactly one login per worker
      (context as unknown as { _mclPage: Page })._mclPage = page;
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  // Override the built-in page with the shared, already-authenticated one.
  page: async ({ sharedCtx }, use) => {
    await use((sharedCtx as unknown as { _mclPage: Page })._mclPage);
  },
});

export { expect };
