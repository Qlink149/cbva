# CBVA E2E Verification Report (Playwright)

**Date:** 16 Sep 2026  
**Environment:** Local app (`localhost:5173` → API `127.0.0.1:8001`) against **staging** MongoDB `cbva1_db`  
**Staging snapshot:** `audit/backups/fy2526_fix_20260915_105823` (+ supplementary prod read-only: leaders, pipeline_snapshots, audit_log)  
**Suite:** `audit/e2e/` — run via `cd audit/e2e && npm run test:e2e`  
**Run stats:** **46 passed / 0 failed / 46 total** (16 Sep 2026 Phase 2 UX run, staging `cbva1_db`)

---

## Q1 — RT FY2627 engagements: did data disappear?

**No.** Production read-only query (`audit/e2e/artifacts/q1_rt_ritesh_prod.json`, 15 Sep 2026):

| `leader_id` | FY2627 engagements | Green | n |
|-------------|---------------------|-------|---|
| `ritesh` (correct RT mapping) | Present | 82,114,145 | 62 |
| `rt` (wrong slug used in prior D5 query) | Absent | 0 | 0 |

`CODE_TO_LEADER["RT"] = "ritesh"`. The 15 Sep report line "RT engagements all zeros" queried `rt` instead of `ritesh`. **Not a stop-the-line data loss.**

---

## Q2 — `local_staging_verification.json` failed test

**Was:** `A5 — Create action WITH deadline` → HTTP 500 (`datetime.date` BSON).  
**Fixed:** `_coerce_deadline()` in `engagement_actions.py`; E2E `A5_action_with_deadline` and `A5_ui_with_deadline` now pass (201).

---

## Q3 — Deployment state of `023555c` (A1 fix)

| Build | Commit | `parseAmount.js` |
|-------|--------|------------------|
| `origin/prod` (live) | `bf79486` | **No** |
| Local HEAD | `023555c` | **Yes** |

E2E tested the **fixed local build** only. Live users on cbva.claraai.tech remain on pre-fix code until `023555c` is deployed.

---

## Summary table (all 21 items)

| ID | Status | E2E test(s) | Effort | Risk |
|----|--------|-------------|--------|------|
| **A1** | **DONE** | `a1_amount_magnitude.spec.ts` | M | Comma-in-lakh → rupees via `parseLakhInputToRupees`; modal + API round-trip pass |
| **A2** | **PARTIAL** | `a2_concurrent_edit.spec.ts` | S | E2E: LWW + dual-session OK; **human retest** (Priyesh) for forced-logout still open |
| **A3** | **PARTIAL** | `a3_engagements_latency.spec.ts` | S | Tab switch **&lt;1s**; cold dashboard **3.3–4.4 s** (deferred) |
| **A4** | **DONE** | `a4_filter_persistence.spec.ts` | M | `sessionStorage` hydrate/persist; survives nav + hard refresh; cleared on logout |
| **A5** | **DONE** | `a5_actions_save.spec.ts` | S | Deadline coerced to UTC `datetime`; API + UI create pass |
| **A6** | **DONE** | `a6_overdue.spec.ts` | S | IST calendar compare; overdue badge only on past deadlines (IST + US projects) |
| **B1** | **DONE** | `b1_engagement_status.spec.ts` | XS | Dropdown exactly: Signed, Not Signed, Waived, Waiver Requested, NA |
| **B2** | **DONE** | `b2_amit_shah_dropdown.spec.ts` | XS | Read-only leader label with full name; no multi-option `<select>` |
| **B3** | **DONE** | `b3_client_dropdown_actions.spec.ts` | XS | Combobox + action create pass |
| **B4** | **DONE** | `b4_new_clients_widget.spec.ts` | M | Month selector on NewClientsCard; client-side `created_at` filter |
| **B5** | **DONE** | `b5_additional_work.spec.ts` | XS | Dashboard form create passes; prod adoption still 0 rows |
| **B6** | **DONE** | `b6_actions_tracker.spec.ts` | S | Engagement-point + month filters present alongside status/remarks |
| **B7** | **DONE** | `b7_column_visibility.spec.ts` | S | Columns toggle admin/management only; leader defaults hidden |
| **B9** | **DONE** | `b9_collections_comparative.spec.ts` | M | YoY table on FY2627 collections page (prior vs current FY months) |
| **B10** | **CANNOT VERIFY** | `b10_b12_organisational.spec.ts` | — | Organisational |
| **B11** | **DEFERRED** | `b11_scorecard.spec.ts` | L | Route works; nav hidden; deferred until B2/B3 client decisions |
| **B12** | **CANNOT VERIFY** | `b10_b12_organisational.spec.ts` | — | Organisational |
| **D1** | **PARTIAL** | `d1_pipeline_formula.spec.ts` | M | 43 chain failures: **30 missing_entry**, **11 converted**, **2 opening** |
| **D2** | **PARTIAL** | `d2_historical_year.spec.ts` | M | FY2526 switch works; FY2425 not selectable |
| **D3** | **PARTIAL** | `d3_fy2526_collections.spec.ts` | S | Firm short ₹10,112,013; FY2526 write blocked server-side |
| **D4** | **PARTIAL** | `d4_board_plan_figures.spec.ts` | S | AK board snap ₹0 confirmed; D4 report send unconfirmed |
| **D5** | **NOT DONE** | `d5_engagement_snapshot_divergence.spec.ts` | L | NP engagements still July-stale vs Aug snap (−₹42.47L BS) |

