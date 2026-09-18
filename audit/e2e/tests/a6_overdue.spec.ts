import { test, expect } from '@playwright/test';
import { beforeProdGuard, getToken, gotoActions } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';
import { apiListEngagements, apiCreateAction } from '../fixtures/api.js';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.describe('A6 — Overdue calculation', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader1') });

  let engagementId: string;
  const seeded: Record<string, string> = {};

  test.beforeAll(async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const items = await apiListEngagements(token, 'manan', '2627');
    engagementId = items[0]?.id;
    expect(engagementId, 'Need at least one manan FY2627 engagement').toBeTruthy();

    const cases = [
      { key: 'yesterday', offset: -1, expectOverdue: true },
      { key: 'today', offset: 0, expectOverdue: false },
      { key: 'tomorrow', offset: 1, expectOverdue: false },
    ];
    for (const c of cases) {
      const desc = `E2E_A6_${c.key}_${Date.now()}`;
      const { status } = await apiCreateAction(token, {
        engagement_id: engagementId,
        leader_id: 'manan',
        fiscal_year: '2627',
        description: desc,
        deadline: isoDate(c.offset),
        status: 'Pending',
      });
      expect(status).toBe(201);
      seeded[c.key] = desc;
    }
  });

  test('A6_overdue_badge_only_on_past_deadlines', async ({ page }) => {
    await gotoActions(page);
    await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();

    const yesterdayRow = page.locator('tr', { hasText: seeded.yesterday });
    await expect(yesterdayRow.getByText('(Overdue)')).toBeVisible({ timeout: 10000 });

    const todayRow = page.locator('tr', { hasText: seeded.today });
    await expect(todayRow.getByText('(Overdue)')).toHaveCount(0);

    const tomorrowRow = page.locator('tr', { hasText: seeded.tomorrow });
    await expect(tomorrowRow.getByText('(Overdue)')).toHaveCount(0);
  });

  test('A6_timezone_annotation', async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    test.info().annotations.push({
      type: 'A6-timezone',
      description: `Browser TZ: ${tz} — overdue uses IST calendar dates`,
    });
  });
});
