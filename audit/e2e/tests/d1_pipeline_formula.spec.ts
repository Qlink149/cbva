import { test, expect } from '@playwright/test';
import { beforeProdGuard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test.describe('D1 — Pipeline movement formula', () => {
  test.beforeAll(() => beforeProdGuard());

  test('D1_bluesky_chain_breakdown', async () => {
    const outPath = resolve(AUDIT_ROOT, 'bluesky_chain_validation.json');
    expect(existsSync(outPath)).toBeTruthy();
    const data = JSON.parse(readFileSync(outPath, 'utf-8'));
    const counts: Record<string, number> = {};
    for (const f of data.failures || []) {
      counts[f.rule] = (counts[f.rule] || 0) + 1;
    }
    test.info().annotations.push({
      type: 'D1-breakdown',
      description: JSON.stringify({ total: data.failure_count, ...counts }),
    });
    if (data.failure_count >= 30) {
      expect(counts.missing_entry).toBeGreaterThanOrEqual(25);
      expect((counts.converted_from_pipeline || 0) + (counts.opening_eq_prior_closing || 0)).toBeGreaterThan(0);
    } else {
      test.info().annotations.push({
        type: 'D1-note',
        description: `failure_count=${data.failure_count} — chain may be fixed; snapshot recorded above`,
      });
    }
  });

  test('D1_browser_pipeline_page_loads', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageStatePath('leader1') });
    const page = await ctx.newPage();
    await page.goto('/my-plan/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await ctx.close();
  });
});
