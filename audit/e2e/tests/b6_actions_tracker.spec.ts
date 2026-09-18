import { test, expect } from '@playwright/test';

import { beforeProdGuard, gotoActions, getToken, API_URL } from '../fixtures/helpers.js';

import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';



const STATUSES = ['Completed', 'In Progress', 'Pending', 'Abandoned'];



test.describe('B6 — Actions tracker Status + Remarks', () => {

  test.beforeAll(() => beforeProdGuard());

  test.use({ storageState: storageStatePath('leader1') });



  test('B6_four_statuses_and_remarks_column', async ({ page }) => {

    await gotoActions(page);

    const statusFilter = page.locator('select[aria-label="Filter by status"]');

    await expect(statusFilter).toBeVisible({ timeout: 15000 });

    const options = await statusFilter.locator('option').allTextContents();

    for (const s of STATUSES) {

      expect(options.some((o) => o.includes(s))).toBeTruthy();

    }

    await expect(page.getByRole('columnheader', { name: 'Remarks' })).toBeVisible();

  });



  test('B6_filter_pending_only', async ({ page }) => {

    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);

    const engRes = await fetch(`${API_URL}/api/engagements/?leader_id=manan&fiscal_year=2627&limit=1`, {

      headers: { Authorization: `Bearer ${token}` },

    });

    const eng = (await engRes.json());

    const items = Array.isArray(eng) ? eng : eng.data || eng.items || [];

    const desc = `E2E_B6_pending_${Date.now()}`;

    await fetch(`${API_URL}/api/engagement-actions/`, {

      method: 'POST',

      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },

      body: JSON.stringify({

        engagement_id: items[0]?.id,

        leader_id: 'manan',

        fiscal_year: '2627',

        description: desc,

        status: 'Pending',

        remarks: 'E2E remark line',

      }),

    });

    await gotoActions(page);

    await page.locator('select[aria-label="Filter by status"]').selectOption('Pending');

    await expect(page.getByText(desc)).toBeVisible();

  });



  test('B6_engagement_point_and_month_filters_present', async ({ page }) => {

    await gotoActions(page);

    await expect(page.locator('select[aria-label="Filter by engagement point"]')).toBeVisible();

    await expect(page.locator('select[aria-label="Filter by month"]')).toBeVisible();

  });

});


