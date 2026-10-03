# Verification report: branch `deploy/vultr-cloudflare`

Scope: verification of commits 83dbcec, e7249bd, 24cdfe5, d7d2072, 8c4f7cb (base d037ef0) plus the fixes made while verifying
(first pass HEAD `21c17df`; container pass HEAD `a3c2871` + the base-image digest pin). Machine: Windows 10, non-elevated shell. Backend tests ran against a portable MongoDB 7.0.14 on Python 3.12; the
browser checks used headless Chromium (Playwright) against the production build.

**Headline (updated 2026-10-03): the Docker engine now runs, and the container checks that were NOT RUN in the first pass have been executed for real. All of section 1 passes except the items listed as still NOT RUN.** The first pass had no engine (see section 0); those rows are rewritten below with the actual output.
Statuses: PASS / FAIL / NOT RUN. "Fix" is the commit that fixed a defect the check exposed.

## 0. Getting Docker working

| Attempt | Result |
|---|---|
| a) restart Docker Desktop | **FAIL.** Killed and relaunched, waited 240 s; engine never answered (`Docker Desktop is unable to start`). Settings show `WslEngineEnabled=false` (Hyper-V backend); the shell is not elevated (`IsInRole(Administrator)` = False); `wsl --status` prints usage, i.e. WSL is not installed. `wsl --shutdown` is not applicable. |
| b) other docker context | **FAIL.** `docker context ls` lists `default` (`npipe:////./pipe/docker_engine`) and `desktop-linux`; `docker --context default version` shows only the client. No engine behind either pipe. |
| c) podman / rancher-desktop | **NOT ATTEMPTED.** Both need WSL2 or Hyper-V enabled, which needs an elevated shell and a reboot. I cannot do either. |
| e) retry after the user freed disk space (2026-10-03) | **SUCCESS.** The first relaunch still failed (Docker Desktop was applying its own update); on the next try the engine answered: `client=29.8.1 server=29.8.1`, 4 CPUs, 1.917 GiB. (The shell is still non-elevated and `wsl --status` still prints usage, so the root cause of the earlier failure was not the missing WSL, or Docker Desktop recovered through its update; I did not determine which.) |
| d) CI build-only job | **DONE** (`0638c7c`). `.github/workflows/deploy.yml` now has `pull_request` triggers; the `build` job builds the exact `backend/Dockerfile` (no push on PRs) and runs `deploy/smoke-test.sh` on it. Not needed any more for section 1 (run locally), but still worthwhile as the CI gate. |

## Results

### 1. Container (real Docker 29.8.1, run 2026-10-03)

Run with `bash deploy/smoke-test.sh` (final run, image rebuilt from the digest-pinned base) plus a manual full-stack run of the real
`deploy/docker-compose.yml` + real `deploy/Caddyfile` (only additions: a local `mongo:7` service, image `cbva-api:smoke`, host ports 8080/8443, a throw-away
self-signed origin cert, and a scratch `.env`).

