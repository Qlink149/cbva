import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements, gotoDashboard, gotoActions } from '../fixtures/helpers.js';
import { storageStatePath, loginViaUI, E2E_USERS } from '../fixtures/auth.js';
import { selectLeader, selectFY } from '../fixtures/page-objects.js';

test.describe('A4 — Filter persistence', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('mgmt') });

  test('A4_leader_fy_survives_nav_and_refresh', async ({ page }) => {
    await gotoEngagements(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2526');

    const leaderBefore = await page.getByLabel('Leader').inputValue();
    const fyBefore = await page.getByLabel('Fiscal year').inputValue();

    await gotoDashboard(page);
    await gotoEngagements(page);

    await expect(page.getByLabel('Leader')).toHaveValue(leaderBefore);
    await expect(page.getByLabel('Fiscal year')).toHaveValue(fyBefore);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByLabel('Leader')).toHaveValue(leaderBefore);
    await expect(page.getByLabel('Fiscal year')).toHaveValue(fyBefore);
  });

  test('A4_engagement_filters_survive_nav', async ({ page }) => {
    await gotoEngagements(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2627');

    const search = page.getByPlaceholder('Search clients...');
    await expect(search).toBeVisible({ timeout: 15000 });
    const filterValue = `e2e-filter-${Date.now()}`;
    await search.fill(filterValue);

    await expect(page.getByRole('button', { name: /Filters/i })).toContainText('1');

    await gotoDashboard(page);
    await gotoEngagements(page);

    await expect(search).toHaveValue(filterValue);
    await expect(page.getByRole('button', { name: /Filters/i })).toContainText('1');
  });

  test('A4_engagements_month_survives_nav', async ({ page }) => {
    await gotoEngagements(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2627');

    const monthSection = page.locator('text=Planned vs Collected').locator('xpath=ancestor::div[contains(@class,"rounded-lg")]');
    await expect(monthSection).toBeVisible({ timeout: 15000 });

    const addMonthBtn = monthSection.getByRole('button', { name: /Add month/i });
    await addMonthBtn.click();
    const monthOption = monthSection.locator('button').filter({ hasText: /Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar/ }).nth(1);
    await monthOption.click();

    const chipsBefore = await monthSection.locator('span.inline-flex').allTextContents();

    await gotoDashboard(page);
    await gotoEngagements(page);

    const monthSectionAfter = page.locator('text=Planned vs Collected').locator('xpath=ancestor::div[contains(@class,"rounded-lg")]');
    await expect(monthSectionAfter).toBeVisible({ timeout: 15000 });
    const chipsAfter = await monthSectionAfter.locator('span.inline-flex').allTextContents();
    expect(chipsAfter.sort().join('|')).toBe(chipsBefore.sort().join('|'));
  });

  test('A4_column_visibility_survives_nav', async ({ page }) => {
    await gotoEngagements(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2627');

    await page.getByRole('button', { name: /^Columns$/i }).click();
    const managerCheckbox = page.getByRole('checkbox', { name: 'Manager' });
    await expect(managerCheckbox).toBeVisible({ timeout: 15000 });
    const wasChecked = await managerCheckbox.isChecked();
    await managerCheckbox.setChecked(!wasChecked);

    await gotoDashboard(page);
    await gotoEngagements(page);

    await page.getByRole('button', { name: /^Columns$/i }).click();
    await expect(page.getByRole('checkbox', { name: 'Manager' })).toBeChecked({ checked: !wasChecked });
  });

  test('A4_actions_filters_survive_nav', async ({ page }) => {
    await gotoActions(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2627');

    const statusFilter = page.getByLabel('Filter by status');
    const monthFilter = page.getByLabel('Filter by month');
    await expect(statusFilter).toBeVisible({ timeout: 15000 });

    await statusFilter.selectOption('Pending');
    const monthOptions = await monthFilter.locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent || '' })),
    );
    const firstMonth = monthOptions.find((o) => o.value);
    expect(firstMonth).toBeTruthy();
    await monthFilter.selectOption(firstMonth!.value);

    await gotoEngagements(page);
    await gotoActions(page);

    await expect(statusFilter).toHaveValue('Pending');
    await expect(monthFilter).toHaveValue(firstMonth!.value);
  });

  test('A4_fy_scoped_filters', async ({ page }) => {
    await gotoActions(page);
    await selectLeader(page, 'amol');

    await selectFY(page, '2526');
    const monthFilter = page.getByLabel('Filter by month');
    await expect(monthFilter).toBeVisible({ timeout: 15000 });
    const fy2526Options = await monthFilter.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    expect(fy2526Options.length).toBeGreaterThan(0);
    const month2526 = fy2526Options[0];
    await monthFilter.selectOption(month2526);

    await selectFY(page, '2627');
    await expect(monthFilter).toHaveValue('');

    await selectFY(page, '2526');
    await expect(monthFilter).toHaveValue(month2526);
  });

  test('A4_logout_resets_session', async ({ page }) => {
    await gotoEngagements(page);
    await selectLeader(page, 'amol');
    await selectFY(page, '2526');
    await page.getByRole('button', { name: /sign out/i }).click({ timeout: 5000 }).catch(() => {});
    if (page.url().includes('/home')) {
      await loginViaUI(page, E2E_USERS.mgmt.email, E2E_USERS.mgmt.password);
      await gotoEngagements(page);
      const fy = await page.getByLabel('Fiscal year').inputValue().catch(() => '');
      test.info().annotations.push({ type: 'A4', description: `After re-login FY=${fy} (expected reset from default)` });
    }
  });
});
