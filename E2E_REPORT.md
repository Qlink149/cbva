# CBVA end-to-end verification of the deployed stack

Run 2026-10-03 17:50Z → 20:50Z against the **deployed** stack, before switching the server to the production database.

| | |
|---|---|
| API | https://cbva-api.claraai.tech (Vultr, image from `main` @ `19e2ced`) |
| Frontend | https://cbva.claraai.tech (Vercel production build) |
| Database | `cbva_verify` on the **test** cluster (a copy of prod). The URI was passed only as an environment variable and is not written anywhere in the repo. The production database was never contacted. |
| Accounts | Temporary e2e accounts only: 1 admin, 1 management, 2 leaders (`e2e_leader_a/b`, bound to temporary leaders) plus a read-only differential user. Created by `tests/e2e/provision.py create`, deleted by `cleanup`. |
| Not done | Nothing was merged, pushed to `main`, deployed, or re-run in CI. |

Gate: the temporary admin, which exists only in `cbva_verify`, logged in on the deployed API (200). So the deployed API is connected to `cbva_verify`, and phases C–E ran against it.

## Verdict: **NO-GO today; GO once the 3 blockers below are closed**

| # | Blocker | Why | Fix |
|---|---|---|---|
| 1 | **Merge and deploy PR #5** | On the deployed build, **adding a team member, a hiring requirement or a day-to-day task fails for every user.** A blank date returns 422 and a filled date returns 500, so nothing can be created; that is why `tasks` is empty and every stored joining date is null. Also: the admin Change Log can be broken by one malformed audit entry (it was, twice, during this run); ~27 routes and 3 pages return 500 on malformed input; the first scorecard visit races (500); admin client and engagement-type create always returns 500. | [PR #5](https://github.com/Qlink149/cbva/pull/5), 7 commits, 250 backend tests green |
| 2 | **Rotate `admin@cbva.com` in the production DB** (seed default password, active admin) | Someone logged in to the **public** API with it at 17:37Z, before this run (seen in `cbva_verify` audit/`last_login`; the e2e suite never uses real accounts). The same account exists in prod. | Run `python -m app.cli check-demo-users` against prod, then rotate or deactivate. Never use seed passwords. |
| 3 | **Install the backup cron on the VPS and run one backup + restore test against prod data** | There is currently no provider-independent backup. | `deploy/backup.sh` + `deploy/restore-test.sh` (this PR); cron line in `deploy/README.md` §7a |

Capacity is not a blocker but must be accepted knowingly. One uvicorn worker on 1 vCPU saturates at about **19 req/s**. With 20 very active concurrent users the p95 is **1.9 s** (see E).

---

## Coverage

