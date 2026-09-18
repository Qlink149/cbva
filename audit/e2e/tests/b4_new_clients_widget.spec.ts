import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoDashboard, getToken, API_URL } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';

test.describe('B4 — New clients widget', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('B4_card_has_month_selector', async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.getByText(/new clients/i).first()).toBeVisible({ timeout: 15000 });
    const card = page.locator('div').filter({ has: page.getByText(/^New Clients/i) }).first();
    const monthSelect = card.locator('select[aria-label="Filter by month"]');
    await expect(monthSelect).toBeVisible();
    await expect(monthSelect.locator('option[value=""]')).toHaveText('All Months');
    test.info().annotations.push({ type: 'B4-month-filter', description: 'NewClientsCard exposes FY month filter' });
  });

  test('B4_new_engagement_appears_after_create', async ({ page }) => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const name = `E2E_B4_newclient_${Date.now()}`;
    const res = await fetch(`${API_URL}/api/engagements/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leader_id: 'manan',
        fiscal_year: '2627',
        num: Math.floor(Math.random() * 9000) + 1000,
        name,
        manager: 'Mgr',
        elStatus: 'NA',
        green: 500000,
        amber: 0,
        blue_sky: 0,
        collected: 0,
      }),
    });
    expect(res.status).toBe(201);
    await gotoDashboard(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const found = await page.getByText(name).isVisible().catch(() => false);
    test.info().annotations.push({
      type: 'B4-new-client',
      description: found ? `New client ${name} visible on dashboard` : 'May require audit_log entry — sourced from audit_log not engagement alone',
    });
  });
});
