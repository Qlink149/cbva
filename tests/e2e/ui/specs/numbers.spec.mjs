// Key numbers on screen match the API: the leader dashboard's Pipeline table (last column = latest snapshot)
// equals the last row of GET /api/pipeline/ for EVERY real leader. Read-only (note: that GET re-materialises the
// current month's snapshot from engagements, which only bumps updated_at; it is the app's normal page load).
import { test, expect } from '@playwright/test';
import { FY, api, installCspCollector, monitor, setLeaderAndFy, settle, storagePath } from './helpers.mjs';

test.use({ storageState: storagePath('admin') });

const money = (txt) => Number(String(txt).replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1')) || 0;

test('pipeline totals per leader: dashboard == API', async ({ browser, request }) => {
  const raw = await (await api(request, 'admin', 'GET', '/api/leaders/')).json();
  const leaders = (raw.data || raw)
    .filter((l) => !String(l.id).startsWith('e2e_'));
  expect(leaders.length).toBeGreaterThan(0);
  const report = [];
  for (const leader of leaders) {
    const context = await browser.newContext({ storageState: storagePath('admin') });
    await installCspCollector(context);
    await setLeaderAndFy(context, leader.id);
    const page = await context.newPage();
    const m = monitor(page);
    await page.goto('/');
    await settle(page);
    const data = (await (await api(request, 'admin', 'GET', `/api/pipeline/?leader_id=${leader.id}&fiscal_year=${FY}`)).json()).data;
    if (!data.length) {
      await expect(page.getByText(/No pipeline data for/)).toBeVisible();
      report.push(`${leader.id}: no pipeline data (empty state shown)`);
    } else {
      const last = data[data.length - 1];
      const want = { Green: last.green, Amber: last.amber, 'Blue Sky': last.blue_sky,
        Total: last.total || (last.green || 0) + (last.amber || 0) + (last.blue_sky || 0) };
      for (const [label, value] of Object.entries(want)) {
        const cell = page.getByRole('row', { name: new RegExp(`^${label}`) }).first().getByRole('cell').last();
        const shown = money(await cell.innerText());
        expect.soft(Math.abs(shown - (value || 0)), `${leader.id} ${label}: UI ${shown} vs API ${value}`).toBeLessThan(1);
      }
      report.push(`${leader.id}: ${last.label} G=${last.green} A=${last.amber} B=${last.blue_sky} T=${want.Total}`);
    }
    await m.assertClean(`dashboard ${leader.id}`);
    await context.storageState({ path: storagePath('admin') });
    await context.close();
  }
  test.info().annotations.push({ type: 'pipeline', description: report.join(' | ') });
  console.log(report.join('\n'));
});
