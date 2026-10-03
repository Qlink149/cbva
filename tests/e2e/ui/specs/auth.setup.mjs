// One real login per role through the login form; the session is saved and reused by the other specs.
import { test as setup, expect } from '@playwright/test';
import { API, ROLES, STATE, monitor, paceLogin, storagePath } from './helpers.mjs';

for (const role of ROLES) {
  setup(`login through the form: ${role}`, async ({ page }) => {
    const u = STATE.users[role];
    const m = monitor(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);                       // unauthenticated -> login page
    await page.getByPlaceholder('you@cbva.com').fill(u.email);
    await page.getByPlaceholder('Password').fill(u.password);
    await paceLogin();
    const loginResp = page.waitForResponse((r) => r.url() === `${API}/api/auth/login`);
    await page.locator('form button[type="submit"], form button').last().click();
    expect((await loginResp).status()).toBe(200);
    await expect(page).not.toHaveURL(/\/home$/, { timeout: 20_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const tokens = await page.evaluate(() => [localStorage.getItem('access_token'), localStorage.getItem('refresh_token')]);
    expect(tokens[0]).toBeTruthy();
    expect(tokens[1]).toBeTruthy();
    await m.assertClean(`login ${role}`);
    await page.context().storageState({ path: storagePath(role) });
  });
}

setup('wrong password shows an error and stores nothing', async ({ page }) => {
  await page.goto('/home');
  await page.getByPlaceholder('you@cbva.com').fill(STATE.users.leader_b.email);
  await page.getByPlaceholder('Password').fill('definitely-wrong');
  await paceLogin();
  const resp = page.waitForResponse((r) => r.url() === `${API}/api/auth/login`);
  await page.locator('form button[type="submit"], form button').last().click();
  expect((await resp).status()).toBe(401);
  await expect(page).toHaveURL(/\/home$/);
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});
