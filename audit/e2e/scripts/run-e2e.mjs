#!/usr/bin/env node
/**
 * Orchestrator: prod-guard -> restore staging -> seed users -> playwright test
 *
 * Required env:
 *   MONGODB_URL  — staging Atlas URI (NOT production)
 *   DATABASE_NAME — cbva1_db (default)
 *
 * Optional:
 *   API_URL=http://127.0.0.1:8001
 *   E2E_BASE_URL=http://127.0.0.1:5173
 *   E2E_SKIP_RESTORE=1
 *   E2E_SKIP_SEED=1
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(E2E_ROOT, '../..');

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function prodGuard() {
  if (!process.env.MONGODB_URL) {
    console.error('ERROR: Set MONGODB_URL to staging cluster before running E2E.');
    process.exit(1);
  }
  const envPath = resolve(REPO_ROOT, 'backend/.env');
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf-8');
    const prodLine = text.split('\n').find((l) => l.trim().startsWith('MONGODB_URL='));
    if (prodLine) {
      const prodUrl = prodLine.split('=').slice(1).join('=').trim();
      const prodHost = (prodUrl.match(/@([^/?]+)/) || [])[1]?.toLowerCase();
      const stagingHost = (process.env.MONGODB_URL.match(/@([^/?]+)/) || [])[1]?.toLowerCase();
      if (prodHost && stagingHost && prodHost === stagingHost) {
        console.error(`ABORT: MONGODB_URL host matches production (${prodHost})`);
        process.exit(1);
      }
      console.log(`Prod-guard OK: staging host=${stagingHost}, prod host=${prodHost}`);
    }
  }
}

prodGuard();

if (!process.env.E2E_SKIP_RESTORE) {
  run('python', [resolve(__dirname, 'restore_staging.py'), '--if-empty']);
}
if (!process.env.E2E_SKIP_SEED) {
  run('python', [resolve(__dirname, 'seed_users.py')]);
}

// Prod read-only Q1 query
run('python', [resolve(__dirname, 'query_prod_readonly.py')]);

process.env.E2E_EXPECT_A5_FIXED = process.env.E2E_EXPECT_A5_FIXED || '1';
process.env.E2E_REFRESH_AUTH = process.env.E2E_REFRESH_AUTH || '1';

const pwArgs = process.argv.slice(2);
if (pwArgs.length === 0) pwArgs.push('test');
run('npx', ['playwright', ...pwArgs], { cwd: E2E_ROOT });
