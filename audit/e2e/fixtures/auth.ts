import { type Page, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = resolve(__dirname, '../.auth');

export const E2E_USERS = {
  leader1: { email: 'e2e.leader1@staging.cbva.in', password: 'E2eTest123!', file: 'leader1.json' },
  leader2: { email: 'e2e.leader2@staging.cbva.in', password: 'E2eTest123!', file: 'leader2.json' },
  mgmt: { email: 'e2e.mgmt@staging.cbva.in', password: 'E2eTest123!', file: 'mgmt.json' },
  admin: { email: 'e2e.admin@staging.cbva.in', password: 'E2eTest123!', file: 'admin.json' },
  biu: { email: 'amit.sh@cbva.in', password: 'E2eTest123!', file: 'biu.json' },
} as const;

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/home');
  await page.evaluate(() => sessionStorage.setItem('cbva_welcomed', '1'));
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(my-plan|firmwide)/, { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('cbva_welcomed', '1'));
}

export async function skipWelcomeIfNeeded(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.setItem('cbva_welcomed', '1'));
}

export function storageStatePath(role: keyof typeof E2E_USERS): string {
  return resolve(AUTH_DIR, E2E_USERS[role].file);
}

export async function apiLogin(
  baseURL: string,
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const apiBase = process.env.API_URL || 'http://127.0.0.1:8001';
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

export async function injectAuthTokens(page: Page, tokens: { access_token: string; refresh_token: string }): Promise<void> {
  await page.goto('/home');
  await page.evaluate((t) => {
    localStorage.setItem('access_token', t.access_token);
    localStorage.setItem('refresh_token', t.refresh_token);
    sessionStorage.setItem('cbva_welcomed', '1');
  }, tokens);
  await page.goto('/my-plan/dashboard');
  await expect(page).toHaveURL(/my-plan/);
}
