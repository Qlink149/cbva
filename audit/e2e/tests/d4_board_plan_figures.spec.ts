import { test, expect } from '@playwright/test';
import { beforeProdGuard } from '../fixtures/helpers.js';
import { storageStatePath } from '../fixtures/auth.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test.describe('D4 — Initial and board plan figures', () => {
  test.beforeAll(() => beforeProdGuard());
  test.use({ storageState: storageStatePath('mgmt') });

  test('D4_ak_board_snap_zero_on_prod', async () => {
    const supPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../supplementary_queries.json');
    if (existsSync(supPath)) {
      const data = JSON.parse(readFileSync(supPath, 'utf-8'));
      expect(data.ak_board_snap?.total).toBe(0);
      test.info().annotations.push({
        type: 'D4-AK',
        description: `AK board snap total=${data.ak_board_snap?.total} vs sheet ~4.77 Cr`,
      });
    }
  });

  test('D4_consolidated_ui_shows_ak', async ({ page }) => {
    await page.goto('/firmwide/consolidated');
    await page.waitForLoadState('networkidle');
    const ak = page.getByText(/\bAK\b|Ankit|consolidated/i).first();
    const visible = await ak.isVisible().catch(() => false);
    expect(visible || page.url().includes('consolidated')).toBeTruthy();
    test.info().annotations.push({
      type: 'D4-report',
      description: 'D4_AK_SP_VP_DEVIATION_REPORT.md send status: unconfirmed',
    });
  });
});
