// Session lifecycle in the browser: an expired/invalid access token is refreshed silently (no logout, no error),
// and Sign out revokes the refresh token and returns to the login page. Runs last (file name).
import { test, expect } from '@playwright/test';
import { API, installCspCollector, monitor, settle, storagePath } from './helpers.mjs';

test.describe('session as leader_a', () => {
  test.use({ storageState: storagePath('leader_a') });

  test('forced access-token expiry -> silent refresh, page keeps working', async ({ page, context }) => {
    await installCspCollector(context);
    const m = monitor(page);
    await page.goto('/my-plan/engagements');
    await settle(page);
    const before = await page.evaluate(() => [localStorage.getItem('access_token'), localStorage.getItem('refresh_token')]);
    // Force expiry: a token the server cannot accept (equivalent to an expired one: 401 "Invalid or expired token")
    await page.evaluate(() => localStorage.setItem('access_token', 'expired.e2e.token'));
    const refreshed = page.waitForResponse((r) => r.url() === `${API}/api/auth/refresh`);
    await page.goto('/my-plan/actions');
    expect((await refreshed).status()).toBe(200);
    await settle(page);
    await expect(page).toHaveURL(/\/my-plan\/actions$/);              // not bounced to /home
    await expect(page.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
    const after = await page.evaluate(() => [localStorage.getItem('access_token'), localStorage.getItem('refresh_token')]);
    expect(after[0]).not.toBe('expired.e2e.token');
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);                               // refresh token rotated
    expect(m.apiCalls.some((c) => / 401$/.test(c)), m.apiCalls.join(' | ')).toBeTruthy();   // the 401 really happened
    await m.assertClean('silent refresh');
    await context.storageState({ path: storagePath('leader_a') });
  });

  test('sign out revokes the session and returns to the login page', async ({ page, context, request }) => {
    await installCspCollector(context);
    const m = monitor(page);
    await page.goto('/');
    await settle(page);
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    const logout = page.waitForResponse((r) => r.url() === `${API}/api/auth/logout`);
    await page.getByRole('button', { name: 'Sign out' }).click();
    expect((await logout).status()).toBe(204);
    await expect(page).toHaveURL(/\/home$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
    const replay = await request.post(`${API}/api/auth/refresh`, { data: { refresh_token: refreshToken } });
    expect(replay.status()).toBe(401);                                  // revoked server-side
    await page.goto('/my-plan/engagements');
    await expect(page).toHaveURL(/\/home$/);                            // protected routes need a login again
    await m.assertClean('logout');
  });
});
