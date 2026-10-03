import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoActions, getToken, API_URL } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';
import { apiListEngagements, apiCreateAction } from '../fixtures/api.js';
import { pickFirstClientFromCombobox } from '../fixtures/page-objects.js';

const A5_FIXED = process.env.E2E_EXPECT_A5_FIXED === '1';

test.describe('A5 — Actions saving', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  let engagementId: string;

  test.beforeAll(async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const items = await apiListEngagements(token, 'manan', '2627');
    engagementId = items[0]?.id;
    expect(engagementId, 'Need at least one manan FY2627 engagement').toBeTruthy();
  });

  test('A5_action_with_deadline', async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const { status } = await apiCreateAction(token, {
      engagement_id: engagementId,
      leader_id: 'manan',
      fiscal_year: '2627',
      description: `E2E_A5_deadline_${Date.now()}`,
      deadline: '2026-09-16',
      status: 'Pending',
    });
    if (A5_FIXED) {
      expect(status).toBe(201);
    } else {
      expect([422, 500]).toContain(status);
    }
  });

  test('A5_action_without_deadline_saves', async ({ page }) => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const desc = `E2E_A5_no_deadline_${Date.now()}`;
    const { status } = await apiCreateAction(token, {
      engagement_id: engagementId,
      leader_id: 'manan',
      fiscal_year: '2627',
      description: desc,
      status: 'Pending',
    });
    expect(status).toBe(201);

    await gotoActions(page);
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByText(desc)).toBeVisible({ timeout: 10000 });
  });

  test('A5_ui_with_deadline', async ({ page }) => {
    const desc = `E2E_A5_ui_deadline_${Date.now()}`;
    await gotoActions(page);
    await page.getByRole('button', { name: /new action point/i }).click();
    await pickFirstClientFromCombobox(page);
    await page.getByPlaceholder('Action *').fill(desc);
    await page.locator('input[type="date"]').fill('2026-09-16');
    await page.getByRole('button', { name: /add action point/i }).click();
    await page.waitForTimeout(2000);
    const visible = await page.getByText(desc).isVisible().catch(() => false);
    if (A5_FIXED) {
      await expect(page.getByText(desc)).toBeVisible({ timeout: 10000 });
    } else {
      expect(visible).toBe(false);
    }
  });
});
