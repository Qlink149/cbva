import { test, expect } from '@playwright/test';
import { beforeProdGuard, gotoEngagements, gotoDashboard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARTIFACTS = resolve(dirname(fileURLToPath(import.meta.url)), '../artifacts');
const metrics: Record<string, number[]> = {};

async function measureNav(page: import('@playwright/test').Page, label: string, fn: () => Promise<void>) {
  const start = Date.now();
  await fn();
  await page.waitForLoadState('networkidle');
  const ms = Date.now() - start;
  if (!metrics[label]) metrics[label] = [];
  metrics[label].push(ms);
  return ms;
}

test.describe('A3 — Engagements tab latency', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('leader2') });

  test('A3_amol_many_engagements_timing', async ({ page }) => {
    const cold = await measureNav(page, 'amol_cold_dashboard', () => gotoDashboard(page));
    const toEng = await measureNav(page, 'amol_to_engagements', async () => {
      await page.getByRole('link', { name: 'Engagements' }).click();
    });
    const back = await measureNav(page, 'amol_back_dashboard', async () => {
      await page.getByRole('link', { name: 'Dashboard' }).click();
    });

    test.info().annotations.push(
      { type: 'A3-ms', description: `amol cold=${cold}ms, to_eng=${toEng}ms, back=${back}ms` },
    );
    expect(cold).toBeLessThan(30000);
  });

  test('A3_manan_fewer_engagements_timing', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('leader1') });
    const page = await ctx.newPage();
    const cold = await measureNav(page, 'manan_cold_dashboard', () => gotoDashboard(page));
    const toEng = await measureNav(page, 'manan_to_engagements', async () => {
      await page.getByRole('link', { name: 'Engagements' }).click();
    });
    test.info().annotations.push(
      { type: 'A3-ms', description: `manan cold=${cold}ms, to_eng=${toEng}ms` },
    );
    await ctx.close();
  });

  test.afterAll(() => {
    mkdirSync(ARTIFACTS, { recursive: true });
    const summary: Record<string, { p50: number; max: number; n: number }> = {};
    for (const [k, vals] of Object.entries(metrics)) {
      const sorted = [...vals].sort((a, b) => a - b);
      summary[k] = {
        p50: sorted[Math.floor(sorted.length / 2)] ?? 0,
        max: Math.max(...vals),
        n: vals.length,
      };
    }
    writeFileSync(resolve(ARTIFACTS, 'a3_latency_metrics.json'), JSON.stringify(summary, null, 2));
  });
});
