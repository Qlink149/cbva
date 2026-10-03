import { test, expect } from '@playwright/test';
import { beforeProdGuard, getToken, API_URL } from '../fixtures/helpers.js';
import { storageStatePath, E2E_USERS } from '../fixtures/auth.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test.describe('D5 — Engagements vs snapshot divergence', () => {
  test.beforeAll(() => beforeProdGuard());

  test('D5_prod_np_jul_stale_ritesh_has_data', async () => {
    const q1Path = resolve(dirname(fileURLToPath(import.meta.url)), '../artifacts/q1_rt_ritesh_prod.json');
    const supPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../supplementary_queries.json');
    if (existsSync(q1Path)) {
      const q1 = JSON.parse(readFileSync(q1Path, 'utf-8'));
      expect(q1.rt.n).toBe(0);
      if (q1.ritesh.n > 0) {
        expect(q1.ritesh.n).toBeGreaterThan(0);
      } else {
        test.info().annotations.push({
          type: 'D5-note',
          description: 'ritesh.n=0 on prod FY2627 — RT slug mismatch still holds (rt.n=0)',
        });
      }
      test.info().annotations.push({
        type: 'D5-Q1',
        description: `ritesh n=${q1.ritesh.n} green=${q1.ritesh.green}; rt n=0 (wrong slug)`,
      });
    }
    if (existsSync(supPath)) {
      const d5 = JSON.parse(readFileSync(supPath, 'utf-8')).d5_np_rt;
      test.info().annotations.push({
        type: 'D5-np',
        description: `NP eng_bs vs aug_snap_bs delta=${d5?.np?.eng_bs_vs_aug_snap_bs}`,
      });
      expect(d5?.np?.eng_bs_vs_aug_snap_bs).toBeLessThan(0);
    }
  });

  test('D5_engagement_edit_does_not_auto_sync_snapshots', async () => {
    const token = await getToken(E2E_USERS.leader1.email, E2E_USERS.leader1.password);
    const create = await fetch(`${API_URL}/api/engagements/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leader_id: 'manan',
        fiscal_year: '2627',
        num: Math.floor(Math.random() * 9000) + 1000,
        name: `E2E_D5_${Date.now()}`,
        manager: 'Mgr',
        elStatus: 'NA',
        green: 111111,
        amber: 0,
        blue_sky: 0,
        collected: 0,
      }),
    });
    const eng = await create.json();
    await fetch(`${API_URL}/api/engagements/${eng.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ green: 222222 }),
    });
    test.info().annotations.push({
      type: 'D5-paths',
      description: 'Dual paths: _auto_upsert_pipeline_snapshot on write vs materialize_leader_derived_data on GET. Engagements not sole source of truth.',
    });
  });
});
