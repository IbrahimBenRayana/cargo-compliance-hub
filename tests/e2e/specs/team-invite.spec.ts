import { test, expect } from './fixtures';
import { gotoAuthed } from './helpers';

test.describe('Team invitations', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/team');
    await expect(page.getByRole('heading', { name: /team/i }).first()).toBeVisible();
  });

  // Default: exercise the invite UI WITHOUT sending — sending an invite triggers
  // a real ACS email (EMAIL_* configured in server/.env). We open the dialog,
  // verify its controls, then cancel.
  test('invite dialog exposes email + role + send controls', async ({ page }) => {
    await page.getByRole('button', { name: /Invite Member/i }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /Invite Team Member/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#invite-email')).toBeVisible();
    await expect(dialog.getByText(/Role/i).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Send Invitation/i })).toBeVisible();
    await dialog.locator('#invite-email').fill('colleague@example.com');
    await dialog.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(dialog).toBeHidden();
  });

  // OPT-IN ONLY — actually sends an invitation (ACS email + DB OrgInvitation).
  // The address is example.com (reserved, undeliverable). Cleans up by revoking.
  //   RUN_INVITE_SEND=1 npx playwright test --config tests/e2e/playwright.e2e.config.ts -g "sends an invitation"
  test('sends an invitation and shows it as pending', async ({ page }) => {
    test.skip(process.env.RUN_INVITE_SEND !== '1', 'Sends a real ACS email — set RUN_INVITE_SEND=1 to run');

    const email = `e2e-invite-${Date.now()}@example.com`;
    await page.getByRole('button', { name: /Invite Member/i }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /Invite Team Member/i });
    await dialog.locator('#invite-email').fill(email);
    await dialog.getByRole('button', { name: /Send Invitation/i }).click();

    await expect(page.getByText(/Invitation sent/i)).toBeVisible({ timeout: 15000 });
    const row = page.getByText(email);
    await expect(row).toBeVisible();

    // Clean up — revoke the invitation we just created.
    const inviteRow = page.locator('tr, div').filter({ hasText: email }).filter({ has: page.getByRole('button', { name: /Revoke/i }) }).last();
    await inviteRow.getByRole('button', { name: /Revoke/i }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Revoke/i }).click();
  });
});
