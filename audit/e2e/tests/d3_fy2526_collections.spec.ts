import { test, expect } from '@playwright/test';
import { beforeProdGuard, getToken, API_URL } from '../fixtures/helpers.js';
import { E2E_USERS } from '../fixtures/auth.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test.describe('D3 — FY2526 collections', () => {
  test.beforeAll(() => beforeProdGuard());

  test('D3_firm_gap_vs_sheet', async () => {
    const supPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../supplementary_queries.json');
    if (existsSync(supPath)) {
      const data = JSON.parse(readFileSync(supPath, 'utf-8'));
      test.info().annotations.push({
        type: 'D3-gap',
        description: `Firm total gap vs sheet: INR ${data.fy2526_gap_vs_sheet} (short ~10,112,013)`,
      });
      expect(data.fy2526_gap_vs_sheet).toBeLessThan(0);
    }
  });

  test('D3_non_admin_cannot_edit_locked_fy', async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const res = await fetch(`${API_URL}/api/engagements/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leader_id: 'manan',
        fiscal_year: '2526',
        num: 9998,
        name: `E2E_D3_locked_${Date.now()}`,
        manager: 'Mgr',
        elStatus: 'NA',
        green: 1000,
        amber: 0,
        blue_sky: 0,
        collected: 0,
      }),
    });
    test.info().annotations.push({
      type: 'D3-lock',
      description: `Non-admin POST FY2526 status=${res.status} (expect 403 or 400)`,
    });
    expect([400, 403, 422]).toContain(res.status);
  });
});
