# CBVA Insight Dashboard Backend — Deployment-Readiness Audit

Audit date: 2026-10-01 · Branch: `feature/cbva-dashboard-impl` · Scope: `backend/` · No source was modified.
Paths are relative to the repo root. `UNVERIFIED` = could not be confirmed from code alone; the item says what is needed.

> **Stack correction.** The brief assumed Node. This backend is **Python / FastAPI / Motor (async MongoDB)** and is currently wired for **Vercel serverless**, not containers. The Docker path exists but is broken (see §4). Node-specific asks are translated: `npm audit` → `pip-audit`; `--max-old-space-size` → single uvicorn worker + Mongo pool caps.

---

## 1. PROJECT MAP

| Item | Finding |
|---|---|
| Language / runtime | Python. `backend/pyproject.toml` `requires-python >=3.11`; `backend/Dockerfile:1` uses `python:3.11-slim`; local `__pycache__` shows 3.12/3.13/3.14 were also used (version drift). |
| Framework | FastAPI 0.138.0, pydantic 2.10.3 + pydantic-settings 2.6.1, uvicorn[standard] 0.32.1 (`backend/requirements.txt`, `requirements-dev.txt`) |
| DB driver | Motor 3.6.0 (async). No sync pymongo use found. |
| Auth libs | python-jose (HS256), bcrypt 4.2.1, slowapi 0.1.9 |
| Entry points | `backend/app/main.py` (app, lifespan, middleware, routers); `backend/api/index.py` (Vercel ASGI shim that strips `/api/index` prefix); `backend/vercel.json` (rewrite `/(.*)` → `/api/index/$1`) |
| Background jobs / cron / queues / websockets | **None.** No scheduler, Celery, `BackgroundTasks`, `create_task`, or websocket. |
| Startup work | `lifespan` (`app/main.py:~50-59`): `connect_db()` (creates ~55 indexes, `app/core/database.py:53-129`) + `ensure_current_fy_matches_calendar()` (writes to `financial_years`, `app/services/fiscal_year.py:88-118`). Skipped when `VERCEL` env set (`main.py:~66`); then `ensure_db_middleware` (`main.py:81-84`) runs it lazily per request. |
| Third-party integrations | **None** (no email, S3, Sentry, analytics, payment). `httpx` only used by tests. Only external dependency is MongoDB (`MONGODB_URL`). |
| Structure | `backend/app/{core,dependencies,routers(27),schemas(~20),services(~15)}`, `backend/tests` (13 files, ~63 tests), `backend/scripts` (~40, **gitignored**), `backend/db`, `backend/csv` (data, gitignored) |

### Endpoints (prefixes from `app/main.py:103-128`)

Auth dependency key: **Pub** = none · **Any** = `get_current_user` (any active user) · **A** = admin · **M** = management · "scope" = `enforce_leader_scope`/`enforce_leader_write_scope` (`app/dependencies/auth.py:38-68`: `user` role limited to own `leader_id`; admin/management read all; management writes only own leader).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | Pub | `main.py:131`; static `{"status":"ok"}`, **no DB check** |
| GET | `/docs`, `/redoc`, `/openapi.json` | Pub | FastAPI defaults — enabled |
| POST | `/api/auth/login` | Pub | `auth.py:40`, `5/minute` in-memory limiter |
| GET | `/api/auth/me` | Any | `auth.py:76` |
| POST | `/api/auth/refresh` | Pub (refresh token in body) | `auth.py:81`; **no rate limit** |
| POST | `/api/auth/logout` | Any | `auth.py:116` |
| GET/POST | `/api/admin/users` | A | `admin.py:72,78` |
| PUT/DELETE | `/api/admin/users/{id}` | A | `admin.py:103,131`; soft-deactivate |
| GET/PUT | `/api/admin/settings` | A | `admin.py:152,160` |
| GET | `/api/admin/clients`, `/engagement-types`, `/financial-years` | A,M | `admin.py:181,205,228` |
| POST | `/api/admin/clients`, `/engagement-types` | A | `admin.py:189,213`; body is raw `dict` (no schema) |
| POST/PUT | `/api/admin/financial-years[/{id}]` | A | `admin.py:234,263` |
| GET/PUT | `/api/admin/plans` | A | `admin.py:359,379` |
| GET | `/api/audit-log/`, `/entity/{type}/{id}`, `/export` | A | `audit.py:162,195,209` |
| GET | `/api/kra/categories`, `/resolved`, `/competencies`, `/kpis`, `/weights` | Any (**no leader scope**) | `kra.py:113,119,184,263,346` |
| POST/DELETE | `/api/kra/copy` | A | `kra.py:140,163` |
| POST/PUT/DELETE | `/api/kra/competencies[/{id}]`, `/kpis[/{id}]` | A | `kra.py:196-326` |
| PUT | `/api/kra/weights` | A | `kra.py:363` — KRA weightage write |
| GET | `/api/appraisals/rounds`, `/rounds/{id}`, `/scorecard` | Any + scope | `appraisals.py:105,116,227`; GETs may create rounds (`ensure_rounds`) |
| PUT/POST | `/api/appraisals/rounds/{id}/ratings`, `/submit` | Any + `can_write_round` | `appraisals.py:135,201`; self_* → owner `user`; mgmt_* → M/A |
| GET | `/api/leaders/` | A,M | `leaders.py:20` |
| GET | `/api/leaders/{id}` | Any (**no scope**) | `leaders.py:26` |
| POST/PUT | `/api/leaders[/{id}]` | A | `leaders.py:34,48` |
| GET | `/api/firmwide/summary`, `/leaders`, `/clients`, `/team`, `/dashboard-aggregate` | A,M | `firmwide.py:18-82` |
| GET | `/api/consolidated-summary/` | A,M | `consolidated.py:8`; GET can trigger xlsx import + write |
| GET | `/api/financial-years/` | Any | `financial_years.py:8` |
| CRUD | `/api/engagements` (+`/{id}/changes`, `/{id}/remarks`) | Any + scope | `engagements.py:314-490` |
| CRUD | `/api/engagement-actions` | Any + scope | `engagement_actions.py:53-206` |
| CRUD | `/api/pipeline` (+`/fy-actuals`) | Any + scope; DELETE A,M | `pipeline.py:63-236` |
| GET/POST/PUT | `/api/bluesky` | Any + scope | `bluesky.py:109,168,260` |
| GET/POST/PUT | `/api/collections` | Any + scope | `collections.py:43,111,178` |
| GET/POST/DELETE | `/api/collection-transactions` | Any + scope | `collection_transactions.py:77,93,163` |
| CRUD | `/api/actions`, `/tasks`, `/team`, `/hiring`, `/client-meetings`, `/additional-work` | Any + scope | respective routers |
| GET/POST | `/api/new-clients` | Any + scope | `new_clients.py:81,121` |
| GET/POST/PUT | `/api/baselines`, `/api/headcount` (GET/POST), `/api/el-summary` (GET/PUT) | Any + scope | |
| GET | `/api/assessments/` | Any + scope | `assessments.py:34` |

