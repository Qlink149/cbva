import { test, expect } from '@playwright/test';
import { beforeProdGuard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';

test.describe('B9 — Collection tab comparative view', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('B9_yoy_table_visible_on_fy2627', async ({ page }) => {
    await page.goto('/my-plan/collections');
    await page.waitForLoadState('networkidle');

    const fySelect = page.locator('select[aria-label="Fiscal year"]');
    if (await fySelect.isVisible()) {
      await fySelect.selectOption('2627');
      await page.waitForLoadState('networkidle');
    }

    const yoyTable = page.getByLabel('Year-on-year collections');
    await expect(yoyTable).toBeVisible({ timeout: 15000 });
    await expect(yoyTable.getByText(/year-on-year collections/i)).toBeVisible();
    await expect(yoyTable.locator('th').filter({ hasText: /25.*26/i }).first()).toBeVisible();
    await expect(yoyTable.locator('th').filter({ hasText: /26.*27/i }).first()).toBeVisible();
    await expect(yoyTable.getByText('YTD')).toBeVisible();
    test.info().annotations.push({
      type: 'B9-yoy',
      description: 'FY2627 collections page shows prior-year vs current-year month table',
    });
  });
});
