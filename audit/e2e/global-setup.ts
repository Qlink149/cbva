import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNotProductionMongo } from './fixtures/prod-guard.js';
import { AUTH_DIR, E2E_USERS } from './fixtures/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = resolve(AUTH_DIR, 'tokens.json');

async function apiLogin(apiURL: string, email: string, password: string) {
  const res = await fetch(`${apiURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function globalSetup(config: FullConfig): Promise<void> {
  const guard = assertNotProductionMongo();
  if (!guard.safe) throw new Error(guard.message);

  mkdirSync(AUTH_DIR, { recursive: true });

  const baseURL = config.projects[0].use.baseURL as string;
  const apiURL = process.env.API_URL || 'http://127.0.0.1:8001';

  const health = await fetch(`${apiURL}/health`);
  if (!health.ok) {
    throw new Error(`Backend not reachable at ${apiURL}/health`);
  }

  const tokens: Record<string, { access_token: string; refresh_token: string }> = {};

  if (existsSync(TOKENS_FILE) && !process.env.E2E_REFRESH_AUTH) {
    Object.assign(tokens, JSON.parse(readFileSync(TOKENS_FILE, 'utf-8')));
  } else {
    for (const [role, creds] of Object.entries(E2E_USERS)) {
      await new Promise((r) => setTimeout(r, 1500));
      const data = await apiLogin(apiURL, creds.email, creds.password);
      tokens[role] = { access_token: data.access_token, refresh_token: data.refresh_token };
      console.log(`Token OK: ${role}`);
    }
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  }

  const browser = await chromium.launch();
  for (const [role, creds] of Object.entries(E2E_USERS)) {
    const statePath = resolve(AUTH_DIR, creds.file);
    const t = tokens[role];
    if (!t) continue;
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto('/home');
    await page.evaluate((tok) => {
      localStorage.setItem('access_token', tok.access_token);
      localStorage.setItem('refresh_token', tok.refresh_token);
      sessionStorage.setItem('cbva_welcomed', '1');
    }, t);
    await page.goto('/my-plan/dashboard');
    await page.waitForURL(/\/(my-plan|firmwide)/, { timeout: 30000 }).catch(async () => {
      if (role === 'mgmt' || role === 'admin') {
        await page.goto('/firmwide/consolidated');
      }
    });
    await context.storageState({ path: statePath });
    console.log(`Storage state: ${role}`);
    await context.close();
  }
  await browser.close();
}

export default globalSetup;
