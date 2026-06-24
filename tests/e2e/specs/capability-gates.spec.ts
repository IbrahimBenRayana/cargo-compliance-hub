import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

// The demo org is on the ISF-only tier, so premium capabilities render an
// upgrade gate instead of the feature. These tests assert the gate shows —
// flip them once the demo org is granted the capability.
const GATED = [
  { name: 'Container Tracking', path: '/tracking',       gate: /upgrade to unlock container tracking/i },
  { name: 'HTS / Duty',         path: '/duty-calculator',gate: /upgrade to unlock hts classification/i },
  { name: 'ABI Entry',          path: '/abi-documents',  gate: /upgrade to unlock abi entry/i },
];

test.describe('Capability gates (ISF-only demo tier)', () => {

  for (const g of GATED) {
    test(`${g.name} shows an upgrade gate`, async ({ page }) => {
      await gotoAuthed(page, g.path);
      await expect(page.getByText(g.gate).first()).toBeVisible({ timeout: 15000 });
      await expect(page).not.toHaveURL(/\/login/);
    });
  }

  test('ABI gate offers an upgrade call-to-action', async ({ page }) => {
    await gotoAuthed(page, '/abi-documents');
    // CTA is a link styled as a button: "Upgrade to ISF + Entry"
    await expect(page.getByRole('link', { name: /upgrade to isf \+ entry/i })).toBeVisible();
  });

  test('gated features are hidden from the left nav', async ({ page }) => {
    await gotoAuthed(page, '/');
    await expect(page.getByRole('link', { name: /duty calculator/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^tracking$/i })).toHaveCount(0);
  });
});
