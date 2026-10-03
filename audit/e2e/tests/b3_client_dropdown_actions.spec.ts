import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoActions } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';
import { pickFirstClientFromCombobox } from '../fixtures/page-objects.js';

test.describe('B3 — Client dropdown on action creation', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('B3_client_combobox_on_actions_tab', async ({ page }) => {
    await gotoActions(page);
    await page.getByRole('button', { name: /new action point/i }).click();
    const clientName = await pickFirstClientFromCombobox(page);
    const desc = `E2E_B3_${Date.now()}`;
    await page.getByPlaceholder('Action *').fill(desc);
    await page.getByRole('button', { name: /add action point/i }).click();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 15000 });
    if (clientName) {
      const row = page.locator('tr', { hasText: desc });
      await expect(row.getByText(clientName.slice(0, 20), { exact: false })).toBeVisible();
    }
  });
});
