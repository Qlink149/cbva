# Verification report: branch `deploy/vultr-cloudflare`

Scope: verification of commits 83dbcec, e7249bd, 24cdfe5, d7d2072, 8c4f7cb (base d037ef0) plus the fixes made while verifying
(first pass HEAD `21c17df`; container pass HEAD `a3c2871` + the base-image digest pin). Machine: Windows 10, non-elevated shell. Backend tests ran against a portable MongoDB 7.0.14 on Python 3.12; the
browser checks used headless Chromium (Playwright) against the production build.

**Headline (updated 2026-10-03): the Docker engine now runs, and the container checks that were NOT RUN in the first pass have been executed for real. All of section 1 passes except the items listed as still NOT RUN.** The first pass had no engine (see section 0); those rows are rewritten below with the actual output.
Statuses: PASS / FAIL / NOT RUN. "Fix" is the commit that fixed a defect the check exposed.

## Live-data safety audit (2026-10-03, against a verification copy of prod)

Report only: no application behaviour was changed. Database used: **`cbva_verify`**, a full copy of prod (29 collections, 2660 documents, prod's indexes),
reached only through environment variables in this session; the connection string is not written in any file, commit or report.
Prod was never contacted. `python -m app.cli bootstrap` and `check-demo-users --deactivate` were **not** run.
All file:line references are at HEAD `bea2efa` (backend code unchanged since `2509a1a`).

### 1. Every database write the backend can perform

**(a) Startup and the first request of a process.** `lifespan` (`app/main.py:53-57`) and, on every non-`/health` request, `ensure_db_middleware` -> `ensure_db_connected` (`app/main.py:88-91`, `app/core/database.py:59`), plus `GET /health/ready` when not yet connected (`app/main.py:148-154`).

| Write | Collection / filter | Can modify or delete existing docs? | Idempotent? | Evidence |
|---|---|---|---|---|
| 44 x `create_index` | every collection in `app/core/database.py:85-161` | no data change; creating an index that already exists with the same name, keys and options is a no-op | yes | `_create_indexes`, called by `connect_db` (`database.py:38`) via `_create_indexes_with_retry` (`database.py:18`) |
| `drop_index("fiscal_year_1_leader_id_1_category_id_1")` | `kra_weight_config` | drops that legacy index **if present** (no data) | yes | `database.py:143` (in try/except) |
| `update_one {_id: calendarFY} $set is_editable:true` | `financial_years`, only if current FY == calendar FY and `is_editable` is null | yes, one field | yes | `app/services/fiscal_year.py:105` |
| `update_many {} $set is_current:false` + `update_one {_id: calendarFY} $set is_current,is_editable` + `update_many {slug != cal, is_editable missing/null} $set is_editable:false` | `financial_years`, only when the registry's current FY is **behind** the calendar FY (never pulls it backward) | yes (flags + `updated_at`) | yes | `fiscal_year.py:116, 120, 131`; guard `fiscal_year.py:111-113` |

**(b) Inside GET handlers** (static call graph from every `@router.get`, confirmed by the live run).

| GET endpoint | Write | Can modify existing? | Idempotent? | Evidence | In live `d037ef0`? |
|---|---|---|---|---|---|
| `/api/appraisals/rounds`, `/api/appraisals/scorecard` | `appraisal_rounds.insert_one` for each of the 4 round types missing for (fiscal_year, leader_id); no check that the leader exists | **no** (insert only) | yes (only inserts what is missing; a race between two requests gets a DuplicateKeyError from the unique index, data stays correct) | `app/routers/appraisals.py:66-90` (insert `:85`), called at `:112`, `:237` | yes |
| `/api/pipeline/` | `pipeline_snapshots.update_one(..., upsert=True)` on {leader_id, fiscal_year, snapshot_type, label}: current month = live engagement totals, past months = consolidated rows; `$set` amounts, `sort_order`, `updated_at` | **yes** | values yes (repeat call changed only `updated_at`, see 6); `updated_at` changes every call | `app/routers/pipeline.py:71` -> `app/services/engagement_derivation.py:162`, `:136`, `:158` | yes |
| `/api/pipeline/` | `collection_entries.update_one(..., upsert=True)` on {leader_id, fiscal_year, month} for months with planned > 0: `$set planned, sort_order, updated_at`, `$setOnInsert collected:0, variance, created_at` | **yes** (`planned`, `sort_order`, `updated_at`; never `collected`) | same as above | `engagement_derivation.py:235-253` | yes |
| `/api/consolidated-summary/` | `consolidated_summaries.update_one(upsert)` + one `audit_log` insert, **only** if no document exists for `report_fy` **and** the xlsx exists on disk (it is not in the image) | inserts only in practice | yes | `app/services/consolidated_service.py:310-331` | yes |
| any GET (first one per process) | the startup writes of (a) | see (a) | see (a) | middleware | yes |

No other GET handler writes (checked for `/api/collections`, `/bluesky`, `/el-summary` and the rest: the hash diff in 6 shows no other collection changed).

**(c) CLI commands** (`app/cli.py`).

| Command | Writes | Modifies existing? | Evidence |
|---|---|---|---|
| `bootstrap` | exits with code 2 before connecting if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are missing (`cli.py:41-44`); otherwise `connect_db` (indexes, a), `users.insert_one` if the email is not a user yet (`:55`), `ensure_kra_seed` (`:72`: four `update_many`/`update_one` migrations on docs **without** `layer` and inserts into empty KRA sets, `app/services/kra_seed.py:265-350`), `financial_years.insert_one` if the calendar FY is missing (`:78`), FY sync (`:90`) | the KRA `layer` migrations would modify existing docs if any lacked `layer` | see 4 |
| `check-demo-users` (read-only) | **`connect_db` runs index creation** (`cli.py:110`), i.e. it is not strictly read-only, though a no-op when indexes exist (as here) | no | `cli.py:109-110` |
| `check-demo-users --deactivate` | `users.update_one {_id} $set is_active:false, refresh_token_hashes:[]` per matched account | **yes** | `cli.py:126-128` |
| `verify-indexes` | none (records `_create_indexes` against a stand-in object; reads with its own client) | no | `cli.py:164-200` |
| `verify-indexes --create` | `connect_db` -> index creation | no data | `cli.py:202-203` |
| `compare-counts` | none | no | `cli.py` |

**For completeness, auth writes** (POST, exercised in the live run): login `users.update_one $push refresh_token_hashes ($slice -5)` and `$set last_login` + `audit_log` insert (`app/routers/auth.py:34, 54, 60`); refresh `$pull` + `$push` (`:102`, `:34`); logout `$set refresh_token_hashes: []` (`:120`). All other POST/PUT/PATCH/DELETE handlers are explicit user edits.

### 2. Indexes

The code issues 44 `create_index` and 1 `drop_index` (`app/core/database.py:85-161`). Read with `list_indexes` on `cbva_verify`:

- **All 44 already exist with the same name, key pattern and uniqueness** -> every `create_index` is a no-op. None missing; no name or option conflict (which would make `createIndex` fail).
- The `drop_index` target `kra_weight_config.fiscal_year_1_leader_id_1_category_id_1` is **not present** -> no-op.
- 7 indexes exist in the DB that the code does not create; they are **left untouched**: `headcount_plans.leader_id_1_designation_1` (unique), `hiring_requirements.leader_id_1_status_1`, `kpi_definitions.fiscal_year_1_category_id_1_sort_order_1`, `leadership_competencies.sort_order_1`, `team_members.leader_id_1_status_1`, `team_members.leader_id_1_is_manager_1`, `team_members.leader_id_1_sort_order_1`.
- Read-only `$group` duplicate check for all **13 unique indexes** (missing fields grouped as null, as a unique index does): **no duplicates** in any (users.email 13 docs, engagements (leader_id, fiscal_year, num) 513, pipeline_snapshots (leader_id, fiscal_year, label) 83, blue_sky_entries 21, collection_entries 133, headcount_plans 81, baseline_plans 0, el_summaries 0, consolidated_summaries 2, kra_weight_config 12, appraisal_rounds 12, kpi_ratings 0, competency_ratings 0).
- The index list in `_create_indexes` is **unchanged since `d037ef0`** (the only diff is the retry wrapper `database.py:18-35`), so the live Vercel backend already issues the same calls on every cold start.
- Live confirmation: `verify-data.sh` index diff before vs after the API start and the full run: **identical, none created, dropped or changed**.

### 3. Compatibility with `d037ef0` (live on Vercel) and side-by-side running

Diff `d037ef0..HEAD -- backend/app` (19 files). Data-relevant findings:

| Area | Change | Effect on existing data | Side by side |
|---|---|---|---|
| Document shapes, field names, enums | **none**: `app/schemas/*` and `app/services/audit_service.py` unchanged; no router changes a stored field name or enum value | none | safe |
| Index set | unchanged (2) | none | safe: both issue identical no-op `create_index` |
| GET-time writes (1b) | unchanged; they already happen on the live backend | none new | both upsert the same keys; a simultaneous upsert can raise one DuplicateKeyError (HTTP 500, retry succeeds), as already possible between two Vercel instances |
| "Today" / FY logic | `date.today()` (server-local; **UTC on Vercel**) -> `today_ist()` in 16 places (`app/core/serialization.py`, `fy_calendar.py:16,37,...`, `engagements.py:118,205,393`, `collections.py:51,120`, `bluesky.py:121,180`, `consolidated_service.py:93`, `engagement_derivation.py:189`, `firmwide_service.py:195`) and `calendar_fy_slug` (`fiscal_year.py:12`) | the new backend is correct for India; the old one lags by 5h30 (it still thinks it is "yesterday" between 00:00 and 05:30 IST) | **differs only between 00:00 and 05:30 IST**: (i) on the last night of a month the two disagree on the "current month": engagement saves add blue-sky deltas / auto pipeline snapshots to month M (old) vs M+1 (new) (`engagements.py:118-122, 205-210`), and `GET /api/pipeline/` writes live totals to a different monthly snapshot; (ii) on the 20th the month lock starts at 00:00 IST (new) vs 05:30 IST (old) (`fy_calendar.py` `is_month_locked`); (iii) 1 April: the new backend advances `is_current` at 00:00 IST, the old one cannot pull it back (guard `fiscal_year.py:111-113`), so no flip-flop |
| Auth tokens | PyJWT instead of python-jose, HS256 unchanged; new tokens add `jti`; TTL 15 min / 7 d (old 60 min / 30 d) (`app/core/security.py`) | none | tokens cross backends only if both share `SECRET_KEY` (not required). Both write the same `users.refresh_token_hashes` array (keep last 5): a user active on both sides can be logged out early; a logout on either side clears all refresh tokens (`auth.py:120`). Harmless |
| Admin user update | password change / deactivation also clears `refresh_token_hashes` (`app/routers/admin.py:110-112, 141-143`) | that field only | harmless |
| Consolidated summary | new returns 503 instead of an empty matrix when neither the document nor the xlsx exists (`app/routers/consolidated.py`) | none (both FYs `2627`, `2526` are seeded) | safe |
| Startup | index retry wrapper; FY sync unchanged | none (2, and 6: no change at startup) | safe |

### 4. `python -m app.cli bootstrap` must NOT be run against this (or the live) database

It is not needed (data exists) and its writes are not all reversible. Prediction from read-only queries on `cbva_verify` (not executed):
- **`users.insert_one`**: a **new admin account** for `ADMIN_EMAIL` if that email is not already a user (`cli.py:55`). This is the only write it would make on today's data.
- `ensure_kra_seed`: migrations would `update_many` docs lacking `layer` (currently 0 kpi_definitions, 0 kra_weight_config, 0 leadership_competencies); seed inserts only into empty sets (currently kra_categories 4, competencies all_time 4, weights all_time 4, weights fy 2627/2526 4 each, kpi_definitions all_time 17: none empty).
- `financial_years.insert_one` only if the calendar FY is missing (`2627` exists); FY sync is a no-op (current = 2627, editable).
- Index creation: no-op (2).
Rule: run it only on an **empty** database (first install). On a populated database, create admins through the admin UI/API.

### 5. `deploy/verify-data.sh` (committed `bea2efa`)

Read-only by construction (only `listCollections`, `countDocuments`, `find`, `listIndexes`); URI and DB name from the environment only, passed to `docker run --rm mongo:7` with `-e VAR` (never on a command line); prints the host, never the credentials. Modes `counts`, `snapshot` (per-document md5 of canonical EJSON), `indexes`, `compare` (count deltas vs `counts-before.txt`; documents created or modified in the last N minutes via the `_id` ObjectId timestamp and any top-level Date field; with a snapshot, the exact created/changed/deleted `_id`s; with an index file, the index diff). Exit 0 = no differences, 1 = differences. `shellcheck` clean. Self-test against `cbva_verify` before the run: 29 collections, 2660 docs, 80 indexes, immediate compare -> **no differences**.

### 6. Live run on `cbva_verify`

Setup: the exact image built from HEAD (`cbva-api:verify`, non-root, `--read-only --tmpfs /tmp`, `ENV=prod`, `EDGE_MODE=direct`), bound to 127.0.0.1 only. Timeline (UTC): baseline 13:31; API start 13:36:04; temporary admin + sweep 13:38:16; API stopped and temporary admin deleted 13:39:52.

1. **API startup alone** (before any request): `verify-data.sh compare` -> **no differences** (no document, no index). Startup log: `MongoDB connected and indexes ensured.`
2. **Documented temporary admin**: one user inserted directly into `cbva_verify` (`email verify-temp-admin@example.com`, role admin, random password kept only in a local scratch file), used for the real auth flow: login 200, refresh 200, `/api/auth/me` 200, logout 204; deleted afterwards (`deleted_count=1`). (A first attempt with an `@example.invalid` address was rejected by email validation with 422 before any handler ran; that user was deleted and recreated with the `example.com` address.)
3. **Existing users**: existing admin `_id 6a4f6270ac9848e840a693b3` and existing non-admin `_id 6a5885f57b43fda7e5e4146e` (role user, leader `vinay`) were exercised with access tokens **signed by the local run's SECRET_KEY** (their passwords are unknown; this also avoided writing `last_login`/refresh hashes into real accounts). Every GET was called once per role: **48 requests each**; admin 46 x 200 + 2 x 400; user 30 x 200 + 16 x 403 (admin/management-only endpoints, correct) + 2 x 400. The two 400s are `/api/kra/kpis` and `/api/kra/weights` without `fiscal_year` (`"fiscal_year required for FY layer"`); re-called with `layer=fy&fiscal_year=2627`: 200 for both roles. API log: no errors.
4. **`verify-data.sh compare` after the run**: counts `appraisal_rounds 12 -> 16`, `audit_log 1304 -> 1305`, `pipeline_snapshots 83 -> 84`, everything else unchanged; **6 created, 6 changed, 0 deleted; indexes identical**.

| Document | Change | Explanation |
|---|---|---|
| `appraisal_rounds` `6ac1054fcb1279f9a285d71c`, `...d71d`, `...d71e`, `6ac10550cb1279f9a285d71f` | **created**: `vinay` / `2627` / `self_midyear`, `mgmt_midyear`, `self_yearend`, `mgmt_yearend`, `state: open` | `GET /api/appraisals/rounds` (`appraisals.py:85`): `vinay` had no rounds for 2627 (only manan, np, priyesh did). Insert-only. The live backend creates the same 4 rows the first time anyone opens that leader's scorecard |
| `audit_log` `6ac1054ecb1279f9a285d71b` | **created**: `entity_type auth`, `action login`, `entity_id` = the temporary admin | the temporary admin's login (`auth.py:60`). Left in place (the user was deleted; this row was not) |
| `pipeline_snapshots` `6ac10561959e9ffb6c548c4b` | **created**: `vinay` / `2627` / monthly `October 2026` | `GET /api/pipeline/` (`engagement_derivation.py:136`): no October snapshot existed yet for vinay; current month = live engagement totals |
| `pipeline_snapshots` `6a51e81e329c42edda8a9268` (April), `...9269` (May), `...926a` (June), `6a4f65e29fa28cb6c2d9001c` (July 2026) | **changed** | `GET /api/pipeline/` re-materialises past months from the consolidated rows (`$set` amounts, `sort_order`, `updated_at`) |
| `collection_entries` `6a4f65e29fa28cb6c2d90020` (July), `6a4f65e39fa28cb6c2d90021` (August 2026) | **changed** | `GET /api/pipeline/` sets `planned` (4,722,000 / 4,848,000 from engagement monthly plans), `sort_order`, `updated_at` (`engagement_derivation.py:235`); `collected` is never touched |
| `users` (temporary admin) | created then deleted (net 0) | step 2 |

Field-level check: the same `GET /api/pipeline/` was repeated once with full documents dumped before and after. **Only `updated_at` changed** on those 7 documents; every amount, `planned` and `sort_order` value was identical. So the values are deterministic from engagements + consolidated rows. Whether the **first** call changed any amount relative to prod's stored values cannot be proven from the hash baseline (it stores hashes, not documents); since the same code runs on the live backend on every pipeline page view, values differ only if engagements or consolidated rows changed after the leader's page was last opened on the live system.

No change at all to: `users` (real accounts), `financial_years`, `engagements`, `collection_transactions`, `blue_sky_entries`, `consolidated_summaries`, KRA collections, `leaders`, or any index.

### 7. `check-demo-users` (read-only) on `cbva_verify`

`WARNING: demo account admin@cbva.com role=admin [ACTIVE]`, exit 1, nothing changed (the compare above covers this step).
**Security finding (critical, outside the deploy itself):** a read-only `bcrypt.checkpw` on that account's stored hash shows it **matches a well-known seed default password** (value withheld here). The account is the first admin, active, `last_login 2026-09-30`. If prod matches this copy, the live admin account is protected only by a published default password. Rotate its password now (it is in use, so do not deactivate it blindly), then consider moving people to personal admin accounts.

### Verdict

**(a) Running the new backend against the live database: SAFE WITH CONDITIONS.**
Startup changes nothing (indexes identical, FY flags already correct); GET traffic produces exactly the writes the live backend already produces (appraisal rounds on first scorecard view, pipeline/collection re-materialisation); no deletes; no shape or enum change.
Conditions:
1. Do **not** run `python -m app.cli bootstrap` (it would add an admin account); do not run `check-demo-users --deactivate` until you have decided what to do with `admin@cbva.com`.
2. **Rotate the `admin@cbva.com` password** (default password, see 7).
3. Take an Atlas snapshot (or `mongodump`) of prod immediately before the switch, plus a `verify-data.sh counts` / `snapshot` / `indexes` baseline; run `verify-data.sh compare` after the first hour.
4. Accept that `GET /api/pipeline/` and the appraisal GETs write (existing behaviour of the live app, now documented).
5. Use a new random `SECRET_KEY` (>= 32 chars) and the prod `DATABASE_NAME`; never point tests at it (the test-DB guard refuses remote URLs).

**(b) Running old (Vercel `d037ef0`) and new side by side on the same database: SAFE WITH CONDITIONS.**
No conflicting writes: same indexes, same shapes, same GET-time writes; FY advance cannot flip-flop.
Conditions:
1. Keep the overlap short and avoid edits between **00:00 and 05:30 IST** (especially on the last night of a month, on the 20th, and on 1 April): during that window the old backend's "today" is still the previous day, so blue-sky deltas, auto pipeline snapshots and month-lock decisions can land in a different month than the new backend's.
2. Users active on both frontends may be logged out early (shared `refresh_token_hashes`, last 5 kept; logout clears all). Prefer pointing each user group at one backend.
3. Same conditions as (a) for bootstrap, the default admin password, and the pre-switch snapshot.


## Registry, staging path, test-DB guard, npm, ACME_CA (2026-10-03, latest)

Five more changes on top of the direct-mode switch. **This section supersedes the sections below where they disagree**: images now live in Vultr
Container Registry (not GHCR), the workflow has a staging deploy path (the direct-mode section's "no staging deploy job yet" is obsolete), and the
`npm audit` numbers below are replaced by the ones here. Final backend suite, run with plain `pytest` exactly as CI does: **191 passed, 1 skipped**.
`actionlint`, `shellcheck` (6 scripts) and `hadolint`: clean.

| # | Item | Status | Evidence | Commit |
|---|---|---|---|---|
| 1 | Vultr Container Registry replaces GHCR everywhere | **PASS** (a real push/pull NOT RUN: no credentials) | image `blr.vultrcr.com/qlink01/cbva-api:<sha12>` (+ `:latest` for production, `:staging` for staging); `docker/login-action` `registry: blr.vultrcr.com` with `VULTR_CR_USERNAME` / `VULTR_CR_API_KEY`; `packages: write` dropped. `git grep -i ghcr` outside the two historical reports: **no hits**. Compose resolves `blr.vultrcr.com/qlink01/cbva-api:abc123` and `...:staging` (`CBVA_IMAGE` can override the repository). The real deploy script run against a stub docker: `docker login blr.vultrcr.com -u ci-user --password-stdin` (password via stdin), `pull`/`up` with the new tag, **0 occurrences of the key** in output or call log; only `NEW_TAG`, `VULTR_CR_USERNAME`, `VULTR_CR_API_KEY` are passed to the VPS. `stack-test.sh` PASSED with the new compose. README/secrets table/rollback/retention updated. | `a7f1d2f` |
| 2 | Staging deploy path; production only on push to main | **PASS** (a real workflow run and the GitHub Environments NOT RUN) | New `plan` job; the real `plan` step executed for every trigger: `pull_request` -> environment `-`, deploy false, no push; **`push` -> vultr-production, deploy true, 2nd tag `latest`**; **`workflow_dispatch environment=staging` -> staging, deploy true, 2nd tag `staging`**; **`workflow_dispatch environment=production` -> refused** ("Production deploys run only on push to main..."); unknown event -> error. One `deploy` job with `environment: ${{ needs.plan.outputs.environment }}` so the `staging` / `vultr-production` GitHub Environments each supply their own `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_HOST_FINGERPRINT`; `VULTR_CR_*` are repository secrets. Same health check and ERR-trap rollback, re-run against a stub docker: healthy -> exit 0 (`current=new`, `previous=old`); never healthy -> **rolled back to old**, exit 1; `pull` fails -> **rolled back**, exit 1; first deploy unhealthy -> no previous, exit 1; key leaks 0 in all four. | `7e3223b` |
| - | **Found while doing 3:** the workflow's `test` job would have failed on its first run | **FIXED** | Plain `pytest` (what CI runs) died at conftest import with `ModuleNotFoundError: No module named 'app'`; every local run had used `python -m pytest`, which adds the cwd to `sys.path`. `pytest.ini` now has `pythonpath = .`; the console-script `pytest.exe` passes. | `609d161` |
| 3 | `conftest.py` refuses a non-local `MONGODB_URL` unless `ALLOW_REMOTE_TEST_DB=1` | **PASS** | `tests/db_guard.py` + `tests/test_db_guard.py`, **35 tests**: allowed `localhost`, `127.0.0.1`, `mongo` (case-insensitive, ports, credentials, replica-set lists); refused remote hosts, `mongodb://localhost@evil.example.com` (userinfo trick), `localhost.evil.example.com`, `127.0.0.1.evil.io`, host only in path/query, mixed replica-set lists, `[::1]`, `mongodb+srv://` (always remote), empty URL; override permits a remote host, but `DATABASE_NAME` must still end in `_test` (also with the override); the error names the hosts and **never the credentials**. End to end with real pytest subprocesses: remote URL -> exit non-zero at conftest import with `Refusing to run tests` (no password in output); override flag -> proceeds; `mongodb://mongo:27017` -> proceeds. Manual: `MONGODB_URL=mongodb+srv://appuser:...@cluster0...` -> `RuntimeError: Refusing to run tests: MONGODB_URL host(s) (mongodb+srv URL) are not local`. | `04b35c2` |
| 4 | npm: patch axios/react-router, remove unused packages, non-breaking audit fixes | **PASS, 7 findings remain (no non-breaking fix)** | `axios` ^1.18.1 -> ^1.20.0 (1.20.0), `react-router-dom` ^6.26.0 -> ^6.30.6 (`react-router` 6.30.6, `@remix-run/router` 1.23.4). Removed `lodash`, `react-quill` (-> `quill`), `jspdf` (-> `dompurify`), `moment`: **zero references** in `src/` and in every config file (case-insensitive, incl. CSS imports). **`npm audit --omit=dev`: BEFORE 20 (11 high, 8 moderate, 1 low) -> AFTER 7 (5 high, 2 moderate).** (The previous report said 15; the advisory database grew in the meantime, adding `braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`.) Cleared: axios, @remix-run/router, form-data, nanoid, picomatch, postcss, postcss-selector-parser, fflate, lodash, moment, quill, react-quill, dompurify. **Remaining, all need a breaking major:** `tailwindcss` + `braces`/`chokidar`/`fast-glob`/`micromatch` (a build-time tool, reached only through `tailwindcss-animate`, never in `dist/`; fix = Tailwind 4) and `react-router`/`react-router-dom` (open-redirect advisory fixed only in 7.18+). Reachability: every `navigate()`/`<Navigate>` target in `src/` is a fixed path or a fixed prefix + `encodeURIComponent`; there is no `?next=`/`returnUrl`, so the open redirect is not reachable; the SSR `deserializeErrors` advisory does not apply to an SPA. After a clean `npm ci` (592 packages): node unit tests **6/6 and 3/3**; builds for `https://cbva-api.claraai.tech` and `https://cbva-api-staging.claraai.tech` both succeed; **21-route CSP check: 0 violations on both**; browser auth flows on **both** builds: refresh failure -> 1 refresh, tokens cleared, `/home`; expired token -> silent refresh, original request retried once; logout -> 1 POST, tokens cleared. | `ddccc50` |
| 5 | Caddy `ACME_CA` env (Let's Encrypt staging for the first issuance) | **PASS** (a real issuance NOT RUN: no DNS) | Caddyfile global `acme_ca {$ACME_CA:<LE production directory>}`; compose passes `ACME_CA` with the production default. `caddy adapt`: unset -> issuer `ca: https://acme-v02.api.letsencrypt.org/directory`; set -> `https://acme-staging-v02.api.letsencrypt.org/directory`, `email: yogansh@claraai.tech` in both. Compose resolves default / override / **empty -> default** (Caddy alone rejects an empty value: `wrong argument count after 'acme_ca'`, which compose prevents). Real probe with `ACME_CA=staging` via environment only (real Caddyfile, `cbva-api.claraai.tech`): contacted the **staging** directory and failed with `NXDOMAIN` (no DNS record yet). `edge-test.sh` and `stack-test.sh` still PASS (`local_certs` coexists with `acme_ca`). README 4a documents staging-first, the switch (unset `ACME_CA`, delete the staging certificate directory, recreate Caddy), rate limits and "no ZeroSSL fallback". The claim that Caddy may keep a stored staging certificate after the switch is documented as a precaution and is **UNVERIFIED**. | `3a02111` |

Mistakes in this round: none of the new commits needed repair, but my first attempt at the deploy-script scenario run was blocked by a safety check on an `rm -rf` of a
variable path; I did not work around it and reran with a fresh scratch directory per scenario instead.

### Still NOT RUN (cumulative, needs real infrastructure)

1. A real push to / pull from Vultr Container Registry (credentials), and a real run of the workflow with the `staging` and `vultr-production` GitHub Environments.
2. The staging and production VPSs: `bootstrap-vps.sh`, the Vultr Firewall Group, `cbva-firewall.service` after a reboot.
3. DNS at GoDaddy and a real Let's Encrypt issuance (staging first, then production, per README 4a). Currently `cbva-api.claraai.tech` is `NXDOMAIN`.
4. Vercel: a real deployment, env vars per environment, branch-bound staging domain, Deployment Protection coverage.
5. Atlas allowlist/privileges per environment; dump/restore against real data.
6. Before production: the 7 remaining npm findings (Tailwind 4 and React Router 7 migrations, both breaking), and rotating the local `.env` credential that equals the "read-only prod" URI.

## Direct edge mode switch (2026-10-03, no Cloudflare)

The deployment target changed from Cloudflare + Pages to **direct**: browsers -> Caddy (Let's Encrypt) -> API on the VPS, frontend on Vercel,
DNS at GoDaddy (prod `cbva-api.claraai.tech` / `cbva.claraai.tech`, staging `cbva-api-staging.claraai.tech` / `cbva-staging.claraai.tech`).
The Cloudflare path is kept behind `EDGE_MODE=cloudflare` (`Caddyfile.cloudflare`, `docker-compose.cloudflare.yml`, `refresh-cloudflare-ips.sh`,
`frontend/cloudflare-pages/`). Everything below ran on real Docker 29.8.1; "NOT RUN" marks what needs real infrastructure.
**Where this section conflicts with the sections after it, this section wins** (those describe the Cloudflare design that was verified earlier).

**Correction to my earlier report:** I wrote that Cloudflare-only ingress was implemented with `ufw`. That was wrong in effect: `ufw` rules do not
filter Docker-published ports (they go through NAT and the FORWARD chain), so the 80/443 restriction was never enforced. The `DOCKER-USER` rules below
fix this for both modes. Proof that `ufw`-style host rules alone do not protect published ports is the "before any rules" row of the enforcement test.

| # | Item | Status | Evidence | Commit |
|---|---|---|---|---|
| 1 | Caddy automatic HTTPS (Let's Encrypt), env site address, ACME email, headers stripped, `X-Real-IP {remote_host}` | **PASS** (issuance itself NOT RUN: no DNS yet) | `caddy:2` `validate`: `Valid configuration`; `caddy adapt`: issuers `acme` (Let's Encrypt) then ZeroSSL, `email: yogansh@claraai.tech`, `trusted_proxies configured: False`, reverse_proxy ops `delete: [CF-Connecting-IP, X-Forwarded-For]`, `set: X-Real-Ip: {http.request.remote.host}`. No Origin CA mount, no Cloudflare ranges. `test/edge-test.sh` (real Caddyfile in front of a header-echo upstream): spoofed `CF-Connecting-IP`/`X-Forwarded-For`/`X-Real-IP` stripped, `X-Real-IP` = real peer (`192.168.65.1`, not Caddy `172.18.0.4`), a second container is seen as `172.18.0.2`, port 80 -> `308 https://...`. `EDGE TEST PASSED`. **ACME probe** (real Caddyfile, `SITE_ADDRESS=cbva-api.claraai.tech`, Let's Encrypt **staging** CA): `obtaining certificate` then `HTTP 400 urn:ietf:params:acme:error:dns - DNS problem: NXDOMAIN looking up A for cbva-api.claraai.tech`. **So Caddy does try ACME, and the DNS record for `cbva-api.claraai.tech` does not exist yet** (see README §1). | `2809235` |
| 2 | Client IP header configurable (`CLIENT_IP_HEADER`, default `X-Real-IP` direct / `CF-Connecting-IP` cloudflare), only from `TRUSTED_PROXY_CIDRS` | **PASS** | `tests/test_rate_limit_proxy.py` (+ updated `test_jwt.py`, `test_auth_hardening.py`): default is direct/`x-real-ip`; cloudflare mode reads only the CF header; override wins; invalid header names and modes rejected; untrusted peer ignored for both headers; **direct mode never uses `CF-Connecting-IP` or `X-Forwarded-For` even via the trusted peer**; two real IPs -> two keys; 20 rotating spoofed header values from one peer -> one key. **Through Caddy** (`test/stack-test.sh`, real API image): 7 bad logins with rotating spoofed `X-Real-IP`/`CF-Connecting-IP`/`X-Forwarded-For` -> `401 401 401 401 401 429 429` (one bucket); a second real IP (container) -> `401`, not throttled, then its own `401 401 401 429 429 429`; host stays `429`; API log IPs: `172.18.0.4` and `192.168.65.1` only (no Caddy IP `172.18.0.5`, no spoofed value). `STACK TEST PASSED` | `edea4d8`, `1cf826e` |
| 3 | `EDGE_MODE=direct|cloudflare` in `bootstrap-vps.sh`; ufw + DOCKER-USER; Vultr doc | **PASS for the rules (script on a real VPS NOT RUN)** | `docker-user-firewall.sh` in an isolated netns with iptables 1.8.13 (nf_tables): direct = 4 rules (accept orig-dport 80, 443; drop other NEW; return), idempotent (1 jump, 4 rules after a rerun), cloudflare refuses without a list, 32 rules with the 22 real ranges (15 IPv4 x 2 ports + 2), switching modes replaces (not appends), invalid mode refused, `--remove` clean. **Enforcement with real forwarded traffic** (client / router with DNAT like Docker / backend namespaces, port 8000 deliberately mis-published): before rules 80, 443, 8000 all reachable; **direct: 80, 443 reachable, 8000 blocked**; cloudflare, client not in list: all blocked; client in list: 80/443 reachable, 8000 blocked; an established download survives a reload; after `--remove` all reachable. `shellcheck` clean on all 6 scripts. Direct bootstrap: 22 only from `SSH_ALLOW_IP` (required, or `SSH_ALLOW_ANYWHERE=1`), 80/443 any, no Cloudflare cron, removes leftovers. `VULTR_FIREWALL.md` written (80/443 any, 22 your IP /32). **NOT RUN:** the bootstrap on a real Ubuntu VPS (ufw, systemd unit, sshd hardening); the Vultr panel (field names and the Cloudflare preset are from memory). | `b64f840` |
| 4 | Frontend on Vercel: `vercel.json` headers + SPA rewrite; `_headers`/`_redirects` aside; rebuild + 21-route CSP | **PASS** (Vercel CLI NOT RUN) | `vercel.json`: same CSP/headers, `connect-src 'self' https://cbva-api.claraai.tech https://cbva-api-staging.claraai.tech`, `/assets/*` immutable, SPA rewrite. `_headers`/`_redirects` moved to `frontend/cloudflare-pages/` (build output has neither). Builds: `VITE_API_URL=https://cbva-api.claraai.tech` and `https://cbva-api-staging.claraai.tech` both build; **`https://api.other-host.com` fails** ("not in the connect-src of vercel.json's CSP"), no URL fails, localhost fails. 21-route check serving dist with the REAL `vercel.json` rules (merged like Vercel, rewrites applied): **0 CSP violations for both origins**, asset `Cache-Control: public, max-age=31536000, immutable`, all four security headers set; negative control (staging removed from connect-src) -> **42 violations**. Auth-flow check on the staging build: 1 refresh, tokens cleared, logout POST. `vercel build` was not run (needs a Vercel login); an equivalent local server applying `vercel.json` was used instead. | `aa604ec` |
| 5 | Docs: GoDaddy records, Vercel env per environment, Deployment Protection | **DONE** (not verifiable here) | `deploy/README.md`: A `cbva-api`, A `cbva-api-staging` -> Vultr IPs; CNAME `cbva`, `cbva-staging` -> Vercel's target; `dig` checks before the first Caddy start; `VITE_API_URL` Production `https://cbva-api.claraai.tech`, Preview `https://cbva-api-staging.claraai.tech`; staging domain bound to branch `staging`; Deployment Protection (Vercel Authentication) on previews. **UNVERIFIED:** GoDaddy and Vercel UI details, and whether Standard Protection covers the staging branch domain (flagged in the README). | `6428d0a` |
| 6 | Re-run pytest, smoke-test with the stack in direct mode, actionlint | **PASS** | `pytest`: **156 passed, 1 skipped** (the explicitly skipped stale audit-scope test), 0 failed. `smoke-test.sh` on the rebuilt image: `SMOKE TEST PASSED` (uid 10001, 60 s up on read-only rootfs, healthy, 503 -> recovery, `docker stop` exit 0, RSS 94 MiB). `stack-test.sh` (direct mode, real compose + Caddyfile): `STACK TEST PASSED` (api 70 MiB, caddy 17 MiB). `edge-test.sh` PASSED. `actionlint` (rhysd/actionlint image): clean. `shellcheck` x6 and `hadolint`: clean. Cloudflare path still loads: `Caddyfile.cloudflare` + overlay mounts validate, 22 trusted ranges, ops `delete X-Forwarded-For, X-Real-IP`, `set CF-Connecting-IP {client_ip}`; both compose configs resolve. | `1cf826e`, `c2b2924` |

Defects found while doing this (fixed): `edge-test.sh` and the CSP script used helpers/paths that did not exist until the first real run (undefined `expect` helper, `-o /dev/null` under `MSYS_NO_PATHCONV`);
**the new workflow step name had an unquoted colon, which broke the YAML. I committed it (`1cf826e`) before `actionlint` ran, and fixed it in `c2b2924`.** HEAD is valid.

### Verdict for the direct design

**GO for a staging deploy**, in this order: create the Vultr Firewall Group, run the direct bootstrap with `SSH_ALLOW_IP`, add the GoDaddy A record and
confirm `dig` returns the VPS IP, then start the stack. Nothing that could be tested locally is failing: the image, the real compose + Caddyfile stack, the
header stripping, per-real-IP rate limits, the DOCKER-USER enforcement, the Vercel headers/CSP and the whole backend suite all pass. The items below are the
parts that need real infrastructure. Still required before production: the `npm audit` highs, and rotating the local `.env` credential that equals the
"read-only prod" URI.

### Still NOT RUN for the direct design

1. Let's Encrypt issuance for real: needs the GoDaddy A records and a reachable port 80 (probe result above: `NXDOMAIN`).
2. `bootstrap-vps.sh` on a real Ubuntu VPS, the Vultr Firewall Group, and the `cbva-firewall.service` unit surviving a reboot and a Docker restart.
3. A real Vercel deployment: env vars per environment, branch-bound staging domain, Deployment Protection coverage, GoDaddy CNAME target.
4. The GitHub Actions workflow (now also running the edge and stack tests); the deploy job targets only `production`; there is no staging deploy job yet.
5. Atlas allowlist/privileges per environment, and dump/restore against real data.

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

## GO / NO-GO for a staging deploy (as of the Cloudflare-design pass; see the direct-mode section at the top for the current status)

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
