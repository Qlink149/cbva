import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';

test.describe('B7 — Hidden admin/management columns', () => {
  test.beforeAll(() => beforeProdGuard());

  test('B7_leader_sees_columns_toggle', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('leader1') });
    const page = await ctx.newPage();
    await gotoEngagements(page);
    await expect(page.getByRole('button', { name: /columns/i })).toHaveCount(0);
    await ctx.close();
  });

  test('B7_admin_sees_columns_toggle', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('mgmt') });
    const page = await ctx.newPage();
    await gotoEngagements(page);
    await expect(page.getByRole('button', { name: /columns/i })).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });

  test('B7_admin_can_access_firmwide', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('admin') });
    const page = await ctx.newPage();
    await page.goto('/firmwide/consolidated');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/firmwide/);
    await ctx.close();
  });
});