Scope enforcement on the leader-scoped routers was taken from the recon pass and spot-checked, not traced per handler. **UNVERIFIED per route** — a pytest sweep (`tests/test_leader_scope.py` has 2 tests) would confirm.

### Env vars → integrations
Only `MONGODB_URL` (see §3).

---

## 2. DEPLOY COMPATIBILITY VERDICT

# **READY-WITH-FIXES**

The application logic is deployable to a single VPS (no disk writes at runtime, no background workers, one external dependency, bounded queries). It is **not deployable today as-is** because the Docker artifact cannot start and would leak local files into the image, and several config defaults are unsafe in production.

### Blockers (must fix before first deploy)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| B1 | Image won't start: `Dockerfile` installs `requirements.txt`, which has **no uvicorn** (it lives in `requirements-dev.txt`) | Critical | `backend/Dockerfile:5,11`; `requirements.txt` (10 deps, no uvicorn) |
| B2 | No `.dockerignore` → `COPY . .` bakes `.env` (may contain `MONGODB_URL_PROD_READ`), `.venv`, `db/` (~4 MB), `csv/*.xlsx` (~12 MB), `*.log`, `.pytest_cache` into the image | Critical | `backend/Dockerfile:8`; no `.dockerignore` anywhere; `backend/.gitignore` does not apply to Docker |
| B3 | `SECRET_KEY` defaults to `dev-secret-change-in-production`; no startup guard. A missing env var silently signs all JWTs with a public string → full auth bypass | Critical | `app/core/config.py:6` |
| B4 | CORS allows any `https://*.vercel.app` origin **with credentials** by default; target needs only `https://app.<domain>` | High | `app/core/config.py:14`, `app/main.py:94-101` |
| B5 | Rate limiting unusable behind proxy: key = `request.client.host` (= Caddy/Cloudflare IP) so one client exhausts the global 5/min and **locks everyone out of login**; or if headers blindly trusted, spoofable. Storage is in-process. | High | `app/core/limiter.py:4`, `app/routers/auth.py:40-41`; Dockerfile CMD has no `--proxy-headers` |
| B6 | Prod DB may still contain demo accounts (`admin@cbva.com/admin123`, `mm@…/MM`, `vc@…/VC`) created by seed scripts; seed scripts are gitignored so a clean deploy has **no admin user** and no KRA seed | High | `scripts/generate_seed_data.py:287-289`, `scripts/import_fy2627_xlsx.py:56-72` (gitignored, local); `ensure_kra_seed` only called from `tests/conftest.py`; **UNVERIFIED** against live prod DB (need read-only `users` query) |
| B7 | Missing runtime deps in the container: `openpyxl` (lazy import, `services/consolidated_import.py:164`) and `tzdata`; and the xlsx it reads is gitignored/absent → `/api/consolidated-summary` returns `[]` (silent empty data) unless the DB document already exists | High | `consolidated_service.py:309-314` (returns `[]` if file missing); `consolidated_import.py:208-217` |
| B8 | FY rollover uses server-local date: `date.today()` in a UTC container flips FY at 05:30 IST on 1 Apr instead of 00:00 IST | High (on 31 Mar/1 Apr only) | `app/services/fiscal_year.py:12` |
| B9 | Mongo client lacks pool/timeouts/retry options; index build runs on every start and failures are swallowed so indexes may never be created | Medium-High | `app/core/database.py:13-25` |
| B10 | `/health` does not check Mongo → Docker/Caddy health checks will report healthy while DB is unreachable | Medium | `app/main.py:131` |

### Non-blockers

| # | Finding | Severity |
|---|---|---|
| N1 | `python-jose 3.3.0` (5 advisories, fix 3.4.0) and `python-multipart 0.0.17` (14 advisories, fixes up to 0.0.31) — see §7 | High (hygiene; exposure limited, see §7) |
| N2 | bcrypt runs on the event loop (~200–300 ms/login blocks the single vCPU) | Medium |
| N3 | N+1 loops in consolidated/firmwide/new-clients; audit export loads 10k docs | Medium |
| N4 | KRA GETs and `GET /api/leaders/{id}` lack leader scope | Medium |
| N5 | No security headers, `/docs` public, no global exception handler | Medium |
| N6 | `docker-compose.yml` exposes unauthenticated Mongo on 27017 | High if ever used on a public host; irrelevant for target (external Mongo) |
| N7 | No CI, no lockfile with hashes, duplicate requirements files | Low-Medium |
| N8 | `tests/conftest.py` can wipe a non-test DB if env points at prod | Medium (dev safety) |

---

## 3. ENV & CONFIG

All read via `pydantic-settings` in `backend/app/core/config.py` (`env_file=".env"`).

| Var | Purpose | Req? | Default | Used at |
|---|---|---|---|---|
| `MONGODB_URL` | Mongo connection string | **Required in prod** | `mongodb://localhost:27017` | `config.py:5`; `database.py:13` |
| `DATABASE_NAME` | DB name | **Required** | `cbva` | `config.py:6` |
| `SECRET_KEY` | JWT HS256 signing key | **Required** | `dev-secret-change-in-production` (**unsafe**) | `config.py:6`; `security.py:~24,31,35` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access JWT TTL | Optional | 60 | `security.py:~16` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh JWT TTL | Optional | 30 | `security.py:~29` |
| `FRONTEND_ORIGIN` | Comma-separated CORS origins | **Required** | `http://localhost:5173,http://127.0.0.1:5173` | `config.py:~10`; `main.py:95` |
| `CORS_ORIGIN_REGEX` | Extra CORS regex | Optional (**set empty in prod**) | `https://.*\.vercel\.app` | `main.py:96` |
| `MONGODB_URL_PROD_READ`, `PROD_DATABASE_NAME`, `MIGRATION_WRITE_DATABASE_NAME` | One-off migration dry-run scripts only | Not for prod runtime | None / None / `cbva_db_local` | `config.py`; `scripts/meetings_migration_dryrun.py:59-73` |
| `VERCEL` | Disables lifespan, switches to lazy connect | Not set on VPS | unset | `main.py:66` |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Backup script only | n/a | db default `cbva1_db` | `scripts/backup_el_status.py:25-26` |

