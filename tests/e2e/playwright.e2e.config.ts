import { defineConfig, devices } from '@playwright/test';

// Standalone E2E config for MyCargoLens. Assumes the dev stack is already
// running (frontend :8080, backend :3001). Start it with:  ./dev-start.sh
//
// Run:   npx playwright test --config tests/e2e/playwright.e2e.config.ts
// Report: npx playwright show-report tests/e2e/report
//
// Serial (workers: 1) on purpose: the demo user has ONE refresh-token column
// and tokens rotate single-use, so parallel logins would invalidate each other.
export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
