import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements, gotoDashboard, getToken } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';
import { apiCreateEngagement, apiListEngagements } from '../fixtures/api.js';

test.describe('A1 — Amount magnitude corruption', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  test('A1_modal_18_lakh_nikhil_case_tab_roundtrip', async ({ page }) => {
    test.setTimeout(60000);
    const clientName = `E2E_A1_Nikhil_${Date.now()}`;
    await gotoEngagements(page);
    await page.getByRole('button', { name: /add engagement/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Engagement' })).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder(/Tata Consultancy/i).fill(clientName);
    await page.locator('label:has-text("Green")').locator('..').locator('input').fill('18');
    await page.getByRole('button', { name: /save engagement/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Engagement' })).not.toBeVisible({ timeout: 15000 });

    await gotoDashboard(page);
    await gotoEngagements(page);

    await page.getByPlaceholder(/search|filter/i).first().fill(clientName).catch(() => {});
    const row = page.locator('tr', { hasText: clientName });
    await expect(row).toBeVisible({ timeout: 20000 });
    const text = await row.textContent() || '';
    expect(text).not.toMatch(/1\.8K/i);
    expect(text).toMatch(/18|1,800,000|1800000|18\.0\s*L/i);
  });

  test('A1_modal_comma_in_lakh_field_corrupts', async ({ page }) => {
    await gotoEngagements(page);
    await page.getByRole('button', { name: /add engagement/i }).click();
    await page.getByPlaceholder(/Tata Consultancy/i).fill(`E2E_A1_comma_${Date.now()}`);
    await page.locator('label:has-text("Green")').locator('..').locator('input').fill('18,00,000');
    const preview = page.locator('text=Preview total');
    await expect(preview).toBeVisible();
    const previewText = await preview.textContent();
    expect(previewText).toContain('18,00,000');
    expect(previewText).not.toMatch(/\d+\s*Cr/);
    await page.getByRole('button', { name: /cancel/i }).click();
  });

  test('A1_api_roundtrip_1800000', async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const created = await apiCreateEngagement(token, {
      leader_id: 'manan',
      fiscal_year: '2627',
      num: 9999,
      name: `E2E_A1_api_${Date.now()}`,
      manager: 'Test',
      elStatus: 'NA',
      green: 1800000,
      amber: 0,
      blue_sky: 0,
      collected: 0,
    });
    expect(created.green).toBe(1800000);
    const list = await apiListEngagements(token, 'manan', '2627');
    const found = list.find((e) => e.id === created.id);
    expect(found?.green).toBe(1800000);
  });
});