Secrets / hardcoding review
- **Hardcoded secrets in tracked code:** none found (`git grep` for `mongodb+srv://user:pass@`, `admin123`, long literal `SECRET_KEY` over tracked files: no hits; `.md` files included in this run). Default demo passwords exist only in gitignored scripts.
- **`.env` in git / history:** not tracked (`backend/.gitignore:7`); `git log --all --diff-filter=A -- '*.env*'` → nothing; no `.pem/.key/.log` ever added. **Clean.**
- **Risk:** local `backend/.env` includes `MONGODB_URL_PROD_READ` (key name observed; value not read). If that file was ever shared/zipped/synced, rotate that credential.
- `localhost` appears only as config defaults (`config.py:5,10`) and `docker-compose.yml`.
- Port: `8000` hardcoded in Dockerfile; **`PORT` env not read** (fine behind Caddy as long as compose/Caddy agree on 8000). Binds `0.0.0.0` (`Dockerfile:11`).
- `backend/.gitignore:8` (`.env.*`) ignores `.env.example`, so **no env template is tracked**.

### `.env.example` (proposed)
```dotenv
# --- required ---
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=cbva
DATABASE_NAME=cbva
SECRET_KEY=            # openssl rand -hex 32 ; app must refuse to start if empty/default
FRONTEND_ORIGIN=https://app.example.com
# --- recommended ---
CORS_ORIGIN_REGEX=     # leave EMPTY in prod (default allows *.vercel.app)
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14
TZ=Asia/Kolkata
# --- never set in prod ---
# MONGODB_URL_PROD_READ=  PROD_DATABASE_NAME=  MIGRATION_WRITE_DATABASE_NAME=  VERCEL=
```
Note `CORS_ORIGIN_REGEX=` empty string: pydantic parses it as `""`, which Starlette treats as falsy; **UNVERIFIED** — confirm with a one-line test, otherwise code needs a change.

---

## 4. CONTAINERIZATION

Existing `backend/Dockerfile` (12 lines):
```
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
```

| Check | Result | Severity |
|---|---|---|
| Starts at all | **No** — uvicorn not in `requirements.txt` | Critical (B1) |
| Multi-stage | No | Low |
| Non-root user | No (`USER` absent) | High |
| Prod-only deps | No — `httpx`, `pytest`, `pytest-asyncio` (and unused `mangum`) in prod set | Low |
| `.dockerignore` | Absent | Critical (B2) |
| Pinned base | Tag only (`3.11-slim`), not digest | Low |
| HEALTHCHECK | Absent | Medium |
| Proxy headers | Absent (`--proxy-headers --forwarded-allow-ips`) | High (B5) |
| Binds 0.0.0.0 / respects PORT | 0.0.0.0 yes; PORT no (fixed 8000) | OK |
| Workers | Default 1 — correct for 1 vCPU/1 GB | OK |
| `docker-compose.yml` | Publishes unauthenticated `mongo:7` on `27017:27017`, `FRONTEND_ORIGIN=http://localhost:5173`, `SECRET_KEY` fallback `change-me-in-production` (`docker-compose.yml:1-22`) | High — dev-only; do not reuse |

Estimates (not measured — no Docker build was run here, **UNVERIFIED**): image ≈ 180–250 MB after fixes, bloated by ~16 MB of data files + `.venv` without `.dockerignore`. Steady RSS for one uvicorn worker with this dependency set (no pandas/numpy): ≈ 100–170 MB; spikes to ~250 MB on audit export or xlsx import. Comfortable in 1 GB with a 512–700 MB container cap + 2 GB swap.

---

## 5. MEMORY / PERFORMANCE (1 GB)

Positive: no `to_list(None)`; every `.to_list` has an explicit length (20–500). No pandas/numpy. No upload endpoints. No dict caches.

| # | Issue | Evidence | Sev | Blocking |
|---|---|---|---|---|
| P1 | bcrypt on event loop: login/create-user block all requests ~200–300 ms | `security.py:8,12`; `auth.py:44`; `admin.py:79` | Medium | No |
| P2 | Audit export: up to 10,000 docs (with `snapshot`/`changes`) in memory, expanded to rows, built in `StringIO`, copied by `getvalue()`, returned via `iter([string])` (not streamed) — ~100–300 MB spike possible | `audit.py:209-221` (`list_audit(limit=10000)`) | High (spike on 1 GB) | No (admin-only) |
| P3 | Unanchored, unescaped `$regex` on `q` → collection scan + ReDoS surface; plus `count_documents` per page | `services/audit_service.py` `list_audit` | Medium | No |
| P4 | Sequential N+1: ~5 queries × every leader; up to 500 engagements/transactions per leader pulled to sum in Python | `services/consolidated_service.py:344-377` (loop at 348-350); `_leader_collections` | Medium | No |
| P5 | Firmwide per-leader `find_one` loop | `services/firmwide_service.py:~167`; `team_members` fetch 1000 (`:158`) | Medium | No |
| P6 | `new-clients`: 3 queries × 500 docs joined in Python | `routers/new_clients.py:~19-97` | Low | No |
| P7 | Hard caps with no `total`/skip → silent truncation when data > cap (tasks 200, team 200, assessments/meetings/work/actions 500) | respective routers; only `engagements` + audit paginate (`dependencies/pagination.py`) | Medium (correctness) | No |
| P8 | openpyxl parse inside async handler (sync, blocks loop); only when FY doc absent, result cached in Mongo | `consolidated_import.py:164-166`; `consolidated_service.py:309-325` | Low | No |
| P9 | `get_current_user` does one `users.find_one` per request (by `_id`, fast) | `dependencies/auth.py:~25` | Low | No |
| P10 | Every mutation awaits an inline `audit_log` insert; `audit_log` has no TTL → unbounded growth (delete snapshots stored) | `audit_service.py` `log_event` ~217 | Medium (storage) | No |
| P11 | Middleware stack runs `ensure_db_connected()` on every request | `main.py:81-84` | Low | No |

