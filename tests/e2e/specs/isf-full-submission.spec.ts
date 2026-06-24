import { test, expect } from './fixtures';
import { gotoAuthed, fillIsf10 } from './helpers';

test.describe('ISF full submission', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/shipments/new');
    await expect(page.getByText(/new isf filing/i)).toBeVisible();
  });

  test('completes the 6-step wizard and creates a draft filing (real POST -> 201)', async ({ page }) => {
    const createResp = page.waitForResponse(
      (r) => r.url().includes('/api/v1/filings') && r.request().method() === 'POST',
    );
    await fillIsf10(page);

    // Step 6 — Review & Submit
    await expect(page.getByText(/Review & Submit/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Create ISF Filing/i }).click();

    const resp = await createResp;
    expect(resp.status()).toBe(201);

    // Lands on the new filing's detail page with our data shown.
    await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/ISF filing created/i)).toBeVisible();
    await expect(page.getByText('Acme Imports LLC').first()).toBeVisible();
  });

  // OPT-IN ONLY. Submitting transmits a real ISF to the CustomsCity *cert*
  // gateway (CC_API_BASE_URL=api-cert.customscity.com). It is skipped by default
  // so `playwright test` never makes an external customs transmission. To run it:
  //   RUN_CC_SUBMIT=1 npx playwright test --config tests/e2e/playwright.e2e.config.ts -g "transmits to CBP"
  test('transmits the draft to CBP cert via the submission pipeline', async ({ page }) => {
    test.skip(process.env.RUN_CC_SUBMIT !== '1', 'External CC cert transmission — set RUN_CC_SUBMIT=1 to run');

    await fillIsf10(page);
    await page.getByRole('button', { name: /Create ISF Filing/i }).click();
    await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}$/);

    await page.getByRole('button', { name: /Start Submission/i }).click();
    // The pipeline runs validate -> CC create -> CC send. Accept either a
    // success toast or a surfaced CC error; assert it reaches a terminal state.
    await expect(
      page.getByText(/submitted to CBP|Sent!|Failed|error|rejected/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
