// Browser simulation against dist/ with a mocked API (https://api.example.com): refresh failure (no loop), silent
// refresh after access-token expiry, and logout. Usage: node scripts/verify-auth-flow.mjs   (build with VITE_API_URL=https://api.example.com first)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || new URL('../../audit/e2e/', import.meta.url));
const { chromium } = require('playwright');

const DIST = path.resolve(process.cwd(), 'dist');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'text/html' });
  fs.createReadStream(f).pipe(res);
}).listen(4175);

const ME = { id: '1', full_name: 'T', email: 't@x.com', role: 'admin', leader_id: null, designation: 'x' };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const browser = await chromium.launch();

async function scenario(name, setup) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const log = { refresh: 0, me: [], other401: 0, navs: [], logout: 0 };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) log.navs.push(new URL(f.url()).pathname); });
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('access_token', 'expired'); localStorage.setItem('refresh_token', 'r1'); } });
  await page.route('https://api.example.com/**', (route) => setup(route, log));
  await page.goto('http://localhost:4175/my-plan/dashboard');
  await page.waitForTimeout(9000);
  const tokens = await page.evaluate(() => ({ a: localStorage.getItem('access_token'), r: localStorage.getItem('refresh_token') }));
  const result = { name, log, tokens, finalPath: new URL(page.url()).pathname };
  await ctx.close();
  return result;
}

// S1: refresh endpoint itself returns 401 -> tokens cleared, redirected once, no refresh loop
const s1 = await scenario('refresh fails (401)', (route, log) => {
  const u = new URL(route.request().url());
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (u.pathname === '/api/auth/refresh') { log.refresh++; return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"detail":"Refresh token revoked"}' }); }
  if (u.pathname === '/api/auth/me') log.me.push(route.request().headers()['authorization']);
  return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"detail":"expired"}' });
});

// S2: access token expired mid-session; refresh succeeds -> original request retried exactly once with new token,
//     concurrent calls share ONE refresh, user stays signed in
const s2 = await scenario('access token expired, refresh ok', (route, log) => {
  const u = new URL(route.request().url());
  const auth = route.request().headers()['authorization'];
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (u.pathname === '/api/auth/refresh') { log.refresh++; return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ access_token: 'fresh', refresh_token: 'r2', token_type: 'bearer' }) }); }
  if (auth !== 'Bearer fresh') { if (u.pathname === '/api/auth/me') log.me.push(auth); else log.other401++; return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"detail":"expired"}' }); }
  if (u.pathname === '/api/auth/me') { log.me.push(auth); return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(ME) }); }
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) });
});

// S3: logout calls POST /api/auth/logout then clears both tokens
const ctx = await browser.newContext(); const page = await ctx.newPage();
const s3 = { logout: 0, logoutAuth: null };
await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('access_token', 'fresh'); localStorage.setItem('refresh_token', 'r2'); } });
await page.route('https://api.example.com/**', (route) => {
  const u = new URL(route.request().url());
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (u.pathname === '/api/auth/logout') { s3.logout++; s3.logoutAuth = route.request().headers()['authorization']; return route.fulfill({ status: 204, headers: cors }); }
  if (u.pathname === '/api/auth/me') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(ME) });
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[]' });
});
await page.goto('http://localhost:4175/my-plan/dashboard'); await page.waitForTimeout(2500);
s3.bodyStart = (await page.locator('body').innerText()).slice(0, 160).replace(/\s+/g, ' ');
const logoutBtn = page.getByText(/log ?out|sign ?out/i).first();
let clicked = false;
try { await logoutBtn.click({ timeout: 3000 }); clicked = true; } catch { /* maybe inside a menu */ }
if (!clicked) {
  // open user menu then try again
  for (const sel of ['button[aria-haspopup="menu"]', '[data-testid=user-menu]', 'header button:last-child']) {
    try { await page.locator(sel).first().click({ timeout: 1500 }); await page.getByText(/log ?out|sign ?out/i).first().click({ timeout: 2000 }); clicked = true; break; } catch { /* next */ }
  }
}
await page.waitForTimeout(2500);
s3.clicked = clicked;
s3.tokensAfter = await page.evaluate(() => ({ a: localStorage.getItem('access_token'), r: localStorage.getItem('refresh_token') }));
s3.path = new URL(page.url()).pathname;

console.log(JSON.stringify({ s1, s2, s3 }, null, 1));
await browser.close(); server.close();
