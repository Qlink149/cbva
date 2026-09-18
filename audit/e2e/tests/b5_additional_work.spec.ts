import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoDashboard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';
import { fillAdditionalWork } from '../fixtures/page-objects.js';

test.describe('B5 — Additional work manual table', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('B5_create_additional_work_entry', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.locator('text=Separate from Blue Sky Additional')).toBeVisible({ timeout: 15000 });
    const clientName = `E2E_B5_${Date.now()}`;
    await fillAdditionalWork(page, { client: clientName, amount: '500000' });
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 10000 });
  });
});
