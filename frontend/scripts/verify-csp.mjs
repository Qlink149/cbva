// Loads every route of the BUILT app (dist/) in headless Chromium with the CSP from dist/_headers and reports violations.
// Usage (after: VITE_API_URL=https://api.example.com npm run build):  node scripts/verify-csp.mjs
// Needs Playwright: set PLAYWRIGHT_DIR to a folder whose node_modules has it (default ../audit/e2e/).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || new URL('../../audit/e2e/', import.meta.url));
const { chromium } = require('playwright');

const DIST = path.resolve(process.cwd(), 'dist');
const headersTxt = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
const globalBlock = headersTxt.split(/\n\n/)[0].split('\n').slice(1);
const hdrs = {};
for (const l of globalBlock) { const m = l.match(/^\s+([^:]+):\s*(.*)$/); if (m) hdrs[m[1]] = m[2]; }
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { ...hdrs, 'Content-Type': mime[path.extname(f)] || 'text/html' });
  fs.createReadStream(f).pipe(res);
}).listen(4173);

const routes = ['/home', '/', '/my-plan/dashboard', '/my-plan', '/my-plan/collections', '/my-plan/team', '/my-plan/clients',
  '/my-plan/engagements', '/my-plan/pipeline', '/my-plan/clients/abc', '/my-plan/actions', '/my-plan/meetings',
  '/my-plan/scorecard', '/my-plan/blue-sky-summary', '/firmwide/clients', '/firmwide/origination', '/firmwide/board-pack',
  '/firmwide/consolidated', '/firmwide/change-log', '/admin', '/nonexistent'];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const violations = [];
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem('access_token', 'x'); localStorage.setItem('refresh_token', 'y');
  document.addEventListener('securitypolicyviolation', (e) => {
    (window.__csp = window.__csp || []).push(`${e.violatedDirective} blocked ${e.blockedURI} @${e.sourceFile || ''}:${e.lineNumber || ''}`);
  });
});
page.on('console', (m) => { if (/content security policy/i.test(m.text())) violations.push('console: ' + m.text()); });
const apiCalls = new Set();
await page.route('https://api.example.com/**', (route) => {
  const u = new URL(route.request().url());
  apiCalls.add(u.pathname);
  let body = { data: [], total: 0 };
  if (u.pathname === '/api/auth/me') body = { id: '1', full_name: 'T', email: 't@x.com', role: 'admin', leader_id: null, designation: 'x' };
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
});
for (const r of routes) {
  await page.goto('http://localhost:4173' + r, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const v = await page.evaluate(() => window.__csp || []);
  for (const x of v) violations.push(`${r}: ${x}`);
  await page.evaluate(() => { window.__csp = []; });
  console.log('visited', r, '->', new URL(page.url()).pathname);
}
console.log('API paths mocked:', apiCalls.size);
console.log('CSP VIOLATIONS:', violations.length);
[...new Set(violations)].forEach((v) => console.log(' -', v));
await browser.close(); server.close();
