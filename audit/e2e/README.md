# CBVA Playwright E2E

End-to-end verification against **staging MongoDB only**. Production is read-only for comparison scripts.

## Setup

```powershell
cd audit/e2e
npm install
npx playwright install chromium
```

## Run

```powershell
$env:MONGODB_URL="<staging-atlas-uri>"
$env:DATABASE_NAME="cbva1_db"
$env:API_URL="http://127.0.0.1:8001"
$env:E2E_BASE_URL="http://localhost:5173"
npm run test:e2e
```

Requires backend (port 8001) and frontend (port 5173) running locally.

## Structure

- `tests/` — one spec per commitment area
- `fixtures/` — prod-guard, auth, helpers
- `scripts/` — restore staging, seed users, prod read-only Q1 query
- `artifacts/` — screenshots, videos, traces (gitignored)

## Reports

- `audit/E2E_VERIFICATION_REPORT.md` — full 21-item status
- `artifacts/run-results.json` — machine-readable Playwright output
