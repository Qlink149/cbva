import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'artifacts/html-report' }]],
  outputDir: 'artifacts/test-results',
  globalSetup: resolve(__dirname, 'global-setup.ts'),
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-ist',
      use: {
        ...devices['Desktop Chrome'],
        timezoneId: 'Asia/Kolkata',
      },
      testMatch: /a6_overdue/,
    },
    {
      name: 'chromium-us',
      use: {
        ...devices['Desktop Chrome'],
        timezoneId: 'America/New_York',
      },
      testMatch: /a6_overdue/,
    },
  ],
});