Mongo pool: only `serverSelectionTimeoutMS=5000` set (`database.py:13-16`); Motor default `maxPoolSize=100`. **Recommend** `maxPoolSize=10–20, minPoolSize=1, maxIdleTimeMS=60000, connectTimeoutMS=5000, socketTimeoutMS=30000, retryWrites=true`.
Runtime flags (Python equivalent of Node heap flag): single `uvicorn --workers 1 --loop uvloop --http httptools --no-access-log --proxy-headers --forwarded-allow-ips='*'` (restrict to Caddy's network in compose), `PYTHONMALLOC`/`MALLOC_ARENA_MAX=2` env, compose `mem_limit: 700m`, host swap 2 GB. Do **not** use gunicorn multi-worker on 1 vCPU/1 GB.

---

## 6. DATABASE (MongoDB)

| Topic | Finding | Evidence | Sev |
|---|---|---|---|
| Conn string | From `MONGODB_URL`; `mongodb+srv://` gives TLS by default. No explicit TLS/CA options. | `config.py:5`; `.env.example` (local, untracked) | OK |
| Pool/timeouts/retry | Only `serverSelectionTimeoutMS=5000`; see §5 | `database.py:13-16` | Medium |
| Reconnect on outage | Motor reconnects per op automatically; but if Mongo is down **at startup** index creation is skipped and never retried (`db` already set, `connect_db` returns early on later calls) | `database.py:10-25` | Medium |
| Index builds every start | ~55 `create_index` round trips + drop/recreate of legacy `kra_weight_config` index in bare `try/except: pass` (`database.py:110-117`); unique-index build fails on duplicates | `database.py:53-129` | Low-Medium |
| Schema | No ODM; pydantic request schemas only. `admin` clients / engagement-types accept raw `dict`. | `admin.py:190,214` | Medium |
| Indexes vs queries | Good prefix coverage on `(leader_id, fiscal_year, …)` for engagements, pipeline, bluesky, collections, actions, team, hiring, headcount, assessments, meetings, additional_work, engagement_actions, collection_transactions, audit_log (4), users, tasks, kra_*. **Gaps:** `financial_years.slug` (+unique), `financial_years.is_current`, `leaders.is_active` (5 call sites), sorts on `collection_transactions.created_at`, `tasks.created_at`, `engagement_actions.created_at` (in-memory sorts), audit regex/`action`/`source` filters; `engagement_change_log` index appears vestigial (service now reads `audit_log`) | `database.py:53-125`; `fiscal_year.py:43-100` | Low-Medium (small collections) |
| Migrations / seed | No framework. ~40 one-off scripts in **gitignored** `backend/scripts/` (only `baseline_snapshot.py`, `seed_varun_2627.py` tracked). Tracked tree cannot recreate admin user, KRA seed, leaders, FYs. | `backend/.gitignore`; `git ls-files backend/scripts` | **High** (B6) |
| KRA seed | `ensure_kra_seed()` (`services/kra_seed.py:259`) never called by app → empty `kra_categories` on fresh DB; `/api/kra/categories` returns `[]` | grep: only `tests/conftest.py` | High |
| Local-disk data | App writes nothing to disk at runtime. **Reads** xlsx from `csv-templates/filled/…` or `backend/csv/…` (`consolidated_import.py:208-217`) — absent in a clean image | | High (B7) |
| Atlas allowlist | **UNVERIFIED** — need cluster tier (M0 free caps at 500 connections/512 MB), current allowlist, and whether the VPS IP is static |  | — |

---

## 7. SECURITY

### Auth flow
| Item | Finding | Evidence |
|---|---|---|
| Mechanism | HS256 JWT, Bearer header; **no cookies are set** anywhere → the Secure/HttpOnly/SameSite checklist is N/A. **VERIFIED (frontend):** access + refresh tokens are stored in `localStorage` (`frontend/src/lib/AuthContext.jsx:41-42`, `frontend/src/api/client.js:27-40`, `frontend/src/hooks/useAuditLog.js:33`), so XSS = token theft. **Mitigation adopted (branch `deploy/vultr-cloudflare`):** strict CSP (`script-src 'self'`) in `frontend/public/_headers`, access TTL 60→15 min, refresh TTL 30→7 d, refresh tokens revoked on password change/deactivation/logout. Residual risk accepted for now; HttpOnly cookies would be the long-term fix. | `security.py`; no `set_cookie` in repo |
| Expiry | Access 60 min, refresh 30 d; refresh rotated, last 5 SHA-256 hashes stored in `users.refresh_token_hashes` | `config.py`; `auth.py:32-37,81` |
| Claims | `sub, role, leader_id, exp, type`; no `jti/iss/aud`. Role & `is_active` re-read from DB per request, so stale-role tokens are harmless. | `security.py:15-27`; `dependencies/auth.py:11-26` |
| Password hashing | bcrypt, default cost 12 | `security.py:8` |
| Password policy | None (`password: str`) | `schemas/user.py:9` |
| Revocation | `update_user` (password change / deactivate) does not clear refresh tokens; deactivation only blocks via `is_active` check (acceptable) but a password change leaves old refresh tokens valid | `admin.py:103-130` |
| Login enumeration/PII | Failed-login log includes attempted email (`auth.py:44-45`); response is uniform (good) | Low |
| Bad ObjectId | Unvalidated `ObjectId(...)` → 500 instead of 400/401 (e.g. `dependencies/auth.py:~23`, `admin.py:104`); no global exception handler | Low |

### Authorization
| Item | Finding | Sev |
|---|---|---|
| KRA/KPI weightage **writes** | All admin-only (`kra.py:140-366`, `require_roles("admin")`) — **correct** | OK |
| `PUT /api/kra/weights` validation | `weights: dict[str,float]` — no sum==100, no min/max, negatives allowed, `category_id` keys not checked against `kra_categories` (`schemas/kra.py:20-24`; `kra.py:363-407`). Admin-only, but a typo silently corrupts scorecards. Upsert is non-atomic find-then-write (unique index backstops). | Medium |
| KRA reads | `leader_id` query param accepted with no `enforce_leader_scope`: any logged-in `user` can read any leader's KPIs/weights/competencies (`kra.py:119,184,263,346`) | Medium (IDOR/information disclosure) |
| `GET /api/leaders/{id}` | Any user, no scope (`leaders.py:26`) | Low-Medium |
| Scope on data routers | `enforce_leader_scope` / `enforce_leader_write_scope` pattern present; admin/management read-all by design; management write limited to own leader (`dependencies/auth.py:38-68`). Per-route coverage **UNVERIFIED** (see §1). | |
| Reads that write | `GET /appraisals/*` creates rounds; `GET /consolidated-summary` can import + write; startup/first-request FY sync writes | Low |
| Input validation / NoSQL injection | Pydantic models on most bodies, so operator-injection via JSON objects is mostly blocked; exceptions: raw `dict` bodies (`admin.py:190,214`) and `q` regex (P3). | Medium |

### Transport / headers / limits
| Item | Finding | Sev |
|---|---|---|
| CORS | Origins from `FRONTEND_ORIGIN` ✔, but default `allow_origin_regex=https://.*\.vercel\.app`, `allow_credentials=True`, `allow_methods/headers=["*"]` (`main.py:94-101`) | High (B4) |
| Security headers | None: no HSTS / nosniff / frame / CSP, no `TrustedHostMiddleware`, no gzip. Caddy can add HSTS/nosniff/frame headers at the edge (see §12). | Medium |
| Trust proxy | Not configured. Need `--proxy-headers --forwarded-allow-ips=<caddy>` and Caddy configured to trust Cloudflare ranges so client IP = `CF-Connecting-IP`. | High (B5) |
| Rate limiting | Only `/login` 5/min in-memory; `/refresh` unlimited; no per-account lockout; no `SlowAPIMiddleware` | High |
| File upload | No upload endpoints (`python-multipart` installed but unused) | OK |
| Docs exposure | `/docs`, `/openapi.json` public | Low-Medium |
| Sensitive logging | Request log is method+path+status only for ≥400 (`main.py:~86-92`); no tokens/bodies logged; email in failed-login log | Low |
| Request ID | Context var set but not logged/returned | Low |

### Dependency vulnerabilities — `pip-audit -r backend/requirements.txt --no-deps` (run 2026-10-01)
**19 findings in 2 packages**:
| Package | Installed | Advisories | Fixed in | Practical exposure |
|---|---|---|---|---|
| `python-jose` | 3.3.0 | PYSEC-2024-232, -233, PYSEC-2025-185 (+dupes) | 3.4.0 (2024-232/233); 2025-185 no fix listed | Code uses HS256 `jwt.encode/decode` only (`security.py`); the ECDSA-confusion and JWE-bomb classes are not on this path, but upgrade or migrate to PyJWT anyway. **High (hygiene)** |
| `python-multipart` | 0.0.17 | PYSEC-2026-1851/1852, 3036–3040 | up to **0.0.31** | No form/upload endpoints, but FastAPI imports it for form parsing; **upgrade to ≥0.0.31** (or remove if unused — `UploadFile`/`Form` appear nowhere). **High (hygiene)** |
Other pins (fastapi 0.138.0, motor 3.6.0, bcrypt 4.2.1, pydantic 2.10.3, uvicorn 0.32.1, httpx, slowapi, loguru): no advisories reported. `pip-audit` checked pinned versions only (no resolution of transitives, `--no-deps`) → transitive audit **UNVERIFIED**; rerun in a clean venv without `--no-deps`.

---

## 8. RELIABILITY & OPS

| Item | Finding | Sev | Blocking |
|---|---|---|---|
| `/health` | Exists, static, **no DB ping** (`main.py:131`) | Medium | Yes (B10) — add `/health/ready` with `db.command("ping")` (bounded timeout) |
| Graceful shutdown | uvicorn handles SIGTERM; `lifespan` calls `close_db()` (`main.py:~58`). Works under compose `stop_grace_period: 20s`. No in-flight task registry needed (no background jobs). | OK | No |
| Error handling | No global exception handler, default 500s; `ObjectId` parse errors → 500 | Low-Medium | No |
| Unhandled rejections | N/A (Python); audit-log inserts wrapped in `try/except` + warning (can silently drop audit events) | Low | No |
| Logging | loguru → stderr, INFO, text format (`main.py:44-45`). Not structured/JSON. | Low | No |
| Log rotation | None in app; rely on Docker `json-file` `max-size/max-file` in compose | Low | No |
| Restart policy | None in repo; set `restart: unless-stopped` | Medium | No |
| Outbound timeouts | No outbound HTTP calls. Mongo: serverSelection 5 s only; no socket timeout | Medium | No |
| Behavior if Mongo down | Startup: warns, serves; first query raises → 500 (no 503). Indexes never retried. | Medium | No |
| Persistent volumes | **None needed** for the API container (no disk writes) | OK | — |
| Timezone | Stored timestamps are `datetime.now(timezone.utc)` (~60 sites, consistent; no `utcnow`). API serializes UTC `Z` (`core/serialization.py`). IST helpers exist for audit filters. **Bug:** `date.today()` in `calendar_fy_slug` follows container TZ (`fiscal_year.py:12`). `ZoneInfo("Asia/Kolkata")` (`serialization.py`) requires `tzdata` — not in requirements (slim image usually ships system tzdata; Windows dev doesn't). | High for FY boundary | Yes (B8) |
| `_fy_synced` flag | One-shot per process (`database.py:~37`): a long-lived container will not re-sync FY after rollover until restart | Medium | No |

---

## 9. STATEFUL / LOCAL-DISK DEPENDENCIES

| Item | Impact on single VPS | Impact on Vercel/multi-instance |
|---|---|---|
| Rate limiter state (in-process, `core/limiter.py`) | Resets on restart; fine for single worker once client-IP is correct | Useless per instance |
| `_fy_synced`, `db`, `_client` module globals | Fine | Per-instance |
| Refresh tokens | In Mongo → survive restart ✔ | ✔ |
| Sessions/caches | None | None |
| Reads xlsx from disk (`consolidated_import.py:208-217`) | Missing in image → empty consolidated report until a `consolidated_summaries` doc exists in Mongo | Same |
| Runtime disk writes | **None** in `app/` | — |
| `backend/backend_server.log` | Local dev artifact; keep out of image | — |
| Container FS | Can be read-only (`read_only: true`, `tmpfs: /tmp`) | — |

---

## 10. BUILD / CI READINESS

| Item | Finding |
|---|---|
| Scripts | No `Makefile`/package scripts. Tests: `pytest` (`backend/pytest.ini`: `asyncio_mode=auto`). |
| Tests | 13 files / ~63 tests, **need live MongoDB** at `localhost:27017`, DB `cbva_test`; teardown `delete_many({})` on many collections. `os.environ.setdefault` means an exported prod `MONGODB_URL`/`DATABASE_NAME` is **not** overridden → destructive risk (`tests/conftest.py:7-9`). Not run in this pass (no local Mongo started) → pass/fail **UNVERIFIED**. No tests for `/health`, rate limiter, `PUT /kra/weights`. |
| Lint / typing | No ruff/flake8/mypy config found in `pyproject.toml` |
| Python pinning | `>=3.11` in pyproject; image 3.11; local 3.12–3.14 → pin 3.11 or 3.12 everywhere |
| Lockfile | Pinned `==` in `requirements.txt` ✔, no hashes; **two identical copies** (`requirements.txt`, `api/requirements.txt`) can drift; dev deps split in `requirements-dev.txt` ✔ but prod file still contains `httpx/pytest/pytest-asyncio/mangum`-class items inconsistently (uvicorn missing) |
| CI | **None** (no `.github/`); remote `github.com/Qlink149/cbva` |
| Suggested workflow | See §12.6 |

---

## 11. FIX LIST (proposals only — nothing applied)

### P0 — before deploy
| # | File | Issue | Exact fix | Effort |
|---|---|---|---|---|
| 1 | `backend/requirements.txt` | uvicorn missing | Add `uvicorn[standard]==0.32.1`; move `httpx/pytest/pytest-asyncio/mangum` to dev (or drop `mangum`); add `openpyxl` and `tzdata` | 10 min |
| 2 | `backend/.dockerignore` (new) | Local files baked in | Exclude `.env*`, `.venv`, `.git`, `db/`, `csv/`, `scripts/`, `tests/`, `*.log`, `.pytest_cache`, `__pycache__`, `docker-compose.yml` | 10 min |
| 3 | `backend/Dockerfile` | root, no healthcheck, no proxy headers | Multi-stage, non-root, `HEALTHCHECK`, `CMD uvicorn … --proxy-headers --forwarded-allow-ips …` | 45 min |
| 4 | `app/core/config.py:6` | default SECRET_KEY | Remove default; validator raising on empty/default/`<32` chars | 15 min |
| 5 | `app/core/config.py:14`, `main.py:94-101` | `*.vercel.app` + credentials | Default regex `None`; restrict `allow_methods/headers` to used set; confirm `FRONTEND_ORIGIN=https://app.<domain>` | 20 min |
| 6 | `app/core/limiter.py`, `auth.py:40,81` | Proxy-IP bucket; refresh unlimited | `key_func` reads `CF-Connecting-IP` only when peer is Caddy; add per-email key; limit `/refresh` | 1 h |
| 7 | prod DB + `scripts/` | Demo creds / no admin / no KRA seed | Query prod `users` read-only for `admin@cbva.com`,`mm@`,`vc@`; rotate/disable; add tracked `create_admin` + `ensure_kra_seed` bootstrap command | 2–3 h |
| 8 | `services/fiscal_year.py:12` | UTC vs IST FY boundary | `date.today()` → `datetime.now(IST).date()`; set `TZ=Asia/Kolkata` in compose | 15 min |
| 9 | `app/main.py:131` | Health ignores DB | Add `/health/ready` w/ Mongo ping; use for Docker healthcheck, keep `/health` as liveness | 20 min |
| 10 | `app/core/database.py:13-16` | No pool/timeouts | Add `maxPoolSize=10, minPoolSize=1, maxIdleTimeMS, connectTimeoutMS, socketTimeoutMS, retryWrites` | 20 min |
| 11 | `requirements.txt` | CVEs | `python-jose>=3.4.0` (or PyJWT), `python-multipart>=0.0.31` (or remove); re-run pip-audit; run tests | 1 h |
| 12 | consolidated xlsx | File absent in image | Either seed `consolidated_summaries` in prod Mongo before launch, or ship the xlsx via volume; document | 1 h |

### P0 status on branch `deploy/vultr-cloudflare` (backend `e7249bd`, frontend `83dbcec`, deploy `24cdfe5`, test `d7d2072`)

| # | Status | Notes |
|---|---|---|
| 1 requirements | **Fixed** `e7249bd` | uvicorn/openpyxl/tzdata added; dev deps split; `python-multipart` removed (unused). `python-jose` **replaced by PyJWT 2.15.0**: `pip-audit` *without* `--no-deps` also flagged `pyasn1 0.4.8` (python-jose caps it `<0.5`, so it was unfixable) and `ecdsa` (no fix). `pip-audit -r requirements.txt` now reports no known vulnerabilities. `api/requirements.txt` synced (Vercel shim). |
| 2 .dockerignore | **Fixed** `e7249bd` | |
| 3 Dockerfile | **Fixed (build UNVERIFIED)** `e7249bd` | Docker Desktop's engine would not start on this machine, so `docker build`, image size, the `read_only` container run and `docker stats` were **not run**. Base image is a tag (`python:3.11-slim`), **not digest-pinned** (needs a pull). |
| 4 SECRET_KEY | **Fixed** `e7249bd` | validator + tests |
| 5 CORS | **Fixed** `e7249bd` | exact origins, no credentials; methods include **PATCH** (routers use it; the brief omitted it). Preflight tests pass. |
| 6 Rate limiting | **Fixed** `e7249bd` | `CF-Connecting-IP` key, per-email throttle (10 per 15 min, in-process), `/refresh` 30/min |
| 7 Demo creds / bootstrap | **Partially fixed** `e7249bd` | `python -m app.cli bootstrap` and `check-demo-users [--deactivate]` added. Leaders are **not** created (need real data). Live prod DB **not checked** (UNVERIFIED). |
| 8 FY in IST | **Fixed** `e7249bd` | boundary tests at 31 Mar 18:29 / 18:30 UTC. The other 16 `date.today()` call sites (bluesky, collections, engagements, consolidated, firmwide, `fy_calendar`) were server-local; **now all use `today_ist()`** (`2d67113`), with an AST test that bans naive clock calls in `app/`. (An earlier version of this row claimed `TZ=Asia/Kolkata` covered them; that depends on the base image shipping system tzdata and was not verifiable.) |
| 9 /health/ready | **Fixed** `e7249bd` | 200 with Mongo up; 503 in ~2 s with Mongo stopped; recovers after restart (run locally against a portable `mongod`, not in Docker) |
| 10 Mongo options | **Fixed** `e7249bd` | pool/timeouts/retryWrites; index creation retries (3 attempts, then a rate-limited retry on later requests) |
| 11 xlsx / consolidated | **Fixed** `e7249bd`, `d7d2072` | `/api/consolidated-summary` returns 503 with a clear message when neither the DB doc nor the xlsx exists. The doc must be seeded in prod Mongo. |
| 12 CVEs | **Fixed** | see #1 |

Other §11 items closed in the same commit: #20 (refresh tokens revoked on password change/deactivation), #22 (conftest refuses non-`_test` DB), #24 (`.env.example` tracked), part of #18 (docs disabled when `ENV=prod`). Still **Open**: bcrypt on the event loop (#13), KRA/leader read scope (#14), weights validation (#15), audit export streaming/regex (#16), audit TTL (#17), N+1s (#19), extra indexes (#21), API-level security headers (covered at Caddy), structured logging.

Test results (local `mongod` 7.0.14, Python 3.12), final: **145 passed, 1 skipped, 0 failed**. Three tests had failed identically on the pre-change commit `d037ef0` (they wrote FY `2526` data as a non-admin; that FY has no editable doc and is month-locked since Apr 2026). They now seed an editable current-calendar FY; one stale test (`test_audit_api_leader_scoping`, audit-log is admin-only) is skipped with a reason and replaced by `test_audit_api_is_admin_only` (`9c637ff`). See `VERIFICATION_REPORT.md`.

Live smoke run (uvicorn, `ENV=prod`, not in Docker): `/docs` and `/openapi.json` → 404; unauthenticated API calls → 401; 10 authenticated endpoints → 200; worker RSS about 100 MB afterwards (Windows working set, indicative only).

### P1 — first week
| # | File | Issue | Fix | Effort |
|---|---|---|---|---|
| 13 | `security.py`, `auth.py:44`, `admin.py:79` | bcrypt blocks loop | `await asyncio.to_thread(...)` | 20 min |
| 14 | `kra.py:119,184,263,346`; `leaders.py:26` | No leader scope on reads | Call `enforce_leader_scope` | 30 min |
| 15 | `schemas/kra.py:20-24`; `kra.py:363` | Weights unvalidated | Validate keys ∈ categories, 0≤w≤100, Σ=100 per layer | 1 h |
| 16 | `audit.py:209-221`, `audit_service.py` | 10k-doc export, regex | Stream via cursor + csv writer; `re.escape(q)`; anchor/limit; cap export 5k | 2 h |
| 17 | `audit_service.py` / `database.py` | No audit retention | TTL index or archive job (e.g., 400 d) | 1 h |
| 18 | `main.py` | No headers/docs open/global handler | Security-headers middleware (or Caddy), disable `/docs` in prod (`docs_url=None`), exception handler → JSON 500 + request_id | 1.5 h |
| 19 | `consolidated_service.py:348`, `firmwide_service.py:167` | N+1 | `asyncio.gather` / `$in` + `$group` | 3 h |
| 20 | `admin.py:103` | Tokens survive password change | `$set refresh_token_hashes: []` on password change/deactivate | 15 min |
| 21 | `database.py` | Missing indexes; retry on startup failure | Add `financial_years.slug` unique, `leaders.is_active`, `created_at` sorts; retry index build | 1 h |
| 22 | `tests/conftest.py:7-9` | Can wipe real DB | Hard-fail unless `DATABASE_NAME.endswith("_test")` | 10 min |
| 23 | `.github/workflows` (new) | No CI | See §12.6 | 1.5 h |
| 24 | `backend/.gitignore:8` | `.env.example` ignored | Add `!.env.example`, commit template | 5 min |

### P2 — later
Structured JSON logging with request_id; pagination + `total` on capped lists; drop/merge duplicate `api/requirements.txt`; pip-compile with hashes; remove Vercel shim if abandoned; password policy; Sentry/uptime monitor; `engagement_change_log` index cleanup; pin one Python version; admin `dict` bodies → pydantic; per-route leader-scope test sweep.

---

## 12. DELIVERABLE DRAFTS (outlines below; the real files are now `backend/Dockerfile`, `deploy/`, `.github/workflows/deploy.yml` on branch `deploy/vultr-cloudflare`)

### 12.1 Dockerfile outline
```dockerfile
FROM python:3.11-slim@sha256:<pin> AS build
WORKDIR /w
COPY requirements.txt .
RUN python -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt
FROM python:3.11-slim@sha256:<pin>
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 MALLOC_ARENA_MAX=2 TZ=Asia/Kolkata PATH=/venv/bin:$PATH
RUN useradd -r -u 10001 app
WORKDIR /app
COPY --from=build /venv /venv
COPY app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/ready',timeout=4).status==200 else 1)"
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","1","--proxy-headers","--forwarded-allow-ips","*","--no-access-log"]
```
(`--forwarded-allow-ips *` is acceptable only because port 8000 is not published; Caddy is the sole peer on the compose network.)

### 12.2 `.dockerignore`
`.env*`, `.venv/`, `.git/`, `db/`, `csv/`, `scripts/`, `tests/`, `**/__pycache__`, `*.log`, `.pytest_cache/`, `docker-compose.yml`, `*.md`

### 12.3 docker-compose.yml outline
Services: `api` (image `ghcr.io/<org>/cbva-api:${TAG}`, `env_file: .env`, `restart: unless-stopped`, `mem_limit: 700m`, `cpus: 1.0`, `read_only: true`, `tmpfs: [/tmp]`, `stop_grace_period: 20s`, `healthcheck` as above, `logging: json-file max-size 10m max-file 3`, **no `ports`**), `caddy` (`caddy:2`, ports 80/443, volumes `caddy_data`, `caddy_config`, `./Caddyfile`, `depends_on: api healthy`, same logging). Single user-defined network. No Mongo service.

### 12.4 Caddyfile outline
```
api.example.com {
  encode zstd gzip
  reverse_proxy api:8000 { health_uri /health/ready  health_interval 30s }
  header { Strict-Transport-Security "max-age=31536000"; X-Content-Type-Options nosniff; X-Frame-Options DENY; Referrer-Policy no-referrer; -Server }
  # trusted_proxies: Cloudflare ranges (global option) so real client IP = CF-Connecting-IP
}
```
Cloudflare: SSL mode **Full (strict)**; DNS-01 or HTTP-01 (grey-cloud first issuance, then proxy); restrict origin 80/443 to Cloudflare IP ranges in ufw if desired.

### 12.5 VPS bootstrap outline
`ufw default deny incoming; allow 22,80,443; enable` · create non-root sudo user, copy key, `PasswordAuthentication no`, `PermitRootLogin no` · `fallocate -l 2G /swapfile && mkswap && swapon`, `vm.swappiness=10` · install Docker CE + compose plugin · `apt install fail2ban unattended-upgrades` · `timedatectl set-timezone Asia/Kolkata` · create `/opt/cbva` with `.env` (chmod 600).

### 12.6 GitHub Actions outline
Jobs: `test` (services: `mongo:7`; Python 3.11; `pip install -r requirements.txt -r requirements-dev.txt`; `pytest`; `pip-audit`) → `build` (buildx, push `ghcr.io/…:sha` + `latest`) → `deploy` (SSH key secret; `cd /opt/cbva && TAG=<sha> docker compose pull && TAG=<sha> docker compose up -d && docker image prune -f`; poll `/health/ready`; auto-rollback to previous TAG on failure). Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `GHCR_TOKEN`.

### 12.7 Mongo Atlas / allowlist checklist
- [ ] Reserve a static IPv4 on Vultr; add only that `/32` to Atlas Network Access (remove `0.0.0.0/0`)
- [ ] Dedicated DB user, `readWrite` on `cbva` only; no admin role; strong password in `.env`
- [ ] Confirm tier (M0 limits: 500 conns, 512 MB) — **UNVERIFIED**; check region latency (Mumbai `ap-south-1` ideal)
- [ ] Enable backups / PITR; test one restore into a scratch DB
- [ ] Rotate any credential that ever lived in local `.env` (`MONGODB_URL_PROD_READ`)
- [ ] Alerts: connections, disk, replication lag
- [ ] After first start verify indexes exist (`db.engagements.getIndexes()`) and `kra_categories` count > 0

### 12.8 Rollback steps
1. Keep last 3 image tags (`TAG` pinned in `/opt/cbva/.env`, previous in `.env.prev`).
2. `TAG=<prev> docker compose up -d api` → verify `/health/ready`.
3. Schema is additive (no migrations in code) → no DB rollback; for data issues restore from Atlas snapshot into a new DB and flip `DATABASE_NAME`.
4. Cloudflare: if API is hard-down, switch the frontend maintenance banner; DNS TTL ≤ 300 s.

---

## First 10 commands to run on the VPS
```bash
1.  apt update && apt -y upgrade && apt -y install ufw fail2ban unattended-upgrades curl ca-certificates
2.  adduser --disabled-password --gecos "" deploy && usermod -aG sudo deploy && mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
3.  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl reload ssh
4.  ufw default deny incoming && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
5.  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab && sysctl vm.swappiness=10
6.  curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy
7.  timedatectl set-timezone Asia/Kolkata && systemctl enable --now fail2ban
8.  mkdir -p /opt/cbva && chown deploy:deploy /opt/cbva   # then as deploy: place docker-compose.yml, Caddyfile, .env (chmod 600)
9.  echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin && cd /opt/cbva && docker compose pull && docker compose up -d
10. docker compose ps && curl -fsS https://api.<domain>/health/ready && docker stats --no-stream   # expect api < ~200 MB
```

---

### Appendix — what was and wasn't checked
Verified by reading code: routers/auth dependencies, config, database module, Dockerfile/compose, gitignore/history, security module, FY helper, KRA weights schema. Ran `pip-audit` (pinned, no transitives). **Not run / UNVERIFIED:** Docker build and image size, test suite (needs Mongo), live prod DB contents (demo users, KRA seed, indexes), Atlas tier/allowlist, frontend token storage, per-route leader-scope sweep, empty-string CORS regex parsing, transitive CVEs.

---

## 13. FRONTEND (Vite 6 + React 18 SPA → Cloudflare Pages)

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | `VITE_API_URL ?? 'http://localhost:8000'` silent fallback in two places (`src/api/client.js:3`, `src/hooks/useAuditLog.js:4`): a prod build without the variable would call localhost | High | **Fixed** `83dbcec`: single `src/lib/apiBase.js`; fallback only under `vite dev`; `vite.config.js` fails production builds when `VITE_API_URL` is missing or contains localhost/127.0.0.1. Verified: build fails without it, fails with `http://localhost:8000`, succeeds with `https://api.example.com`. |
| F2 | Tokens in `localStorage` (XSS = token theft) | Medium | **Mitigated**: CSP + 15 min / 7 d TTLs (see §7). Residual risk open. |
| F3 | No CSP or security headers on the SPA | Medium | **Fixed** `83dbcec`: `public/_headers`. Verified with headless Chromium on the production build over all 21 routes: **0 CSP violations**. A negative control with the Google Fonts and `media.base44.com` allowances removed produced 136 violations, so the check is sensitive. API calls were mocked at `https://api.example.com`, so CSP behaviour against the real API is **UNVERIFIED**. |
| F4 | `src/lib/app-params.js` (Base44 leftover) | Low | **Fixed**: no importers; deleted. `@base44/vite-plugin` (still wired in `vite.config.js`) and `@base44/sdk` (no imports under `src/`) are **left in place**; not verified safe to remove. |
| F5 | Logo and favicon hot-linked from `media.base44.com` (6 places plus `index.html`); needs `img-src https://media.base44.com` in the CSP and breaks if Base44 removes the asset | Medium | **Open**: vendor the logo into `public/` and drop the CSP entry |
| F6 | Google Fonts `@import` (`src/index.css:1`) needs `style-src fonts.googleapis.com` and `font-src fonts.gstatic.com` | Low | **Open** (allowed in the CSP; self-host fonts to tighten) |
| F7 | `index.html` links `/manifest.json` but there was no `public/manifest.json`; with the SPA `_redirects` rule it returns `index.html` | Low | **Open** |
| F8 | `frontend/dist` and `frontend_server.log` artifacts | Low | **No issue**: both gitignored and untracked (`git ls-files` clean) |
| F9 | Logout and refresh flow | n/a | **Verified by reading, no change needed.** Logout POSTs `/api/auth/logout`, then clears both tokens and redirects (`AuthContext.jsx:46-57`). Concurrent 401s queue behind one refresh, `_retry` prevents loops, login/refresh requests never trigger a refresh, and a failed refresh clears both tokens and redirects to `/home` (`client.js:15-22, 58-96`). Axios has no `withCredentials`, so `allow_credentials=False` on the API is safe. Not exercised against a live API (UNVERIFIED). |
| F10 | `frontend/.env.example` was swallowed by the `.env.*` gitignore rule | Low | **Fixed** `83dbcec` |
