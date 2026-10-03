import { type Page, type BrowserContext, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeProdGuard, API_URL } from './test-base.js';
import { storageStatePath, E2E_USERS } from './auth.js';

export { beforeProdGuard, API_URL };

const AUTH_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../.auth');
const TOKENS_FILE = resolve(AUTH_DIR, 'tokens.json');

export async function resetArtifacts(): Promise<void> {
  const { spawnSync } = await import('node:child_process');
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/reset_test_artifacts.py');
  spawnSync('python', [script], { stdio: 'inherit', shell: true });
}

async function loginForToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function getToken(email: string, password: string): Promise<string> {
  if (existsSync(TOKENS_FILE)) {
    const tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf-8')) as Record<string, { access_token: string }>;
    const role = (Object.keys(E2E_USERS) as Array<keyof typeof E2E_USERS>).find(
      (k) => E2E_USERS[k].email === email,
    );
    const cached = role ? tokens[role]?.access_token : null;
    if (cached) {
      const probe = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${cached}` },
      });
      if (probe.ok) return cached;
    }
  }
  return loginForToken(email, password);
}

export async function newAuthedContext(
  browser: { newContext: (opts?: object) => Promise<BrowserContext> },
  role: 'leader1' | 'leader2' | 'mgmt' | 'admin' | 'biu',
): Promise<BrowserContext> {
  return browser.newContext({ storageState: storageStatePath(role) });
}

export async function gotoEngagements(page: Page): Promise<void> {
  await page.goto('/my-plan/engagements');
  await page.waitForURL(/\/my-plan\/engagements/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Engagements' })).toBeVisible({ timeout: 30000 });
}

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/my-plan/dashboard');
  await page.waitForURL(/\/my-plan\/dashboard/, { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function gotoActions(page: Page): Promise<void> {
  await page.goto('/my-plan/actions');
  await page.waitForURL(/\/my-plan\/actions/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible({ timeout: 30000 });
}

export function parseDisplayedAmount(text: string): number | null {
  const t = text.replace(/\s/g, '');
  const cr = t.match(/₹?([\d.]+)\s*Cr/i);
  if (cr) return parseFloat(cr[1]) * 1e7;
  const lakh = t.match(/₹?([\d.]+)\s*L/i);
  if (lakh) return parseFloat(lakh[1]) * 1e5;
  const k = t.match(/₹?([\d.]+)K/i);
  if (k) return parseFloat(k[1]) * 1e3;
  const full = t.match(/₹([\d,]+)/);
  if (full) return parseInt(full[1].replace(/,/g, ''), 10);
  return null;
}
