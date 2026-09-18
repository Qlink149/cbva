import { test as base, expect } from '@playwright/test';
import { assertNotProductionMongo } from './prod-guard.js';

export const test = base.extend({
  // Runs prod-guard before every test file via beforeAll in each spec,
  // and again here for tests using this fixture directly.
});

export { expect };

export function beforeProdGuard(): void {
  const result = assertNotProductionMongo();
  if (!result.safe) {
    throw new Error(result.message);
  }
}

export const API_URL = process.env.API_URL || 'http://127.0.0.1:8001';

export async function apiFetch(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const { token: _t, ...rest } = opts;
  return fetch(`${API_URL}${path}`, { ...rest, headers });
}
