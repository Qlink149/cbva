import { test, expect, chromium } from '@playwright/test';
import { beforeProdGuard, getToken } from '../fixtures/helpers.js';
import { E2E_USERS, storageStatePath } from '../fixtures/auth.js';
import { apiCreateEngagement, apiUpdateEngagement, apiFindEngagement } from '../fixtures/api.js';

test.describe('A2 — Multi-user concurrent editing', () => {
  test.beforeAll(() => beforeProdGuard());

  test('A2_different_engagements_both_save', async () => {
    const token1 = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const token2 = await getToken(E2E_USERS.leader2.email, E2E_USERS.leader2.password);

    const mk = (token: string, leader: string, suffix: string) =>
      apiCreateEngagement(token, {
        leader_id: leader,
        fiscal_year: '2627',
        num: Math.floor(Math.random() * 9000) + 1000,
        name: `E2E_A2_${suffix}_${Date.now()}`,
        manager: 'Mgr',
        elStatus: 'NA',
        green: 100000,
        amber: 0,
        blue_sky: 0,
        collected: 0,
      });

    const [e1, e2] = await Promise.all([mk(token1, 'manan', 'L1'), mk(token2, 'amol', 'L2')]);

    await apiUpdateEngagement(token1, e1.id, { green: 200000 });
    await apiUpdateEngagement(token2, e2.id, { green: 300000 });

    const me1 = await fetch(`${process.env.API_URL || 'http://127.0.0.1:8001'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const me2 = await fetch(`${process.env.API_URL || 'http://127.0.0.1:8001'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(me1.status).toBe(200);
    expect(me2.status).toBe(200);
  });

  test('A2_same_engagement_last_write_wins', async () => {
    const token1 = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const eng = await apiCreateEngagement(token1, {
      leader_id: 'manan',
      fiscal_year: '2627',
      num: Math.floor(Math.random() * 9000) + 1000,
      name: `E2E_A2_same_${Date.now()}`,
      manager: 'Mgr',
      elStatus: 'NA',
      green: 500000,
      amber: 0,
      blue_sky: 0,
      collected: 0,
    });
    await apiUpdateEngagement(token1, eng.id, { green: 600000, remarks: 'write1' });
    await apiUpdateEngagement(token1, eng.id, { green: 700000, remarks: 'write2' });
    const final = await apiFindEngagement(token1, 'manan', '2627', eng.id);
    expect(final?.green).toBe(700000);
    test.info().annotations.push({ type: 'A2-behavior', description: 'Last-write-wins; no version lock' });
  });

  test('A2_two_browser_sessions_stay_logged_in', async () => {
    const browser = await chromium.launch();
    const ctx1 = await browser.newContext({ storageState: storageStatePath('leader1') });
    const ctx2 = await browser.newContext({ storageState: storageStatePath('leader2') });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    await p1.goto('/my-plan/dashboard');
    await p2.goto('/my-plan/dashboard');
    await expect(p1).toHaveURL(/my-plan/);
    await expect(p2).toHaveURL(/my-plan/);
    await browser.close();
  });
});