| Area | Scope | Result |
|---|---|---|
| Routes (A) | **117/117** routes inventoried from the code, with auth/role and leader-scope checks per route | 4 public, 76 any-user, 26 admin, 11 admin+management |
| Frontend calls (A) | **111/111** `apiGet/Post/Put/Patch/Delete` + raw `axios`/`fetch` calls, with file:line | All map to a route: 86 exact, **25 differ only by trailing slash** (served directly by the normaliser since PR #4, no redirect). No method or path mismatches. |
| Differential (B) | 93 GET cases × 4 roles = **372** requests, old `d037ef0` vs `main` | 367 identical; all 5 differences explained |
| API E2E (C) | All 117 routes for 401/403, every leader-scoped list for IDOR, all **68** write routes, validation, transport, rate limits | **474 passed, 1 failed (test bug, fixed and re-verified), 58 xfailed (all = PR #5)** |
| UI E2E (D) | 3 roles × every router route (37 + 5 denied), CRUD in 8 modules, pipeline numbers for 10 leaders, refresh, logout | **80/82 passed** (2 = PR #5 strict expected-failures included in "passed"); 2 failed, both explained |
| Load (E) | 20 VUs, 5 min, realistic GET mix | 5,811 requests, 0 redirects, errors 1.49% (**all** on the poisoned audit log, PR #5), p95 1.94 s |
| Data (F) | Snapshot before/after, per-document hash diff, index diff | Indexes identical. 0 e2e records left. Only app-derived changes (explained). |
| Backups (G) | backup, restore, failure, retention | **BACKUP VERIFIED** (31 collections), failures exit 1, shellcheck clean |

Routes not reachable through the frontend (13): `GET /api/assessments/`, `POST/PUT /api/baselines`, `PUT /api/el-summary/{id}`, `GET/POST /api/engagement-actions/` (the slash spelling; the frontend uses the other), `POST/PUT /api/leaders`, `POST/PUT/DELETE /api/pipeline/...`, `/health`, `/health/ready`. All 13 are still covered by C.

Routes covered only partially, with the reason:
- `PUT /api/admin/settings`: validation and authorization only. Every field is optional, so any write rewrites the global settings document.
- `PUT /api/el-summary/{id}`: 404 path only. `el_summaries` is empty and has no create endpoint.
- `POST /api/auth/*`: covered in `test_auth.py` / `test_zz_ratelimit.py`, not by the validation sweep, because of the rate limits.

## A. Inventory: findings

- **Mapping:** every frontend call has a backend route. The 25 slash-only differences (`/api/leaders` vs `/api/leaders/`, …) are what broke prod before PR #4. Both spellings now answer the same, with no `Location` header (verified in C for every GET route, both spellings).
- **Payload-shape mismatches** (found dynamically by D):
  - Team `joining_date`, hiring `expected_joining_date` and task `deadline`: the frontend sends `""` from an empty `<input type="date">`. The API rejected it (422), and a real date crashed BSON encoding (500). Fixed in PR #5 `224bbc7` (`BlankableDate`).
  - `POST /api/admin/clients` and `/engagement-types` took a raw `dict`, so any shape was stored and every response returned 500. Fixed in PR #5 `d2ba19a`.
- **Unscoped reads** (old and new code alike):
  - `GET /api/leaders/{id}`: any logged-in user can read another leader's directory entry (name, practice, email), although the list is admin/management-only.
  - `GET /api/kra/*?leader_id=`: any logged-in user can read another leader's KRA config (definitions/weights, not ratings).
  - Both are low severity, documented in `test_authz.py`, and not fixed.

Full tables are in the appendix.

## B. Differential (old `d037ef0` vs current `main`, same DB, same SECRET_KEY)

Both backends ran locally against `cbva_verify` (old on python-jose, new on PyJWT), using tokens minted with the same key, for the admin, management, user (bound to the real leader `manan`) and unauthenticated roles. Volatile fields were normalised.

| Difference | Count | Explanation |
|---|---|---|
| `/health/ready` 404 → 200 | 4 (one per role) | New readiness endpoint |
| `GET /api/appraisals/rounds` (manan, FY 2526) body | 1 | The GET **created** 4 missing rounds (existing behaviour). The old server answered with in-memory timestamps (µs) and the new one read them back (ms). The 4 rounds were deleted afterwards. |

Otherwise status codes and bodies are identical for every case and role, including cross-leader requests (403 in both) and admin/management gates. Other code changes (consolidated 503 when not seeded, IST dates) did not show up because `cbva_verify` is seeded and the run was not near a month boundary in IST.

## C. API E2E (`tests/e2e`, pytest + httpx, deployed API)

Final full run 20:05Z: **474 passed, 1 failed, 58 xfailed** in 7m20s.

- **Auth:**
  - login ok; bad password and unknown email give the same 401 message (no user enumeration); malformed bodies give 422
  - `/me` per role; garbage, `alg=none`, and refresh-as-access tokens are rejected
  - refresh **rotates** and replay is refused ("revoked")
  - logout revokes refresh tokens
  - **real expiry**: a validly signed access token >15 min old returns 401 and refresh works
- **Rate limits** (all hold):
  - `/login` 5/min per IP; rotating spoofed `X-Real-IP`/`X-Forwarded-For`/`CF-Connecting-IP` does **not** escape it
  - 10 attempts / 15 min per email (the 11th returns 429 while another email from the same IP still gets 401)
  - `/refresh` 30/min
- **Authorization matrix:**
  - every non-public route returns 401 unauthenticated
  - every admin-only route returns 403 for management and leader
  - every admin+management route returns 403 for leader
  - every leader-scoped list returns 403 for leader B asking for A
  - per object: leader B cannot read/update/delete A's engagements, history, actions, engagement actions, tasks, team, hiring, meetings, additional work, collections, transactions, pipeline, baselines or appraisal rounds; management without a home leader cannot write leader data
  - after each attempt the record is verified unchanged
- **Writes:** all 68 write routes create → read → update → verify → delete on e2e-owned data. Pre-existing documents were never written.
  - Exceptions: settings (validation only) and global KRA layers (only the e2e leader's layer was written).
  - Deactivating a user revokes their refresh token and blocks login.
- **Validation:** 5 bad bodies on every write route, malformed and unknown ids on every `{id}` route, and bad query params on every GET. Everything is 4xx **except the PR #5 cases**, which are xfailed with the exact reason:
  - 50 × malformed ObjectId → 500
  - 3 pages × `fiscal_year=abcd` → 500
  - consolidated summary: malformed FY → 503
  - admin client / engagement-type → 500
- **Transport:**
  - no 3xx on any GET route in either spelling; port 80 → 308 to https at the edge only
  - CORS allows **only** `https://cbva.claraai.tech` (rejects evil, look-alike, http, staging, `null`, `*.vercel.app` and localhost origins), no credentials
  - HSTS, nosniff, `X-Frame-Options: DENY`
  - `/docs`, `/redoc`, `/openapi.json` return 404; `/health/ready` reports db up
- **The 1 failure** was in my expiry test (it consumed a refresh token, then replayed it). Fixed and re-run: passes.

Found and fixed during C, all in PR #5:
- duplicate baseline → 500 (`cb84000`, now 409)
- `GET /appraisals/rounds|scorecard` created rounds for **any** leader id / FY string (`4522aca`)
- malformed ids / FY (`9a3814f`)
- admin master-data (`d2ba19a`)

## D. UI E2E (`tests/e2e/ui`, Playwright, deployed frontend)

Final run 20:12Z: **80 passed / 2 failed** of 82 in 16 min. Every page is monitored for console errors, uncaught exceptions, **CSP violations (0 in every run)**, failed requests, 3xx/5xx and unexpected 4xx. A screenshot per route and role goes to `tests/e2e/artifacts/screens/` (gitignored).

- **Login** through the form for admin, management and leader; a wrong password shows the error and stores no token.
- **Every route** (13 my-plan + 7 firmwide + 2 admin) as admin and management, and the 13 my-plan routes as leader, all clean. Admin/firmwide routes as leader and admin routes as management are refused by the UI guard **without** any 403 API call.
- **Numbers:** the dashboard "Pipeline" table equals the last row of `GET /api/pipeline/` (Green, Amber, Blue Sky, Total) for **all 10 real leaders**.
- **CRUD through the real UI**, as a leader:
  - engagements: create, edit name, delete (from the pipeline page)
  - collections: set, change and clear a collected amount (the page is read-only by design; entry happens on the Engagements tab)
  - actions: create, status, delete
  - meetings: add, frequency, delete
  - headcount: set, change, clear to 0 (no delete exists)
  - blue sky: add, edit, clear the remark (no delete exists)
  - **team and hiring: cannot create** (the PR #5 date bug); both are strict expected-failures that flip when PR #5 is deployed
- **Session:**
  - a forced invalid access token leads to a silent `/api/auth/refresh` (200); the page keeps working and both tokens rotate
  - **Sign out** returns 204 and lands on `/home` with storage cleared; the old refresh token gets 401 and protected routes redirect to login

The 2 final failures:
1. `blue sky` hit `net::ERR_NETWORK_CHANGED` while loading JS chunks: a network change on the test machine. The same test passes alone (17.9 s).
2. Admin `/firmwide/change-log` returned 500, so the browser saw no CORS header. The final API run's validation sweep had again stored `{"leader_id": 123}` through the raw-dict admin endpoint, and that one audit entry breaks the whole audit list. Root cause and both fixes are in PR #5 (`d2ba19a` input, `e501e1b` serializer).

Found during D and fixed in PR #5:
- scorecard first-visit race: two GETs created the same rounds and the loser returned 500 (`a8216c2`)
- team/hiring/task dates (`224bbc7`)
- poisoned audit log (`e501e1b`)

## E. Load (k6, 20 VUs, 5 min, think time 1–3 s)

`tests/e2e/load/k6-get-mix.js`, run 20:35:19Z–20:40:27Z. Traffic mix: 55% leader pages as admin/management (11 calls), 20% firmwide, 10% scorecard (only leaders that already have rounds), 15% own pages + audit log. An earlier attempt was discarded: a script error aborted each iteration after its first request.

| Metric | Value |
|---|---|
| Requests / iterations | 5,811 / 708 (19.0 req/s) |
| Errors | **1.49%**, all 87 `GET /api/audit-log` (the poisoned-entry 500, PR #5). **0% on every other endpoint.** 0 redirects. |
| Latency (all) | median 882 ms, p90 1.12 s, **p95 1.94 s**, p99 4.09 s, max 9.4 s |
| p95 per endpoint | `/me` 0.98 s; lists (engagements, team, hiring, …) ≈1.0–1.1 s; pipeline 2.09 s; scorecard 2.18 s; firmwide aggregate 1.98 s; **consolidated summary 6.07 s** |
| Same calls unloaded | `/me` ≈60 ms, engagements ≈60 ms, pipeline ≈105 ms, dashboard aggregate ≈95 ms, consolidated 230–750 ms (round trip from the test machine ≈210 ms for `/health`) |

Reading: the server is not erroring. It is **saturated**: one uvicorn worker on 1 vCPU queues requests at ~19 req/s, and the slow consolidated summary (and pipeline, which re-materialises on every GET) holds the queue. 20 VUs at this pace is far heavier than 20 humans. Recommendations, in order:
1. cache the consolidated summary / firmwide aggregate per FY
2. stop re-materialising pipeline snapshots on every GET (do it on write)
3. a 2 vCPU / 2 GB plan with 2 workers if real concurrency grows

**docker stats:** run window 20:35:19Z–20:40:27Z (the earlier discarded attempt ran 20:29:20Z–20:34:23Z). Please add your captured CPU/memory numbers here.

## F. Data (`deploy/verify-data.sh`, read-only)

Baseline 17:50:50Z: 29 collections, 2,671 documents, 80 indexes. After the run, cleanup, and dropping 2 empty collections created by the junk inserts:

- **Indexes:** identical to the baseline.
- **Counts:** identical except `pipeline_snapshots` 85 → 92.
- **e2e leftovers:** `provision.py report` finds **0**.
- **Created by the run:** e2e users/leaders, records, audit entries and rounds; 288 + 255 documents deleted by `cleanup` across two cleanups.
  - The cleanup filters are strict: e2e emails, e2e leader ids, `E2E` labels, audit entries by e2e actors, and documents created by e2e actors per their audit entries.
- **Also removed:**
  - manan's 4 FY 2526 rounds created by B's GET
  - junk rounds the old GET created for a 300-char leader id and for FY "abcd"
  - junk client/engagement-type documents stored by the raw-dict endpoints
- **Remaining differences**, all made by the app's own GET `materialize_leader_derived_data` when pages for the 10 real leaders loaded (UI routes, the numbers test, k6):
  - 7 new current-month (October 2026) pipeline snapshots
  - 38 pipeline snapshots + 25 collection entries with a new `updated_at`
  - Values are deterministic: they come from unchanged engagements and the consolidated sheet. A restore of the 19:51Z backup compared with the final state shows **0 field differences except `updated_at`** across 92 snapshots, 133 collection entries and 513 real engagements, after hundreds of further materialisations.
  - The first page load in production would do the same.
- **Not changed by the run:**
  - 4 audit entries and the `last_login` of `admin@cbva.com` (17:37Z) and `amol.h@cbva.in` (16:57Z) predate the baseline. These were real-account logins to the deployed API before this run (see blocker 2).

## G. Backups (`deploy/backup.sh`, `deploy/restore-test.sh`)

| Test | Result |
|---|---|
| backup from an env file (URI parsed, never sourced or printed) | exit 0, `cbva-cbva_verify-<ts>.archive.gz` 152 KB + `.counts` (31 collections; counts taken before and after the dump, so concurrent writes are visible) |
| restore newest backup into `cbva_restore_test_<ts>`, compare counts | **BACKUP VERIFIED** (31/31 collections), scratch DB dropped |
| restore with a tampered counts file | `MISMATCH`, `RESTORE TEST FAILED`, exit 1, scratch DB still dropped |
| unreachable database | `FAILED`, exit 1, no partial file left |
| retention (`KEEP_DAYS=14`) | 20-day-old backup pruned; 10-day-old and unrelated files kept; pruning runs only after success |
| guards | missing env file gives exit 1; restore refuses any DB not named `cbva_restore_test*` and any non-empty scratch DB |
| URI exposure | 0 occurrences in the logs; passed to the `mongo:7` container only as an env var |
| `shellcheck -S warning` | clean |

Cron (as `deploy`, 02:30 IST): `0 21 * * * /opt/cbva/backup.sh >> /home/deploy/backups/backup.log 2>&1 || echo "cbva backup FAILED" | logger -t cbva-backup`. Setup is in `deploy/README.md` §7a.

## Fixes (PR #5, `fix/admin-master-data-500`, not merged)

| Commit | Fix | Found by |
|---|---|---|
| `d2ba19a` | admin client / engagement-type create: typed bodies, 201, nothing stored on 422 | C |
| `9a3814f` | malformed ObjectId → 422 everywhere; non-digit FY → treated as invalid; consolidated malformed FY → 422 | C |
| `cb84000` | `DuplicateKeyError` → 409 (duplicate baseline was 500) | C |
| `4522aca` | appraisal GETs never create rounds for unknown leaders / malformed FY | F |
| `e501e1b` | one malformed audit entry no longer returns 500 for the whole audit log | D |
| `224bbc7` | team/hiring/task/pipeline dates: `""` → null, real dates stored (was 422 / 500) | D |
| `a8216c2` | atomic upsert for round creation (scorecard first-visit race) | D |

Backend suite on the branch: **250 passed, 1 skipped**. Each new test fails on `main`.

## Remaining risks (not blockers)

- Logout revokes refresh tokens, but an issued access token stays valid until it expires (≤15 min).
- The API keeps only the newest **5** refresh tokens per user, so a 6th login (device/tab) silently signs out the oldest.
- The per-email login throttle lets anyone lock a known email out for 15 minutes (documented trade-off).
- Some reads write:
  - `GET /api/pipeline` re-materialises snapshots on every load; it is the main latency cost under load.
  - Appraisal GETs create rounds.
- A leader can read another leader's directory entry and KRA configuration (low).
- Single worker capacity (E). `/api/consolidated-summary` is the slowest call.
- Production data may differ from the `cbva_verify` copy. After switching, run `verify-data.sh counts` and `check-demo-users` on prod, and check one dashboard per leader.
- `deploy/backup.sh` and `restore-test.sh` are not shipped by CI; copy them once (README §7a). Copy backups off the VPS.
- The flaky UI step (blue sky on a network change) and the strict expected-failures for team/hiring must be updated once PR #5 is deployed. Set `E2E_PR5_DEPLOYED=1` and remove the xfails; strict mode will flag them.

## How to re-run

```bash
export E2E_MONGODB_URL=...  E2E_DATABASE_NAME=cbva_verify        # test copy only; the script refuses prod-looking names
python tests/e2e/provision.py create                               # temporary accounts -> tests/e2e/.state.json (gitignored)
(cd tests/e2e && python -m pytest -q)                              # API suite, ~8 min (rate-limit tests last)
(cd tests/e2e/ui && npm ci && npx playwright test)                 # UI suite, ~16 min
docker run --rm -i -e TOKENS=<admin,mgmt,leader access tokens> grafana/k6 run - < tests/e2e/load/k6-get-mix.js
python tests/e2e/provision.py cleanup                              # removes every e2e record (report = dry run)
```

Differential: `tests/e2e/differential.py` (two local servers, `OLD_URL` / `NEW_URL`, shared `E2E_SECRET_KEY`). Inventory: `tests/e2e/inventory.py --md out.md`.

---

## Appendix: route and frontend-call inventory (generated by `tests/e2e/inventory.py`)

| # | Method | Path | Auth | Leader scope | Handler | Frontend |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/actions/` | any-user | enforce_leader_scope | actions.list_actions | yes |
| 2 | POST | `/api/actions/` | any-user | enforce_leader_write_scope | actions.create_action | yes |
| 3 | PUT | `/api/actions/{action_id}` | any-user | enforce_leader_write_scope | actions.update_action | yes |
| 4 | PATCH | `/api/actions/{action_id}/status` | any-user | enforce_leader_write_scope | actions.update_action_status | yes |
| 5 | GET | `/api/additional-work/` | any-user | enforce_leader_scope | additional_work.list_additional_work | yes |
| 6 | POST | `/api/additional-work/` | any-user | enforce_leader_write_scope | additional_work.create_additional_work | yes |
| 7 | DELETE | `/api/additional-work/{work_id}` | any-user | enforce_leader_write_scope | additional_work.delete_additional_work | yes |
| 8 | PUT | `/api/additional-work/{work_id}` | any-user | enforce_leader_write_scope | additional_work.update_additional_work | yes |
| 9 | GET | `/api/admin/clients` | roles:admin,management | - | admin.list_clients | yes |
| 10 | POST | `/api/admin/clients` | roles:admin | - | admin.create_client | yes |
| 11 | GET | `/api/admin/engagement-types` | roles:admin,management | - | admin.list_engagement_types | yes |
| 12 | POST | `/api/admin/engagement-types` | roles:admin | - | admin.create_engagement_type | yes |
| 13 | GET | `/api/admin/financial-years` | roles:admin,management | - | admin.list_financial_years_admin | yes |
| 14 | POST | `/api/admin/financial-years` | roles:admin | - | admin.create_financial_year | yes |
| 15 | PUT | `/api/admin/financial-years/{fy_id}` | roles:admin | - | admin.update_financial_year | yes |
| 16 | GET | `/api/admin/plans` | roles:admin | - | admin.get_admin_plans | yes |
| 17 | PUT | `/api/admin/plans` | roles:admin | - | admin.upsert_admin_plans | yes |
| 18 | GET | `/api/admin/settings` | roles:admin | - | admin.get_settings | yes |
| 19 | PUT | `/api/admin/settings` | roles:admin | - | admin.update_settings | yes |
| 20 | GET | `/api/admin/users` | roles:admin | - | admin.list_users | yes |
| 21 | POST | `/api/admin/users` | roles:admin | - | admin.create_user | yes |
| 22 | DELETE | `/api/admin/users/{user_id}` | roles:admin | - | admin.deactivate_user | yes |
| 23 | PUT | `/api/admin/users/{user_id}` | roles:admin | - | admin.update_user | yes |
| 24 | GET | `/api/appraisals/rounds` | any-user | enforce_leader_scope | appraisals.list_rounds | yes |
| 25 | GET | `/api/appraisals/rounds/{round_id}` | any-user | enforce_leader_scope | appraisals.get_round | yes |
| 26 | PUT | `/api/appraisals/rounds/{round_id}/ratings` | any-user | _assert_can_write | appraisals.upsert_ratings | yes |
| 27 | POST | `/api/appraisals/rounds/{round_id}/submit` | any-user | _assert_can_write | appraisals.submit_round | yes |
| 28 | GET | `/api/appraisals/scorecard` | any-user | enforce_leader_scope | appraisals.get_scorecard | yes |
| 29 | GET | `/api/assessments/` | any-user | enforce_leader_scope | assessments.list_assessments | - |
| 30 | GET | `/api/audit-log/` | roles:admin | - | audit.list_audit_log | yes |
| 31 | GET | `/api/audit-log/entity/{entity_type}/{entity_id}` | roles:admin | - | audit.get_entity_history | yes |
| 32 | GET | `/api/audit-log/export` | roles:admin | - | audit.export_audit_log | yes |
| 33 | POST | `/api/auth/login` | public | - | auth.login | yes |
| 34 | POST | `/api/auth/logout` | any-user | - | auth.logout | yes |
| 35 | GET | `/api/auth/me` | any-user | - | auth.me | yes |
| 36 | POST | `/api/auth/refresh` | public | - | auth.refresh | yes |
| 37 | GET | `/api/baselines/` | any-user | enforce_leader_scope | baselines.list_baselines | yes |
| 38 | POST | `/api/baselines/` | any-user | enforce_leader_write_scope | baselines.create_baseline | - |
| 39 | PUT | `/api/baselines/{baseline_id}` | any-user | enforce_leader_write_scope | baselines.update_baseline | - |
| 40 | GET | `/api/bluesky/` | any-user | enforce_leader_scope | bluesky.list_bluesky | yes |
| 41 | POST | `/api/bluesky/` | any-user | enforce_leader_write_scope | bluesky.upsert_bluesky | yes |
| 42 | PUT | `/api/bluesky/{entry_id}` | any-user | enforce_leader_write_scope | bluesky.update_bluesky | yes |
| 43 | GET | `/api/client-meetings/` | any-user | enforce_leader_scope | client_meetings.list_client_meetings | yes |
| 44 | POST | `/api/client-meetings/` | any-user | enforce_leader_write_scope | client_meetings.create_client_meeting | yes |
| 45 | DELETE | `/api/client-meetings/{meeting_id}` | any-user | enforce_leader_write_scope | client_meetings.delete_client_meeting | yes |
| 46 | PUT | `/api/client-meetings/{meeting_id}` | any-user | enforce_leader_write_scope | client_meetings.update_client_meeting | yes |
| 47 | GET | `/api/collection-transactions/` | any-user | enforce_leader_scope | collection_transactions.list_collection_transactions | yes |
| 48 | POST | `/api/collection-transactions/` | any-user | enforce_leader_write_scope | collection_transactions.create_collection_transaction | yes |
| 49 | DELETE | `/api/collection-transactions/{transaction_id}` | any-user | enforce_leader_write_scope | collection_transactions.delete_collection_transaction | yes |
| 50 | GET | `/api/collections/` | any-user | enforce_leader_scope | collections.list_collections | yes |
| 51 | POST | `/api/collections/` | any-user | enforce_leader_write_scope | collections.set_monthly_plan | yes |
| 52 | PUT | `/api/collections/{entry_id}` | any-user | enforce_leader_write_scope | collections.update_collection_entry | yes |
| 53 | GET | `/api/consolidated-summary/` | roles:admin,management | - | consolidated.consolidated_summary | yes |
| 54 | GET | `/api/el-summary/` | any-user | enforce_leader_scope | el_summary.get_el_summary | yes |
| 55 | PUT | `/api/el-summary/{summary_id}` | any-user | enforce_leader_write_scope | el_summary.update_el_summary | - |
| 56 | GET | `/api/engagement-actions` | any-user | enforce_leader_scope | engagement_actions.list_engagement_actions | yes |
| 57 | POST | `/api/engagement-actions` | any-user | enforce_leader_write_scope | engagement_actions.create_engagement_action | yes |
| 58 | GET | `/api/engagement-actions/` | any-user | enforce_leader_scope | engagement_actions.list_engagement_actions | - |
| 59 | POST | `/api/engagement-actions/` | any-user | enforce_leader_write_scope | engagement_actions.create_engagement_action | - |
| 60 | DELETE | `/api/engagement-actions/{action_id}` | any-user | enforce_leader_write_scope | engagement_actions.delete_engagement_action | yes |
| 61 | PATCH | `/api/engagement-actions/{action_id}` | any-user | enforce_leader_write_scope | engagement_actions.update_engagement_action | yes |
| 62 | PATCH | `/api/engagement-actions/{action_id}/status` | any-user | enforce_leader_write_scope | engagement_actions.update_engagement_action_status | yes |
| 63 | GET | `/api/engagements/` | any-user | enforce_leader_scope | engagements.list_engagements | yes |
| 64 | POST | `/api/engagements/` | any-user | enforce_leader_write_scope | engagements.create_engagement | yes |
| 65 | DELETE | `/api/engagements/{engagement_id}` | any-user | enforce_leader_write_scope | engagements.archive_engagement | yes |
| 66 | PUT | `/api/engagements/{engagement_id}` | any-user | enforce_leader_write_scope | engagements.update_engagement | yes |
| 67 | GET | `/api/engagements/{engagement_id}/changes` | any-user | enforce_leader_scope | engagements.get_engagement_changes | yes |
| 68 | PATCH | `/api/engagements/{engagement_id}/remarks` | any-user | enforce_leader_write_scope | engagements.update_remarks | yes |
| 69 | GET | `/api/financial-years/` | any-user | - | financial_years.get_financial_years | yes |
| 70 | GET | `/api/firmwide/clients` | roles:admin,management | - | firmwide.firmwide_clients | yes |
| 71 | GET | `/api/firmwide/dashboard-aggregate` | roles:admin,management | - | firmwide.firmwide_dashboard_aggregate | yes |
| 72 | GET | `/api/firmwide/leaders` | roles:admin,management | - | firmwide.firmwide_leaders | yes |
| 73 | GET | `/api/firmwide/summary` | roles:admin,management | - | firmwide.firmwide_summary | yes |
| 74 | GET | `/api/firmwide/team` | roles:admin,management | - | firmwide.firmwide_team | yes |
| 75 | GET | `/api/headcount/` | any-user | enforce_leader_scope | headcount.list_headcount | yes |
| 76 | POST | `/api/headcount/` | any-user | enforce_leader_write_scope | headcount.upsert_headcount | yes |
| 77 | GET | `/api/hiring/` | any-user | enforce_leader_scope | hiring.list_hiring | yes |
| 78 | POST | `/api/hiring/` | any-user | enforce_leader_write_scope | hiring.create_hiring | yes |
| 79 | DELETE | `/api/hiring/{req_id}` | any-user | enforce_leader_write_scope | hiring.delete_hiring | yes |
| 80 | PUT | `/api/hiring/{req_id}` | any-user | enforce_leader_write_scope | hiring.update_hiring | yes |
| 81 | GET | `/api/kra/categories` | any-user | - | kra.list_categories | yes |
| 82 | GET | `/api/kra/competencies` | any-user | - | kra.list_competencies | yes |
| 83 | POST | `/api/kra/competencies` | roles:admin | - | kra.create_competency | yes |
| 84 | DELETE | `/api/kra/competencies/{competency_id}` | roles:admin | - | kra.delete_competency | yes |
| 85 | PUT | `/api/kra/competencies/{competency_id}` | roles:admin | - | kra.update_competency | yes |
| 86 | DELETE | `/api/kra/copy` | roles:admin | - | kra.remove_leader_copy | yes |
| 87 | POST | `/api/kra/copy` | roles:admin | - | kra.copy_layer | yes |
| 88 | GET | `/api/kra/kpis` | any-user | - | kra.list_kpis | yes |
| 89 | POST | `/api/kra/kpis` | roles:admin | - | kra.create_kpi | yes |
| 90 | DELETE | `/api/kra/kpis/{kpi_id}` | roles:admin | - | kra.delete_kpi | yes |
| 91 | PUT | `/api/kra/kpis/{kpi_id}` | roles:admin | - | kra.update_kpi | yes |
| 92 | GET | `/api/kra/resolved` | any-user | - | kra.get_resolved | yes |
| 93 | GET | `/api/kra/weights` | any-user | - | kra.list_weights | yes |
| 94 | PUT | `/api/kra/weights` | roles:admin | - | kra.upsert_weights | yes |
| 95 | GET | `/api/leaders/` | roles:admin,management | - | leaders.list_leaders | yes |
| 96 | POST | `/api/leaders/` | roles:admin | - | leaders.create_leader | - |
| 97 | GET | `/api/leaders/{leader_id}` | any-user | - | leaders.get_leader | yes |
| 98 | PUT | `/api/leaders/{leader_id}` | roles:admin | - | leaders.update_leader | - |
| 99 | GET | `/api/new-clients/` | any-user | enforce_leader_scope | new_clients.list_new_clients | yes |
| 100 | POST | `/api/new-clients/` | any-user | enforce_leader_write_scope | new_clients.create_manual_new_client | yes |
| 101 | GET | `/api/pipeline/` | any-user | enforce_leader_scope | pipeline.list_snapshots | yes |
| 102 | POST | `/api/pipeline/` | any-user | enforce_leader_write_scope | pipeline.create_snapshot | - |
| 103 | GET | `/api/pipeline/fy-actuals` | any-user | enforce_leader_scope | pipeline.list_fy_actuals | yes |
| 104 | PUT | `/api/pipeline/fy-actuals` | any-user | enforce_leader_write_scope | pipeline.upsert_fy_actual | yes |
| 105 | DELETE | `/api/pipeline/{snapshot_id}` | roles:admin,management | enforce_leader_write_scope | pipeline.delete_snapshot | - |
| 106 | PUT | `/api/pipeline/{snapshot_id}` | any-user | enforce_leader_write_scope | pipeline.update_snapshot | - |
| 107 | GET | `/api/tasks/` | any-user | enforce_leader_scope | tasks.list_tasks | yes |
| 108 | POST | `/api/tasks/` | any-user | enforce_leader_write_scope | tasks.create_task | yes |
| 109 | DELETE | `/api/tasks/{task_id}` | any-user | enforce_leader_write_scope | tasks.delete_task | yes |
| 110 | PUT | `/api/tasks/{task_id}` | any-user | enforce_leader_write_scope | tasks.update_task | yes |
| 111 | PATCH | `/api/tasks/{task_id}/status` | any-user | enforce_leader_write_scope | tasks.update_task_status | yes |
| 112 | GET | `/api/team/` | any-user | enforce_leader_scope | team.list_team | yes |
| 113 | POST | `/api/team/` | any-user | enforce_leader_write_scope | team.create_member | yes |
| 114 | DELETE | `/api/team/{member_id}` | any-user | enforce_leader_write_scope | team.delete_member | yes |
| 115 | PUT | `/api/team/{member_id}` | any-user | enforce_leader_write_scope | team.update_member | yes |
| 116 | GET | `/health` | public | - | app.main.health | - |
| 117 | GET | `/health/ready` | public | - | app.main.health_ready | - |

| # | Method | Frontend path | file:line | Backend route | Match |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/logout` | frontend/src/api/client.js:99 | POST /api/auth/logout | OK |
| 2 | GET | `/api/actions` | frontend/src/hooks/useActions.js:9 | GET /api/actions/ | SLASH (normalizer) |
| 3 | POST | `/api/actions/` | frontend/src/hooks/useActions.js:17 | POST /api/actions/ | OK |
| 4 | PUT | `/api/actions/${id}` | frontend/src/hooks/useActions.js:25 | PUT /api/actions/{action_id} | OK |
| 5 | PATCH | `/api/actions/${id}/status` | frontend/src/hooks/useActions.js:33 | PATCH /api/actions/{action_id}/status | OK |
| 6 | GET | `/api/additional-work/` | frontend/src/hooks/useAdditionalWork.js:10 | GET /api/additional-work/ | OK |
| 7 | POST | `/api/additional-work/` | frontend/src/hooks/useAdditionalWork.js:23 | POST /api/additional-work/ | OK |
| 8 | PUT | `/api/additional-work/${id}` | frontend/src/hooks/useAdditionalWork.js:35 | PUT /api/additional-work/{work_id} | OK |
| 9 | DELETE | `/api/additional-work/${id}` | frontend/src/hooks/useAdditionalWork.js:43 | DELETE /api/additional-work/{work_id} | OK |
| 10 | GET | `/api/admin/users` | frontend/src/hooks/useAdmin.js:9 | GET /api/admin/users | OK |
| 11 | POST | `/api/admin/users` | frontend/src/hooks/useAdmin.js:16 | POST /api/admin/users | OK |
| 12 | PUT | `/api/admin/users/${id}` | frontend/src/hooks/useAdmin.js:24 | PUT /api/admin/users/{user_id} | OK |
| 13 | DELETE | `/api/admin/users/${id}` | frontend/src/hooks/useAdmin.js:32 | DELETE /api/admin/users/{user_id} | OK |
| 14 | GET | `/api/admin/settings` | frontend/src/hooks/useAdmin.js:42 | GET /api/admin/settings | OK |
| 15 | PUT | `/api/admin/settings` | frontend/src/hooks/useAdmin.js:50 | PUT /api/admin/settings | OK |
| 16 | GET | `/api/admin/clients` | frontend/src/hooks/useAdmin.js:60 | GET /api/admin/clients | OK |
| 17 | POST | `/api/admin/clients` | frontend/src/hooks/useAdmin.js:67 | POST /api/admin/clients | OK |
| 18 | GET | `/api/admin/engagement-types` | frontend/src/hooks/useAdmin.js:75 | GET /api/admin/engagement-types | OK |
| 19 | POST | `/api/admin/engagement-types` | frontend/src/hooks/useAdmin.js:82 | POST /api/admin/engagement-types | OK |
| 20 | GET | `/api/admin/financial-years` | frontend/src/hooks/useAdmin.js:90 | GET /api/admin/financial-years | OK |
| 21 | POST | `/api/admin/financial-years` | frontend/src/hooks/useAdmin.js:97 | POST /api/admin/financial-years | OK |
| 22 | PUT | `/api/admin/financial-years/${id}` | frontend/src/hooks/useAdmin.js:108 | PUT /api/admin/financial-years/{fy_id} | OK |
| 23 | GET | `/api/admin/plans` | frontend/src/hooks/useAdmin.js:131 | GET /api/admin/plans | OK |
| 24 | PUT | `/api/admin/plans` | frontend/src/hooks/useAdmin.js:138 | PUT /api/admin/plans | OK |
| 25 | GET | `/api/firmwide/dashboard-aggregate` | frontend/src/hooks/useAdmin.js:151 | GET /api/firmwide/dashboard-aggregate | OK |
| 26 | GET | `/api/appraisals/rounds` | frontend/src/hooks/useAppraisals.js:7 | GET /api/appraisals/rounds | OK |
| 27 | GET | `/api/appraisals/rounds/${roundId}` | frontend/src/hooks/useAppraisals.js:15 | GET /api/appraisals/rounds/{round_id} | OK |
| 28 | PUT | `/api/appraisals/rounds/${roundId}/ratings` | frontend/src/hooks/useAppraisals.js:22 | PUT /api/appraisals/rounds/{round_id}/ratings | OK |
| 29 | POST | `/api/appraisals/rounds/${roundId}/submit` | frontend/src/hooks/useAppraisals.js:34 | POST /api/appraisals/rounds/{round_id}/submit | OK |
| 30 | GET | `/api/appraisals/scorecard` | frontend/src/hooks/useAppraisals.js:47 | GET /api/appraisals/scorecard | OK |
| 31 | GET | `/api/audit-log` | frontend/src/hooks/useAuditLog.js:10 | GET /api/audit-log/ | SLASH (normalizer) |
| 32 | GET | `/api/audit-log/entity/${entityType}/${entityId}` | frontend/src/hooks/useAuditLog.js:24 | GET /api/audit-log/entity/{entity_type}/{entity_id} | OK |
| 33 | GET | `/api/baselines` | frontend/src/hooks/useBaselines.js:7 | GET /api/baselines/ | SLASH (normalizer) |
| 34 | GET | `/api/bluesky` | frontend/src/hooks/useBluesky.js:9 | GET /api/bluesky/ | SLASH (normalizer) |
| 35 | PUT | `/api/bluesky/${entryId}` | frontend/src/hooks/useBluesky.js:26 | PUT /api/bluesky/{entry_id} | OK |
| 36 | POST | `/api/bluesky/` | frontend/src/hooks/useBluesky.js:31 | POST /api/bluesky/ | OK |
| 37 | GET | `/api/client-meetings/` | frontend/src/hooks/useClientMeetings.js:36 | GET /api/client-meetings/ | OK |
| 38 | POST | `/api/client-meetings/` | frontend/src/hooks/useClientMeetings.js:45 | POST /api/client-meetings/ | OK |
| 39 | PUT | `/api/client-meetings/${id}` | frontend/src/hooks/useClientMeetings.js:54 | PUT /api/client-meetings/{meeting_id} | OK |
| 40 | DELETE | `/api/client-meetings/${id}` | frontend/src/hooks/useClientMeetings.js:62 | DELETE /api/client-meetings/{meeting_id} | OK |
| 41 | GET | `/api/collections` | frontend/src/hooks/useCollections.js:8 | GET /api/collections/ | SLASH (normalizer) |
| 42 | POST | `/api/collections` | frontend/src/hooks/useCollections.js:20 | POST /api/collections/ | SLASH (normalizer) |
| 43 | PUT | `/api/collections/${entryId}` | frontend/src/hooks/useCollections.js:35 | PUT /api/collections/{entry_id} | OK |
| 44 | PUT | `/api/collections/${row.entry_id}` | frontend/src/hooks/useCollections.js:50 | PUT /api/collections/{entry_id} | OK |
| 45 | POST | `/api/collections` | frontend/src/hooks/useCollections.js:52 | POST /api/collections/ | SLASH (normalizer) |
| 46 | GET | `/api/collection-transactions` | frontend/src/hooks/useCollectionTransactions.js:11 | GET /api/collection-transactions/ | SLASH (normalizer) |
| 47 | POST | `/api/collection-transactions` | frontend/src/hooks/useCollectionTransactions.js:24 | POST /api/collection-transactions/ | SLASH (normalizer) |
| 48 | DELETE | `/api/collection-transactions/${id}` | frontend/src/hooks/useCollectionTransactions.js:37 | DELETE /api/collection-transactions/{transaction_id} | OK |
| 49 | GET | `/api/consolidated-summary` | frontend/src/hooks/useConsolidated.js:11 | GET /api/consolidated-summary/ | SLASH (normalizer) |
| 50 | GET | `/api/el-summary/` | frontend/src/hooks/useElSummary.js:27 | GET /api/el-summary/ | OK |
| 51 | GET | `/api/engagements/${engagementId}/changes` | frontend/src/hooks/useEngagementMeta.js:42 | GET /api/engagements/{engagement_id}/changes | OK |
| 52 | GET | `/api/engagement-actions/` | frontend/src/hooks/useEngagementMeta.js:66 | GET /api/engagement-actions | SLASH (normalizer) |
| 53 | POST | `/api/engagement-actions/` | frontend/src/hooks/useEngagementMeta.js:81 | POST /api/engagement-actions | SLASH (normalizer) |
| 54 | DELETE | `/api/engagement-actions/${id}` | frontend/src/hooks/useEngagementMeta.js:90 | DELETE /api/engagement-actions/{action_id} | OK |
| 55 | PATCH | `/api/engagement-actions/${id}/status` | frontend/src/hooks/useEngagementMeta.js:99 | PATCH /api/engagement-actions/{action_id}/status | OK |
| 56 | PATCH | `/api/engagement-actions/${id}` | frontend/src/hooks/useEngagementMeta.js:105 | PATCH /api/engagement-actions/{action_id} | OK |
| 57 | GET | `/api/engagements` | frontend/src/hooks/useEngagements.js:84 | GET /api/engagements/ | SLASH (normalizer) |
| 58 | POST | `/api/engagements` | frontend/src/hooks/useEngagements.js:93 | POST /api/engagements/ | SLASH (normalizer) |
| 59 | PUT | `/api/engagements/${id}` | frontend/src/hooks/useEngagements.js:104 | PUT /api/engagements/{engagement_id} | OK |
| 60 | DELETE | `/api/engagements/${id}` | frontend/src/hooks/useEngagements.js:154 | DELETE /api/engagements/{engagement_id} | OK |
| 61 | PATCH | `/api/engagements/${id}/remarks` | frontend/src/hooks/useEngagements.js:166 | PATCH /api/engagements/{engagement_id}/remarks | OK |
| 62 | GET | `/api/financial-years/` | frontend/src/hooks/useFinancialYears.js:8 | GET /api/financial-years/ | OK |
| 63 | GET | `/api/firmwide/summary` | frontend/src/hooks/useFirmwide.js:7 | GET /api/firmwide/summary | OK |
| 64 | GET | `/api/firmwide/leaders` | frontend/src/hooks/useFirmwide.js:18 | GET /api/firmwide/leaders | OK |
| 65 | GET | `/api/firmwide/clients` | frontend/src/hooks/useFirmwide.js:28 | GET /api/firmwide/clients | OK |
| 66 | GET | `/api/firmwide/clients` | frontend/src/hooks/useFirmwide.js:38 | GET /api/firmwide/clients | OK |
| 67 | GET | `/api/firmwide/team` | frontend/src/hooks/useFirmwide.js:56 | GET /api/firmwide/team | OK |
| 68 | GET | `/api/headcount` | frontend/src/hooks/useHeadcount.js:13 | GET /api/headcount/ | SLASH (normalizer) |
| 69 | POST | `/api/headcount` | frontend/src/hooks/useHeadcount.js:20 | POST /api/headcount/ | SLASH (normalizer) |
| 70 | GET | `/api/hiring` | frontend/src/hooks/useHiring.js:11 | GET /api/hiring/ | SLASH (normalizer) |
| 71 | POST | `/api/hiring` | frontend/src/hooks/useHiring.js:18 | POST /api/hiring/ | SLASH (normalizer) |
| 72 | PUT | `/api/hiring/${id}` | frontend/src/hooks/useHiring.js:23 | PUT /api/hiring/{req_id} | OK |
| 73 | DELETE | `/api/hiring/${id}` | frontend/src/hooks/useHiring.js:28 | DELETE /api/hiring/{req_id} | OK |
| 74 | GET | `/api/kra/categories` | frontend/src/hooks/useKra.js:13 | GET /api/kra/categories | OK |
| 75 | GET | `/api/kra/competencies` | frontend/src/hooks/useKra.js:20 | GET /api/kra/competencies | OK |
| 76 | POST | `/api/kra/competencies` | frontend/src/hooks/useKra.js:27 | POST /api/kra/competencies | OK |
| 77 | PUT | `/api/kra/competencies/${id}` | frontend/src/hooks/useKra.js:35 | PUT /api/kra/competencies/{competency_id} | OK |
| 78 | DELETE | `/api/kra/competencies/${id}` | frontend/src/hooks/useKra.js:43 | DELETE /api/kra/competencies/{competency_id} | OK |
| 79 | GET | `/api/kra/kpis` | frontend/src/hooks/useKra.js:51 | GET /api/kra/kpis | OK |
| 80 | POST | `/api/kra/kpis` | frontend/src/hooks/useKra.js:58 | POST /api/kra/kpis | OK |
| 81 | PUT | `/api/kra/kpis/${id}` | frontend/src/hooks/useKra.js:66 | PUT /api/kra/kpis/{kpi_id} | OK |
| 82 | DELETE | `/api/kra/kpis/${id}` | frontend/src/hooks/useKra.js:74 | DELETE /api/kra/kpis/{kpi_id} | OK |
| 83 | GET | `/api/kra/weights` | frontend/src/hooks/useKra.js:82 | GET /api/kra/weights | OK |
| 84 | PUT | `/api/kra/weights` | frontend/src/hooks/useKra.js:89 | PUT /api/kra/weights | OK |
| 85 | POST | `/api/kra/copy` | frontend/src/hooks/useKra.js:97 | POST /api/kra/copy | OK |
| 86 | DELETE | `/api/kra/copy` | frontend/src/hooks/useKra.js:111 | DELETE /api/kra/copy | OK |
| 87 | GET | `/api/kra/resolved` | frontend/src/hooks/useKra.js:124 | GET /api/kra/resolved | OK |
| 88 | GET | `/api/leaders` | frontend/src/hooks/useLeaders.js:7 | GET /api/leaders/ | SLASH (normalizer) |
| 89 | GET | `/api/leaders/${leaderId}` | frontend/src/hooks/useLeaders.js:15 | GET /api/leaders/{leader_id} | OK |
| 90 | POST | `/api/new-clients/` | frontend/src/hooks/useManualEntry.js:23 | POST /api/new-clients/ | OK |
| 91 | POST | `/api/additional-work/` | frontend/src/hooks/useManualEntry.js:25 | POST /api/additional-work/ | OK |
| 92 | GET | `/api/new-clients/` | frontend/src/hooks/useNewClients.js:8 | GET /api/new-clients/ | OK |
| 93 | GET | `/api/pipeline` | frontend/src/hooks/usePipeline.js:13 | GET /api/pipeline/ | SLASH (normalizer) |
| 94 | GET | `/api/pipeline/fy-actuals` | frontend/src/hooks/usePipeline.js:25 | GET /api/pipeline/fy-actuals | OK |
| 95 | PUT | `/api/pipeline/fy-actuals` | frontend/src/hooks/usePipeline.js:45 | PUT /api/pipeline/fy-actuals | OK |
| 96 | GET | `/api/tasks` | frontend/src/hooks/useTasks.js:11 | GET /api/tasks/ | SLASH (normalizer) |
| 97 | POST | `/api/tasks` | frontend/src/hooks/useTasks.js:17 | POST /api/tasks/ | SLASH (normalizer) |
| 98 | PUT | `/api/tasks/${id}` | frontend/src/hooks/useTasks.js:22 | PUT /api/tasks/{task_id} | OK |
| 99 | DELETE | `/api/tasks/${id}` | frontend/src/hooks/useTasks.js:27 | DELETE /api/tasks/{task_id} | OK |
| 100 | PATCH | `/api/tasks/${id}/status` | frontend/src/hooks/useTasks.js:32 | PATCH /api/tasks/{task_id}/status | OK |
| 101 | GET | `/api/team` | frontend/src/hooks/useTeam.js:11 | GET /api/team/ | SLASH (normalizer) |
| 102 | POST | `/api/team` | frontend/src/hooks/useTeam.js:18 | POST /api/team/ | SLASH (normalizer) |
| 103 | PUT | `/api/team/${id}` | frontend/src/hooks/useTeam.js:23 | PUT /api/team/{member_id} | OK |
| 104 | DELETE | `/api/team/${id}` | frontend/src/hooks/useTeam.js:28 | DELETE /api/team/{member_id} | OK |
| 105 | GET | `/api/auth/me` | frontend/src/lib/AuthContext.jsx:26 | GET /api/auth/me | OK |
| 106 | POST | `/api/auth/login` | frontend/src/lib/AuthContext.jsx:40 | POST /api/auth/login | OK |
| 107 | POST | `/api/auth/logout` | frontend/src/lib/AuthContext.jsx:50 | POST /api/auth/logout | OK |
| 108 | POST | `/api/team` | frontend/src/pages/firmwide/FirmwideTeam.jsx:132 | POST /api/team/ | SLASH (normalizer) |
| 109 | PUT | `/api/team/${id}` | frontend/src/pages/firmwide/FirmwideTeam.jsx:142 | PUT /api/team/{member_id} | OK |
| 110 | POST | `/api/auth/refresh` | frontend/src/api/client.js:29 | POST /api/auth/refresh | OK |
| 111 | GET | `/api/audit-log/export` | frontend/src/hooks/useAuditLog.js:39 | GET /api/audit-log/export | OK |
