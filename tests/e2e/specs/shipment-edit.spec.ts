import { test, expect } from './fixtures';
import { gotoAuthed, fillIsf10 } from './helpers';

test.describe('Shipment edit', () => {
  test('edit a draft filing and save the change (real PATCH)', async ({ page }) => {
    // Create a fresh draft to edit (keeps the test self-contained).
    await gotoAuthed(page, '/shipments/new');
    await fillIsf10(page);
    await page.getByRole('button', { name: /Create ISF Filing/i }).click();
    await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}$/);
    const id = new URL(page.url()).pathname.split('/').pop()!;

    // Open the wizard in edit mode; fields hydrate from the saved draft.
    await gotoAuthed(page, `/shipments/${id}/edit`);
    await expect(page.getByText(/Edit ISF Filing/i)).toBeVisible();
    await expect(page.getByLabel(/Master Bill of Lading/i)).toHaveValue('MAEU1234567890');

    // Walk to the Transport step and change the vessel name.
    const next = () => page.getByRole('button', { name: /^Next/ }).click();
    await next(); // -> IOR & Consignee
    await next(); // -> Trade Parties
    await next(); // -> Transport
    const vessel = page.getByLabel(/Vessel Name/i);
    await expect(vessel).toHaveValue('EVER GIVEN');
    await vessel.fill('MAERSK DETROIT');

    // Continue to Review and save.
    await next(); // -> Cargo
    await next(); // -> Review & Submit
    const patch = page.waitForResponse(
      (r) => r.url().includes(`/api/v1/filings/${id}`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: /Save Changes/i }).click();
    expect((await patch).status()).toBeLessThan(300);

    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/shipments/${id}$`));
    await expect(page.getByText('MAERSK DETROIT').first()).toBeVisible();
  });
});
