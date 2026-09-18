import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';

const EXPECTED = ['Signed', 'Not Signed', 'Waived', 'Waiver Requested', 'NA'];
const FORBIDDEN = ['DS', 'BS', '-', 'Waved'];

test.describe('B1 — Engagement status categories', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('B1_add_modal_el_status_options', async ({ page }) => {
    await gotoEngagements(page);
    await page.getByRole('button', { name: /add engagement/i }).click();
    const select = page.locator('label:has-text("EL Status")').locator('..').locator('select');
    const options = await select.locator('option').allTextContents();
    for (const exp of EXPECTED) {
      expect(options).toContain(exp);
    }
    for (const bad of FORBIDDEN) {
      expect(options).not.toContain(bad);
    }
    await page.getByRole('button', { name: /cancel/i }).click();
  });
});
