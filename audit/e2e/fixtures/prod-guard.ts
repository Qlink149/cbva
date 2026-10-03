import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const BACKEND_ENV = resolve(REPO_ROOT, 'backend/.env');

function parseMongoHost(uri: string): string {
  const match = uri.match(/@([^/?]+)/);
  if (match) return match[1].toLowerCase();
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) return 'localhost';
  return uri.toLowerCase();
}

function readProdMongoUrl(): string | null {
  if (!existsSync(BACKEND_ENV)) return null;
  const text = readFileSync(BACKEND_ENV, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('MONGODB_URL=')) {
      return trimmed.slice('MONGODB_URL='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

export interface GuardResult {
  stagingHost: string;
  databaseName: string;
  safe: boolean;
  message: string;
}

export function assertNotProductionMongo(): GuardResult {
  const stagingUrl = process.env.MONGODB_URL;
  const dbName = process.env.DATABASE_NAME || 'cbva1_db';

  if (!stagingUrl) {
    throw new Error(
      'MONGODB_URL is not set. Export staging URI before running E2E (never use production).',
    );
  }

  const prodUrl = readProdMongoUrl();
  const stagingHost = parseMongoHost(stagingUrl);

  if (prodUrl) {
    const prodHost = parseMongoHost(prodUrl);
    if (stagingHost === prodHost) {
      const msg = `ABORT: MONGODB_URL host "${stagingHost}" matches production backend/.env. Use staging cluster only.`;
      console.error(msg);
      return { stagingHost, databaseName: dbName, safe: false, message: msg };
    }
  }

  const msg = `Prod-guard OK: staging host=${stagingHost}, database=${dbName}`;
  console.log(msg);
  return { stagingHost, databaseName: dbName, safe: true, message: msg };
}
