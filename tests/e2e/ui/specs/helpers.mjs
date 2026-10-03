// Shared helpers: credentials, login pacing (shared with the API suite), and a page monitor that fails a test on
// console errors, uncaught exceptions, CSP violations, failed requests, and any 3xx/5xx (or unexpected 4xx) API call.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const E2E_DIR = path.resolve(HERE, '..', '..');
export const ARTIFACTS = path.join(E2E_DIR, 'artifacts');
export const API = (process.env.E2E_API_URL || 'https://cbva-api.claraai.tech').replace(/\/$/, '');
export const FY = process.env.E2E_FY || '2627';
export const LEADER_A = 'e2e_leader_a';
export const ROLES = ['admin', 'management', 'leader_a'];

export const STATE = JSON.parse(fs.readFileSync(process.env.E2E_STATE || path.join(E2E_DIR, '.state.json'), 'utf8'));
export const storagePath = (role) => path.join(ARTIFACTS, 'ui-auth', `${role}.json`);

// ---- login pacing: same file and budget as tests/e2e/conftest.py (4 logins per rolling 62 s) ----
const STAMPS = path.join(ARTIFACTS, 'login_stamps.json');
const load = () => { try { return JSON.parse(fs.readFileSync(STAMPS, 'utf8')).filter((t) => Date.now() / 1000 - t < 62); } catch { return []; } };
export async function paceLogin() {
  const s = load();
  if (s.length >= 4) await new Promise((r) => setTimeout(r, (62 - (Date.now() / 1000 - s[s.length - 4])) * 1000));
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(STAMPS, JSON.stringify([...load(), Date.now() / 1000]));
}

// ---- API helper (token from a role's saved storage state) ----
export function tokenOf(role) {
  const st = JSON.parse(fs.readFileSync(storagePath(role), 'utf8'));
  const origin = st.origins.find((o) => o.localStorage.some((x) => x.name === 'access_token'));
  return Object.fromEntries(origin.localStorage.map((x) => [x.name, x.value]));
}
export async function api(request, role, method, p, opts = {}) {
  const { access_token } = tokenOf(role);
  const res = await request.fetch(`${API}${p}`, { method, headers: { Authorization: `Bearer ${access_token}` }, maxRedirects: 0, ...opts });
  return res;
}

// ---- page monitor ----
export function monitor(page, { allow4xx = [] } = {}) {
  const problems = [];
  const apiCalls = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Chrome logs every 4xx/5xx resource as a console error; the response handler below judges those
    if (/^Failed to load resource: the server responded with a status of \d+/.test(m.text())) return;
    problems.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    if (f.includes('ERR_ABORTED')) return;            // navigation / React Query cancellation, not a failure
    problems.push(`requestfailed: ${r.method()} ${r.url()} ${f}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    const s = r.status();
    if (u.startsWith(API)) apiCalls.push(`${r.request().method()} ${u.slice(API.length)} ${s}`);
    if (s >= 300 && s < 400 && (u.startsWith(API) || u.includes('/assets/'))) problems.push(`redirect: ${s} ${u}`);
    if (s >= 500) problems.push(`server error: ${s} ${u}`);
    if (u.startsWith(API) && s === 401 && !/\/api\/auth\/(login|refresh)/.test(u)) { expired.push(u); return; }   // judged below
    if (u.startsWith(API + '/api/auth/refresh')) refreshes.push(s);
    if (u.startsWith(API) && s >= 400 && s < 500 && !allow4xx.some((rx) => rx.test(`${s} ${u}`))) problems.push(`api ${s}: ${r.request().method()} ${u}`);
  });
  // A 401 on a data call is fine only when the app then refreshed silently (access tokens live 15 minutes)
  const expired = [];
  const refreshes = [];
  return {
    problems, apiCalls, expired, refreshes,
    async cspViolations() { return page.evaluate(() => window.__cspViolations || []).catch(() => []); },
    async assertClean(label) {
      const csp = await this.cspViolations();
      const unrecovered = expired.length && !refreshes.includes(200) ? expired.map((u) => `api 401 without a successful refresh: ${u}`) : [];
      const all = [...problems, ...unrecovered, ...csp.map((c) => `CSP: ${c}`)];
      expect(all, `${label}: ${all.join('\n')}`).toEqual([]);
    },
  };
}

// collect CSP violations from the first script onwards
export async function installCspCollector(context) {
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
}

export async function setLeaderAndFy(context, leader, fy = FY) {
  await context.addInitScript(([l, f]) => {
    try { sessionStorage.setItem('cbva_global_leader', l); sessionStorage.setItem('cbva_global_fy', f); } catch { /* ignore */ }
  }, [leader, fy]);
}

export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

export function shotPath(role, route) {
  const name = route.replace(/^\//, '').replace(/[/:]/g, '_') || 'root';
  return path.join(ARTIFACTS, 'screens', role, `${name}.png`);
}
