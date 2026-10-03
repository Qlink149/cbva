// UI end-to-end suite against the DEPLOYED frontend (default https://cbva.claraai.tech) and its API.
// Env: E2E_FRONTEND_URL, E2E_API_URL, E2E_STATE (credentials from ../provision.py, gitignored).
import { defineConfig, devices } from '@playwright/test';

// one id per run for the labels of records the UI specs create (workers inherit it)
process.env.E2E_RUN ||= Math.random().toString(36).slice(2, 7);
const FRONTEND = process.env.E2E_FRONTEND_URL || 'https://cbva.claraai.tech';

export default defineConfig({
  testDir: './specs',
  outputDir: '../artifacts/ui-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,                       // one browser at a time: logins are rate limited per IP
  retries: 0,
  reporter: [['list'], ['junit', { outputFile: '../artifacts/ui-junit.xml' }]],
  use: {
    baseURL: FRONTEND,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.mjs/ },
    { name: 'ui', dependencies: ['setup'], testIgnore: /auth\.setup\.mjs/ },
  ],
});
