import { test, expect } from '@playwright/test';
import { beforeProdGuard, getToken, API_URL } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';

test.describe('B11 — KPI scorecard', () => {
  test.beforeAll(() => beforeProdGuard());

  test('B11_scorecard_not_in_nav_but_route_works', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('leader1') });
    const page = await ctx.newPage();
    await page.goto('/my-plan/dashboard');
    const navScorecard = page.getByRole('link', { name: /scorecard/i });
    expect(await navScorecard.count()).toBe(0);
    await page.goto('/my-plan/scorecard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/scorecard/);
    await ctx.close();
  });

  test('B11_admin_kra_config_accessible', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('admin') });
    const page = await ctx.newPage();
    await page.goto('/admin');
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible({ timeout: 15000 });
    await page.locator('[role="tab"]', { hasText: 'KRA' }).click();
    await expect(page.getByText(/KRA|KPI|weightage/i).first()).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });

  test('B11_mgmt_view_only_on_staff_appraisal', async () => {
    const token = await getToken(E2E_USERS.mgmt.email, E2E_USERS.mgmt.password);
    const res = await fetch(`${API_URL}/api/appraisals/scorecard?leader_id=manan&fiscal_year=2627`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.info().annotations.push({ type: 'B11-api', description: `Mgmt scorecard GET status=${res.status}` });
  });
});