| Check | Status | Evidence | Fix |
|---|---|---|---|
| `docker build` backend image; size; `docker history` | **PASS** | built OK from `python:3.11-slim@sha256:bab1b7ef...487b`; `cbva-api:smoke 315MB` (91.6 MB venv layer, 569 kB app, 48.8 MB Debian base layer; rest is the Python base). Config: `User=10001:10001`, healthcheck `CMD python -c ...`, `CMD uvicorn app.main:app ... --workers 1 --no-proxy-headers --no-access-log`. | digest pin in `backend/Dockerfile` |
| no `.env`/`.venv`/`db`/`csv`/`scripts`/`tests` in the image | **PASS** | `ls -la /app` shows only `app/`; `PASS /app/.venv absent`, `/app/db`, `/app/csv`, `/app/scripts`, `/app/tests` absent; `find / -name ".env*"` found nothing (`PASS no .env in image`) | - |
| non-root, `--read-only --tmpfs /tmp`, 700m, stays up 60 s | **PASS** | `docker exec id -u` → `uid=10001`; run with `--read-only --tmpfs /tmp --memory 700m --cap-drop ALL --security-opt no-new-privileges`: `PASS up for 60s`. No read-only crash: nothing in `app/` writes to disk. The bootstrap/CLI also ran fine inside this read-only non-root container. | - |
| `/health` 200; `/health/ready` 200; 503 within ~3 s with Mongo stopped; 200 after restart | **PASS** | `PASS /health 200`, `PASS /health/ready 200 (mongo up)`; Mongo stopped → `PASS 503 in 3413ms (includes starting the curl container)` (the app's own ping timeout is 2 s; earlier host measurement 2.02 s); `/health` stayed 200 during the outage; `PASS /health/ready recovers` after `docker start`. API log: `Readiness check failed` + `GET /health/ready -> 503 ip=172.18.0.2`. | - |
| Docker `HEALTHCHECK` becomes `healthy` | **PASS** | `PASS health=healthy` (`docker inspect .State.Health.Status`); compose run: `api  Up 52 seconds (healthy)` | - |
| `docker stats` RSS after 10 endpoints | **PASS** | smoke runs: 98.28 MiB, 89.09 MiB, 71.46 MiB of 700 MiB (cpu 0.2-0.4%). Full stack after authenticated traffic: `api 71.97MiB / 700MiB`, `caddy 12.11MiB / 128MiB`, `mongo 119.2MiB`. Comfortable on a 1 GB VPS (Mongo is external in production). | - |
| SIGTERM: `docker stop` exit 0 within grace | **PASS** | `PASS exit code 0 in 1s`; log: `Shutting down`, `Waiting for application shutdown`, `Application shutdown complete`, `Finished server process [1]` | - |
| `docker compose -f deploy/docker-compose.yml config` | **PASS** | exit 0 (dummy env; and again with the real override + mounts) | - |
| Caddyfile validates | **PASS** | the real `deploy/Caddyfile` with real `cloudflare-ips.conf` and cert mounts loaded and served in the `caddy:2` container (Caddy 2.x); earlier `caddy validate` (v2.11.4 binary) also `Valid configuration` | - |
| full stack: curl through Caddy; API log shows the real client IP, not the proxy | **PASS** | Containers: Caddy `172.18.0.4`, API `172.18.0.2`, Docker Desktop host gateway `192.168.65.1`. (1) Real Cloudflare ranges (the host is not Cloudflare), client spoofs `CF-Connecting-IP: 198.51.100.88` → API log `GET /api/auth/me -> 401 ip=192.168.65.1`: the true peer as Caddy sees it, **not** the Caddy container IP and **not** the spoofed value. (2) `cloudflare-ips.conf` set to trust `192.168.65.1` (stand-in for Cloudflare), client sends `198.51.100.77` → `ip=198.51.100.77`. (3) Login limit through Caddy: 6 bad logins from `203.0.113.10` → 401×5 then **429**; a different IP (`203.0.113.20`) → 401, not locked out. | - |
| via Caddy: security headers, CORS, docs | **PASS** | `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Access-Control-Allow-Origin: https://app.example.com` for the app origin; `https://evil.example.com` preflight → 400 with no ACAO; `/docs` and `/openapi.json` → 404 (`ENV=prod`) | - |
| bootstrap / demo users / indexes inside the container | **PASS** | `docker compose run --rm --no-deps api python -m app.cli bootstrap` ×2: created, then `already exists ... left unchanged`; `check-demo-users` → `OK: no demo accounts`; `verify-indexes` → `all expected indexes present`; login as the bootstrapped admin through Caddy, then `200` for `/api/auth/me`, `/api/kra/categories`, `/api/financial-years/`, `/api/leaders/`, `/api/admin/users`, `/api/firmwide/summary`; `/api/consolidated-summary/` → **503** (no xlsx in the image, as designed; the dev machine returned 82 rows only because the xlsx exists locally) | - |
| smoke script itself | **PASS after fixes** | exits 0. Real-run defects fixed: MSYS path to `docker build`, `find /` fatal under `set -e`, missing `expect` helper, no `bc`. `shellcheck` (docker image `koalaman/shellcheck`) clean on all three scripts, `hadolint` clean. | `a3c2871` |
| not exercised in containers | **NOT RUN** | the exact behaviour with **Cloudflare** as the peer (needs a real VPS + Cloudflare); `ufw` rules; Origin CA TLS with a real cert; pulling from GHCR | - |

### 2. Workflow

| Check | Status | Evidence | Fix |
|---|---|---|---|
| `actionlint` | **PASS** | actionlint 1.7.12 on `.github/workflows/*.yml`: no output, exit 0 | - |
| secrets referenced exist in the documented list | **PASS after fix** | `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_HOST_FINGERPRINT`, `GHCR_PULL_USER`, `GHCR_PULL_TOKEN` (+ built-in `GITHUB_TOKEN`) are all in the table in `deploy/README.md` §4. Defect found: GHCR login used `github.actor`, which need not own the PAT. | `0638c7c` |
| image tag = commit SHA | **PASS** | `tag=${GITHUB_SHA::12}` pushed with `latest`; deploy uses the SHA tag | - |
| rollback restores the PREVIOUS tag and is reachable on failure | **PASS (simulated)** | The real deploy script, extracted from the YAML and run against a stub `docker`: A healthy deploy → exit 0, `.current_tag=new`, `.previous_tag=old`. B never healthy → `Rolling back to oldtag000001`, `Rollback ... healthy`, running=old, exit 1. C `compose pull` fails → same rollback. D first deploy, unhealthy → logs "nothing to roll back to", exit 1. Defect found: the old script did not roll back if `pull`/`up` itself failed (`set -e` exited first). | `0638c7c` |
| never prints secrets | **PASS** | token passed via stdin to `docker login ... >/dev/null`; stub run output contained 0 occurrences of the token | - |
| SSH host key pinned (no `StrictHostKeyChecking=no`) | **PASS after fix** (not executed) | Was unpinned. Both `appleboy/scp-action` and `ssh-action` now get `fingerprint: ${{ secrets.SSH_HOST_FINGERPRINT }}`. I rely on the action's documented `fingerprint` input; the workflow has never run on GitHub (**NOT RUN**). | `0638c7c` |
| 3 known-failing FY-lock tests do not block deploy | **PASS** | Full suite: `145 passed, 1 skipped`. Root cause was in the tests (FY 2526 has no editable doc and every month is locked since Apr 2026), fixed with `seed_editable_fy()` and the calendar-current FY; no app code touched. One stale test skipped with an explicit reason (audit-log is admin-only) and replaced by `test_audit_api_is_admin_only`. | `9c637ff` |
| the workflow runs on GitHub | **NOT RUN** | - | - |

### 3. JWT / auth (PyJWT swap): `tests/test_jwt.py`, 19 tests, all pass

| Check | Status | Evidence | Fix |
|---|---|---|---|
| decode pins `algorithms=["HS256"]` | **PASS** | `security.py:decode_token`; tests `test_alg_none_rejected`, `test_hs512_and_other_algs_rejected` | - |
| wrong key / expired rejected | **PASS** | `test_wrong_key_rejected`, `test_expired_rejected`; HTTP-level cases return 401 | - |
| wrong `type` (refresh as access, access as refresh) | **PASS** | `test_http_bad_tokens_get_401_not_500[refresh_as_access]`, `test_access_token_cannot_be_used_to_refresh` | - |
| `sub` is a string in encode, handled in decode | **PASS after fix** | `test_sub_is_string_in_encode_and_decode`, `test_non_string_sub_rejected_cleanly`. Defect: a validly signed token with a non-ObjectId `sub` raised `bson.errors.InvalidId` → **500**. Now 401. | `dfc18a3` |
| old python-jose tokens rejected cleanly (401, not 500) | **PASS** | Hand-built jose-format token signed with the old default key → 401 (`old_jose_old_key`). **Note:** a jose token signed with the *current* key still validates (`test_jose_format_token_with_current_key_is_wire_compatible`): no forced logout, by design. Because the key is changing from the old default anyway, all pre-migration tokens die. | - |
| refresh rotation: old token fails | **FAIL → fixed** | `test_refresh_rotation_old_token_unusable` initially failed: with no `jti`, a refresh in the same second as login produced a **byte-identical** token, so the "rotated-out" token stayed valid. Added `jti` (uuid4) to access and refresh tokens. Now passes. | `d069d08` |
| password change and deactivation revoke refresh tokens; logout revokes | **PASS** | `test_password_change_revokes_refresh_tokens`, `test_deactivation_revokes_refresh_tokens`, `test_logout_revokes_refresh` | - |
| `SECRET_KEY` validator: app refuses to start | **PASS** | Subprocess `import app.main` exits non-zero with `SECRET_KEY` in stderr for: unset (empty cwd so no `.env`), `""`, `short-key`, `dev-secret-change-in-production`, `change-me-in-production`, `change-me-to-a-long-random-string`; exits 0 for a 48-char key. Plus 8 validator unit tests. | - |

### 4. Rate limiting / proxy trust: `tests/test_rate_limit_proxy.py`, 19 tests

| Check | Status | Evidence | Fix |
|---|---|---|---|
| `key_func` | shown | `app/core/limiter.py:client_ip` | - |
| `CF-Connecting-IP` honoured only from the trusted peer network | **FAIL → fixed** | Was unconditional (any direct client could pick its bucket). Now honoured only when the TCP peer is inside `TRUSTED_PROXY_CIDRS` (default 127/8, 10/8, 172.16/12, 192.168/16) and the value parses as an IP. Tests: trusted private peers use the header; `203.0.113.9`, `8.8.8.8`, `2001:db8::1` ignore it; rotating the header from an untrusted peer stays in one bucket (`test_untrusted_peer_cannot_dodge_limit_by_rotating_header`: 6th and 7th request → 429). Dockerfile now uses `--no-proxy-headers` (and no `--forwarded-allow-ips '*'`), otherwise uvicorn would rewrite the peer from `X-Forwarded-For`. | `532ab4c` |
| per-email counter prunes expired entries (bounded memory) | **FAIL → fixed** | Expired keys were never removed (only hard-cleared at 10 000). Added periodic sweep + cap. Tests: 500 keys expire → table ≤ 60 after a sweep; hard cap holds at 100 for 1000 keys. | `532ab4c` |
| case-insensitive; does not leak whether an email exists; 11th attempt → 429 | **PASS** | 5 case/whitespace variants share one bucket, attempts 1–10 → 401, 11th → 429. Existing and non-existing emails produce identical `(status, detail)` sequences. | - |
| `/login` 5/min: a second client IP is not locked out | **PASS** | `test_per_ip_login_limit_is_per_client_not_global`: IP A gets 401×5 then 429; IP B logs in 200 | - |
| Cloudflare-only ingress by default, with a refresh job; Caddy `trusted_proxies` uses the same ranges | **PASS (stubbed ufw)** / real ufw **NOT RUN** | `refresh-cloudflare-ips.sh` fetches the live `ips-v4`/`ips-v6` (22 ranges), validates them, adds ufw rules before removing stale ones, regenerates the Caddy snippet. With a stub `ufw`: first run 22 allows; rerun 0 allows (idempotent); simulated Cloudflare change → 1 delete + 1 allow. `bootstrap-vps.sh` installs it with a daily cron, honours `SSH_ALLOW_IP`, no blanket 80/443. `shellcheck` clean. **Consequence handled:** Let's Encrypt cannot reach a Cloudflare-only origin, so the Caddyfile uses a Cloudflare Origin CA cert (documented). This needs a real VPS to confirm. | `bc58c40` |

### 5. CORS: `tests/test_cors.py`, 12 tests

| Check | Status | Evidence |
|---|---|---|
| exact app origin allowed incl. `Authorization` header and PATCH | **PASS** | `test_preflight_allowed_origin_succeeds`, `test_preflight_patch_with_authorization_header_allowed` (PATCH is in the allowed methods; the routers use it, though your brief listed only GET/POST/PUT/DELETE/OPTIONS) |
| random origin, `*.pages.dev`, `*.vercel.app`, `null`, wrong scheme, suffix trick → rejected | **PASS** | 7 parametrized cases → 400, no `access-control-allow-origin`; disallowed header → 400 |
| no `Access-Control-Allow-Credentials` | **PASS** | absent on preflight and on actual responses |
| frontend axios never sets `withCredentials` | **PASS** | `grep -rn withCredentials frontend/src` → 0 hits |

### 6. Frontend

| Check | Status | Evidence | Fix |
|---|---|---|---|
| `npm ci && npm run build` with `VITE_API_URL=https://api.example.com` | **PASS** | `npm ci` added 620 packages; `✓ built in 1m 6s` | - |
| without `VITE_API_URL` fails | **PASS** | `Error: VITE_API_URL is required for production builds (e.g. https://api.example.com).` exit 1 | - |
| with `http://localhost:8000` (and `127.0.0.1`) fails | **PASS** | `Error: VITE_API_URL must not point at localhost in a production build (got "http://localhost:8000").` | - |
| grep `dist/` for `localhost`, `base44`, `api.example.com` (built with `https://api.cbva-prod.in`) | **PASS** | `localhost`: 1 bundle, axios's own `window.location.href\|\|"http://localhost"` fallback (not our API URL). `base44`: only the logo URLs (later removed) and `_headers`. `api.example.com`: only `_headers`. No `eval(` / `new Function`. | - |
| logo local, `media.base44.com` removed from CSP | **PASS** | Both Base44 URLs were byte-identical (md5 equal) → `frontend/public/cbv-logo.png` (1024×528 PNG); 7 references updated; CSP `img-src 'self' data:` | `34dd092` |
| 21-route headless CSP check | **PASS** | `node scripts/verify-csp.mjs`: `CSP VIOLATIONS: 0` on the final build. Negative control (removing the Google Fonts and Base44 allowances) gave 136 violations, so the check can fail. API calls were mocked at `api.example.com`; CSP against the real API is **UNVERIFIED**. | - |
| Base44 vite plugin / SDK | **PASS** | `@base44/sdk`: 0 imports in `src/` or `vite.config.js`; removing it left `dist/` byte-identical (`diff -rq` empty) → removed from `package.json` + lockfile. `@base44/vite-plugin` is **used and kept**: without it the build fails (`Rollup failed to resolve import "@/App.jsx"`) because it supplies the `@/` alias. | `34dd092` |
| `_headers`: no `unsafe-inline`/`unsafe-eval` in `script-src`; `connect-src` only the API | **PASS** | `script-src 'self'`; `unsafe-eval` count 0; `connect-src 'self' https://api.example.com` (style-src has `'unsafe-inline'`, needed by Tailwind/Radix) | - |
| every place `api.example.com` must be replaced | **PASS after fix** | `deploy/Caddyfile` site address; Pages env `VITE_API_URL`; `backend/.env` `FRONTEND_ORIGIN` (`app.example.com`). The `_headers` placeholder is now rewritten to `VITE_API_URL`'s origin at build time (verified: build with `https://api.cbva-prod.in` → `connect-src 'self' https://api.cbva-prod.in`), because forgetting it would have blocked every API call. | `1d0317e` |
| refresh loop / silent refresh / logout in a real browser | **PASS** | `node scripts/verify-auth-flow.mjs`: S1 refresh endpoint 401 → **1** refresh POST, tokens cleared, redirected to `/home`, stable for 9 s (no loop). S2 expired access token → `/api/auth/me` sent with `Bearer expired` then once with `Bearer fresh`, 1 refresh, stays on the page, tokens updated. S3 logout → 1× `POST /api/auth/logout` with `Bearer fresh`, both tokens cleared, `/home`. A real 15-minute expiry is simulated by a 401 (tokens are opaque to the SPA). First harness run showed 2 refreshes: a test artefact (my init script re-seeded tokens on every page load); fixed in the script. | - |

### 7. Data / bootstrap / seed

| Check | Status | Evidence | Fix |
|---|---|---|---|
| `bootstrap` twice on a fresh empty DB | **PASS** | run 1: `admin: created`, `kra_categories=4`, `fy: created 2627`, `fy: current=2627`, warning that `leaders` is empty. run 2: `already exists ... left unchanged`. Counts after: users 1, financial_years 1, kra_categories 4, kpi_definitions 17, leaders 0. Short password → exit 2. `tests/test_cli.py` also checks an env password change does not overwrite the admin. | - |
| log in as admin; `/api/kra/categories`, `/api/financial-years/` | **PASS** | login 200 (admin); categories `data[4]`; financial-years `data[1]` | - |
| what is still empty / screen→data table | **PASS** | 36 GET endpoints probed; table in `deploy/DATA_MIGRATION.md` §5. Empty after bootstrap: leaders, engagements, clients, engagement types, pipeline, team, hiring, tasks/actions, meetings, additional work, baselines, audit history; `consolidated-summary` gives 503 until seeded (it returned 82 rows locally only because the xlsx exists on this machine). 422s in the probe were my missing query params, not defects. | - |
| `check-demo-users` with planted `admin@cbva.com`, `mm@cbva.com`, `vc@cbva.com` | **PASS** | read-only: lists the 3, exit 1, nothing changed; `--deactivate`: 3 deactivated, refresh tokens `[]`, `Real.Person@firm.com` untouched, exit 0. Also in `tests/test_cli.py`. | - |
| `deploy/DATA_MIGRATION.md` | **PASS** | commands executed against local mongod with Database Tools 100.10.0: dump → restore into a differently named DB with `--drop` (50 docs) → rerun (50 docs, idempotent) → `compare-counts` "all counts match" → `verify-indexes` "all expected indexes present". Defect found by running it: `mongodump` has no `--nsInclude`. New CLI commands `verify-indexes` / `compare-counts` have negative controls (dropped index → exit 1, `--create` repairs; differing counts → exit 1). **Not run against Atlas or real CBVA data.** | `56639b1`, `a43d407` |

### 8. Misc

| Check | Status | Evidence | Fix |
|---|---|---|---|
| remaining `date.today()` / naive `datetime.now()` in `app/` | **FAIL → fixed** | 16 `date.today()` calls: `routers/engagements.py` ×3, `collections.py` ×2, `bluesky.py` ×2, `services/consolidated_service.py`, `engagement_derivation.py`, `firmwide_service.py`, `fy_calendar.py` ×6. My earlier claim that `TZ=Asia/Kolkata` made them safe depended on the base image shipping system tzdata (libc), which I could not verify, and pip `tzdata` does not feed libc. All now use `today_ist()`; `tests/test_today_ist.py` has an AST guard that fails on `date.today()`, `datetime.utcnow()` or tz-less `datetime.now()` in `app/` (guard logic checked against 4 sample snippets). No naive `datetime.now()` existed. | `2d67113` |
| exactly 1 worker | **PASS** | `CMD ["uvicorn", ..., "--workers", "1", "--no-proxy-headers", "--no-access-log"]`; no gunicorn anywhere | - |
| `git ls-files \| grep -Ei '\.env$\|\.pem$\|\.key$\|\.log$\|dist/'` | **PASS** | no output | - |
| `git log --all -p -S'mongodb+srv://' -- . ':!*.md'` and secret scan of branch additions | **PASS** | one hit: `e7249bd` adding the `<user>:<password>` **placeholder** in `.env.example`. Regex scan of added lines found only the test fixtures (`password123`, same as existing tests). I also checked that none of the real values in the local `backend/.env` (`MONGODB_URL`, `MONGODB_URL_PROD_READ`, their passwords, `SECRET_KEY`) appear in any commit on any branch, any tracked file, or untracked non-ignored files. | - |
| `pip-audit` (no `--no-deps`) | **PASS** | `No known vulnerabilities found` on `backend/requirements.txt` (resolves transitives). `api/requirements.txt` is byte-identical. | - |
| `npm audit --omit=dev` | **FAIL (not fixed here)** | **15 vulnerabilities: 6 high, 8 moderate, 1 low.** High: `axios`, `lodash`, `postcss`, `form-data`, `nanoid`, `picomatch`; moderate incl. `react-router-dom` / `@remix-run/router`, `dompurify`, `moment`, `quill`/`react-quill` (fix is breaking). `lodash`, `react-quill`, `quill`, `jspdf`, `dompurify` have no imports in `src/` (unused weight); `axios` (carries the tokens) and `react-router` are used. Non-breaking fixes exist for all but `react-quill`. These dependencies pre-date this branch, so I did not bump them in a verification pass. | - |

## Defects found in our own work, and fixed (small commits)

| Commit | Defect | Proved by |
|---|---|---|
| `dfc18a3` | validly signed token with non-ObjectId `sub` → 500 | `test_http_bad_tokens_get_401_not_500` |
| `d069d08` | refresh tokens not unique within one second, so rotation did not invalidate the old token | `test_refresh_rotation_old_token_unusable` |
| `532ab4c` | `CF-Connecting-IP` trusted from any peer; per-email table never pruned; uvicorn could rewrite the peer | `tests/test_rate_limit_proxy.py` |
| `0638c7c` | deploy: unpinned SSH host key; GHCR user not tied to the PAT; no rollback when pull/up failed | stub-docker simulation (4 scenarios), `actionlint` |
| `bc58c40` | Cloudflare-only firewall had no implementation; Caddy ranges and ufw could drift; ACME impossible behind it | stub-ufw run, `caddy validate`, host Caddy+uvicorn run |
| `1d0317e` | CSP `connect-src` placeholder would have blocked all API calls if not hand-edited | build with a different URL → rewritten |
| `2d67113` | 16 server-local `date.today()` calls | `tests/test_today_ist.py` |
| `e3c9bc7` + `2f1797b` | hadolint DL3025/DL3066 and shellcheck SC2086/SC2015; **my first lint-fix commit (`e3c9bc7`) shipped a Dockerfile with a literal `\n`**, which hadolint flagged right after; repaired in `2f1797b`. HEAD is good; that intermediate commit is not. | `hadolint` exit 0 |
| `21c17df` | CRLF left in 5 files by text-mode rewrites on Windows (Dockerfile, compose, cli.py, limiter.py, test_jwt.py) | `git diff -w` empty; hadolint/compose/tests re-run |
| `9c637ff` | 3 date-dependent failing tests + 1 stale test | suite 145 passed, 1 skipped |

## Other findings (not fixed)

- **Local `backend/.env` points `MONGODB_URL` at the same cluster, user and database as `MONGODB_URL_PROD_READ`** (identical string; `DATABASE_NAME == PROD_DATABASE_NAME`). So the "read-only prod" credential is not read-only and day-to-day local runs hit the production database. Every command in this pass set explicit local URLs or ran pytest with `DATABASE_NAME=cbva_test`, and `conftest.py` refuses non-`_test` names, but it does not check the host. Rotate that credential and point dev at a local DB.
- Reads that write (appraisal rounds, collections, blue-sky, EL summary rows) also create rows for non-existent leaders (`leader_id=x` created 4 appraisal rounds). Pre-existing.
- `public/manifest.json` is referenced by `index.html` but does not exist; with the SPA rewrite it returns `index.html` (console noise).
- The per-email login throttle also lets someone lock a known email out for 15 minutes (accepted trade-off, documented).
- `docker-compose.yml` bind-mounts `./certs`; if you forget the Origin CA files Caddy will not start (by design, fails closed).

## GO / NO-GO for a staging deploy

**GO for staging.** The image builds from a digest-pinned base, runs as uid 10001 on a read-only root filesystem, reaches `healthy`, answers `/health/ready` 200 / 503 / 200
around a Mongo outage, stops cleanly on SIGTERM, and the real compose + Caddy stack passes client-IP, spoofing, rate-limit, CORS and header checks (section 1).
Backend suite 145 passed / 1 skipped; `pip-audit` clean.

Still NOT RUN (cannot be run here; none failed). Do these on the first staging deploy:

1. The GitHub Actions workflow has never executed (including the `fingerprint` input of the appleboy actions and the PR `build` job).
2. A real VPS: `bootstrap-vps.sh` / ufw Cloudflare-only rules, key-only SSH, swap, and the cron refresh.
3. Cloudflare in front: Full (strict) with an Origin CA certificate, and the API seeing `CF-Connecting-IP` from real Cloudflare edges.
4. Pulling the image from GHCR with the `GHCR_PULL_*` credentials; the auto-rollback on a real failed deploy.
5. Atlas: allowlist for the VPS IP, user privileges, `mongodump`/`mongorestore` against real data.

Not blocking staging, **required before production**: the `npm audit` highs (axios, react-router, lodash, postcss, form-data, nanoid, picomatch), rotating the local `.env`
credential that equals `MONGODB_URL_PROD_READ`, checking the prod DB for demo accounts (`check-demo-users`), loading `leaders` and `consolidated_summaries` into prod, and moving the
frontend logo/fonts off third parties if you want a tighter CSP.
