import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoDashboard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';

test.describe('B2 — Amit Shah in leader dropdown', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('biu') });

  test('B2_biu_user_sees_readonly_leader_label', async ({ page }) => {
    await gotoDashboard(page);
    const leaderLabel = page.getByLabel('Leader');
    await expect(leaderLabel).toBeVisible({ timeout: 15000 });
    await expect(leaderLabel).toContainText(/Amit/i);
    await expect(page.locator('select[aria-label="Leader"]')).toHaveCount(0);
    test.info().annotations.push({
      type: 'B2-displayed',
      description: 'User role sees read-only leader label with full name, not a multi-option dropdown',
    });
  });
});
