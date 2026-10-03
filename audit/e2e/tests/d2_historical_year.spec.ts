import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';

test.describe('D2 — Historical-year representation', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('mgmt') });

  test('D2_fy2526_layout_for_leaders', async ({ page }) => {
    await gotoEngagements(page);
    const fySelect = page.locator('select').filter({ has: page.locator('option[value="2526"]') }).first();
    if (await fySelect.isVisible()) {
      await fySelect.selectOption('2526');
      await page.waitForLoadState('networkidle');
    }
    const leaderSelect = page.locator('select').first();
    const leaders = ['manan', 'varun'];
    for (const lid of leaders) {
      if (await leaderSelect.isVisible()) {
        try {
          await leaderSelect.selectOption(lid);
          await page.waitForTimeout(800);
        } catch {
          // option may use name not id
        }
      }
      const emptyMsg = page.getByText(/historical|read.only|no client rows|annual/i);
      test.info().annotations.push({
        type: 'D2-leader',
        description: `${lid}: empty/historical msg visible=${await emptyMsg.isVisible().catch(() => false)}`,
      });
    }
    const fy2425 = page.locator('option[value="2425"]');
    expect(await fy2425.count()).toBe(0);
    test.info().annotations.push({
      type: 'D2-client-question',
      description: 'FY2425 not in financial_years — should it be selectable?',
    });
  });
});