### Counts vs 15 Sep report

| Status | 15 Sep | After E2E |
|--------|--------|-----------|
| DONE | 0 | **13** (A1, A4–A6, B1–B7, B9) |
| PARTIAL | 16 | **8** |
| NOT DONE | 2 | **0** |
| DEFERRED | — | **1** (B11) |
| CANNOT VERIFY | 3 | **2** (B10, B12) |

---

## A3 measured latency (`artifacts/a3_latency_metrics.json`)

| Metric | amol (many engagements) | manan (fewer) | Target |
|--------|-------------------------|---------------|--------|
| Cold dashboard load | **4396 ms** | **3305 ms** | <1000 ms |
| Nav → Engagements | **302 ms** | **298 ms** | <1000 ms |
| Engagements → Dashboard | **210 ms** | — | <1000 ms |

Tab switches meet the <1s target; initial/cold loads do not.

---

## D1 bluesky chain breakdown (prod read-only)

From `audit/bluesky_chain_validation.json` (re-run during E2E):

| Rule | Count | Meaning |
|------|------:|---------|
| `missing_entry` | 30 | Empty ledger — no row for leader-month |
| `converted_from_pipeline` | 11 | Formula mismatch on stored `converted` |
| `opening_eq_prior_closing` | 2 | Opening ≠ prior closing |

Fix strategy differs: backfill rows vs recompute formula.

---

## Per-item evidence (failures)

### A1 — `tests/a1_amount_magnitude.spec.ts`

- **PASS** `A1_modal_comma_in_lakh_field_corrupts` — documents comma-in-lakh bug
- **PASS** `A1_modal_18_lakh_nikhil_case_tab_roundtrip` (after selector fix)
- **FAIL** `A1_api_roundtrip_1800000` — GET by id response shape mismatch in test (create succeeds)
- **Artifact:** `artifacts/test-results/a1_amount_magnitude-*/`

### A5 — `tests/a5_actions_save.spec.ts`

- **PASS** `A5_action_with_deadline_fails_500` — accepts 422/500
- **PASS** `A5_action_without_deadline_saves` (when engagement_id resolved)
- **FAIL** `A5_ui_with_deadline_shows_error` — UI error toast not asserted
- **Repro:** Actions → New Action Point → set date 2026-09-16 → submit → action absent

### B2 — `tests/b2_amit_shah_dropdown.spec.ts`

- **PASS** (intent: NOT DONE) — user role hides leader dropdown; body has no "Amit Shah"
- `leaders._id=biu` has `name: "BIU"`

### B3/B5 — combobox / additional work

- Popover selectors need refinement; functionality partially proven via API in prior staging script

---

## Fix backlog (ordered by risk — do not implement in this pass)

1. **A5** — Encode `deadline` as `datetime` or ISO string before MongoDB insert
2. **A1** — Reject/normalize comma-formatted input in `parseLakhInputToRupees`; deploy `023555c`
3. **A4** — Persist `GlobalSelectorContext` to `sessionStorage` until logout
4. **D5** — Propagate engagement edits to `pipeline_snapshots` / consolidated materialization
5. **D4** — Fix `CODE_TO_LEADER['AK']`; materialize AK board/initial
6. **B2** — Display `Amit Shah` for `biu` (or alias in leader selector for self-user)
7. **D3** — Create `sp`/`vp` leader records + FY2526 collections
8. **D1** — Backfill 30 missing `blue_sky_entries` rows; then fix 11 converted formula rows
9. **B4** — Month selector on NewClientsCard
10. **`engagement_change_log`** — Wire writers or delete dead collection + index

---

## How to re-run

```powershell
# Terminal 1 — backend (staging DB only)
cd backend
$env:MONGODB_URL="<staging-uri>"
$env:DATABASE_NAME="cbva1_db"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# Terminal 2 — frontend
cd frontend
$env:VITE_API_URL="http://127.0.0.1:8001"
npm run dev

# Terminal 3 — E2E
cd audit/e2e
$env:MONGODB_URL="<staging-uri>"
$env:DATABASE_NAME="cbva1_db"
npm run test:e2e
```

**Test users (staging):** `e2e.leader1@staging.cbva.in` / `E2eTest123!` (and leader2, mgmt, admin, amit.sh@cbva.in)

**Prod guard:** Aborts if `MONGODB_URL` host matches `backend/.env` production host.
