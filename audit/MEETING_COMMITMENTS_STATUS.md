# CBVA Meeting Commitments — Full Status Report

**Date:** 16 Sep 2026 (updated after Phase 2 UX fixes)  
**Sources:** Production MongoDB (read-only), staging Playwright E2E (`audit/e2e/`), `audit/E2E_VERIFICATION_REPORT.md`  
**Mode:** Phase 1 + Phase 2 fixes shipped locally; **46/46 E2E pass** on staging  
**Meetings:** 2 Sep 2026 (Yogansh, Om, Nikhil, Laksh); 3 Sep 2026 (Nikhil, Rajendra)

---

## 1. Summary table (all 21 items)

| ID | Title | Status | Effort | Risk if shipped as-is |
|----|-------|--------|--------|------------------------|
| **A1** | Amount magnitude corruption | **DONE** | M | `parseLakhInputToRupees` treats comma-grouped input as rupees; E2E A1 pass |
| **A2** | Multi-user concurrent editing blocked | **PARTIAL** | S | E2E LWW + dual-session pass; **ask Priyesh** to retest two users same client/time |
| **A3** | Engagements tab latency | **PARTIAL** | S | Tab switch **&lt;1s** OK; cold load **3.3–4.4 s** deferred |
| **A4** | Filters do not persist across pages | **DONE** | M | `sessionStorage` keys `cbva_global_leader` / `cbva_global_fy`; cleared on logout |
| **A5** | Actions not saving / not in Actions tab | **DONE** | S | `_coerce_deadline()` BSON fix; deadline create 201 in E2E |
| **A6** | Overdue calculation | **DONE** | S | `isActionOverdue` uses IST calendar dates; E2E seeds deadlines via API |
| **B1** | Engagement status categories | **DONE** | XS | E2E: dropdown exactly Signed, Not Signed, Waived, Waiver Requested, NA |
| **B2** | Amit Shah missing from dropdown | **DONE** | XS | Read-only leader label (`user.full_name` + practice); E2E `B2_biu_user_sees_readonly_leader_label` |
| **B3** | Client dropdown on action creation | **DONE** | XS | E2E: combobox + action create pass |
| **B4** | New clients widget | **DONE** | M | `NewClientsCard` month filter; client-side `created_at` filter; E2E `B4_card_has_month_selector` |
| **B5** | Additional work manual table | **DONE** | XS | E2E: dashboard form create pass; **adoption:** prod has 0 rows — ask leaders to use it |
| **B6** | Actions Status + Remarks columns | **DONE** | S | Engagement-point + month filters on Actions tab; E2E `B6_engagement_point_and_month_filters_present` |
| **B7** | Hide admin/management columns | **DONE** | S | Columns toggle admin/management only; leader defaults hide Manager/RP/EL Status; E2E pass |
| **B9** | Collection tab comparative view | **DONE** | M | `CollectionsYoYTable` on FY2627 (dual-fetch prior FY); E2E `B9_yoy_table_visible_on_fy2627` |
| **B10** | Dedicated QA tester | **CANNOT VERIFY** | — | Organisational; this E2E pass is automated coverage Om requested |
| **B11** | KPI scorecard queries | **DEFERRED** | L | E2E route works; **deferred** until B2/B3 naming/role decisions signed off by client |
| **B12** | DPDP presentation | **CANNOT VERIFY** | — | Organisational |
| **D1** | Pipeline movement formula | **PARTIAL** | M | E2E: 43 failures = 30 missing_entry + 11 converted + 2 opening |
| **D2** | Historical-year representation | **PARTIAL** | M | E2E: FY2526 switch works; FY2425 not in `financial_years` |
| **D3** | FY2526 collections data | **PARTIAL** | S | E2E: firm short ₹10,112,013; FY2526 write blocked server-side (403) |
| **D4** | Initial/board plan figures (AK/SP/VP) | **PARTIAL** | S | E2E: AK board snap ₹0; D4 report send unconfirmed |
| **D5** | Engagements vs snapshot divergence | **NOT DONE** | L | E2E: NP July-stale vs Aug snap; RT data under `ritesh` not `rt` |

*B8 (monthly colour formula) is covered under D1.*

---

## 2. Counts

| Status | Count |
|--------|------:|
| **DONE** | 13 |
| **PARTIAL** | 8 |
| **NOT DONE** | 0 |
| **DEFERRED** | 1 |
| **CANNOT VERIFY** | 2 |

---

## 3. Top 5 by risk

| Rank | ID | What breaks first | Who notices |
|------|-----|-------------------|-------------|
| 1 | **A1** | Fix local + E2E green; **deploy** comma-in-lakh + prior `023555c` to prod | Leaders entering comma-formatted amounts |
| 2 | **D3 / D4** | Firm FY2526 collections −₹1.01 Cr; AK board plan ₹0 | Nikhil at board sign-off — sheet was confirmed correct 3 Sep |
| 3 | **D1** | Bluesky ledger: 43 formula failures Apr–Aug; `converted` stored as 0 when pipeline says otherwise | Nikhil reviewing pipeline movement table — he walked Rajendra through this on 3 Sep |
| 4 | **D5** | Engagements frozen at July values while August snapshots updated (NP BS −₹42.47L vs Aug snap) | Leaders see stale client rows; firm plan totals disagree |
| 5 | **A2** | Concurrent edit logout not reproduced in E2E — needs Priyesh human retest | Two leaders editing simultaneously |

---

## 4. Blocked on client

| Item | Question for Nikhil / Om / KK |
|------|-------------------------------|
| **D3 / D4 / SP–VP** | Create `sp` and `vp` leader records and load FY2526 collections (₹86.27L + ₹14.85L)? Or exclude from dashboard scope with footnote? |
| **D4 / AK** | Confirm mapping fix: `CODE_TO_LEADER['AK']` → `ak` and re-materialize board/initial (currently `ak_board_snap.total = 0` on prod)? |
| **B2** | **Resolved (Phase 2):** read-only label shows `user.full_name` (e.g. Amit Dinesh Shah) with practice subtitle (BIU); no dropdown rename |
| **B1** | Accept **"Waived"** spelling in UI vs meeting transcript **"Waved"**? |
| **B11** | Which scorecard sheet is canonical (B2 open in Aug audit)? KPI written responses still due to Rajendra? |
| **B12** | Did the DPDP session happen after 8 Sep? |
| **B10** | Was a dedicated QA tester assigned per Om's 2 Sep commitment? |
| **D2** | Load FY2425 into `financial_years` and dashboard, or annual-only via consolidated import is sufficient? |

**Reports already in repo (send status unconfirmed):**
- [`audit/D4_AK_SP_VP_DEVIATION_REPORT.md`](D4_AK_SP_VP_DEVIATION_REPORT.md)
- [`audit/SP_VP_DECISION_BRIEF.md`](SP_VP_DECISION_BRIEF.md)

---

## 5. Detail section

### A1 — Amount magnitude corruption

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | **Prod downward scan:** 1 candidate (`collection_entries` np Jul 2025 `collected=1,000`). **Upward scan:** 0 hits >₹100 Cr. **Local + staging DB** (`audit/local_staging_verification.json`): API create/get/put with `green=1,800,000` → **PASS** (9/10 tests). **parseAmount:** `parseRupeeInput("18,00,000")`→1,800,000 ✓; but `parseLakhInputToRupees("18,00,000")`→**180,000,000,000** ✗ (comma-formatted rupees in lakh field). Fix `023555c` not on `origin/prod`. **Browser tab round-trip:** not automated — frontend running at `http://localhost:5173` → API `http://127.0.0.1:8001`. |
| **Gap vs intent** | Sep 2: Nikhil — "18 lakh displayed as 1.8K" after navigating away. API save/fetch symmetric for correct values; modal lakh+comma combo still dangerous; deployed prod may lack fix. |
| **Effort** | M |
| **Risk** | Wrong unit or comma input in Add modal still corrupts; prod not on `023555c`. |

---

### A2 — Multi-user concurrent editing blocked

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | E2E `a2_concurrent_edit.spec.ts`: two leaders create/update different engagements OK; same-engagement LWW via list API; dual browser sessions stay on `/my-plan`. Auth still multi-session (`refresh_token_hashes` append). |
| **Gap vs intent** | Sep 2: Priyesh + manager reported forced logout — **not reproduced** in automated E2E. |
| **Effort** | S (retest only) |
| **Risk** | Low if original issue was test-environment artefact; medium if human repro succeeds. |
| **Needs** | **Priyesh retest:** two users, different clients, same time — confirm no forced logout. |

---

### A3 — Engagements tab latency

| Field | Value |
|-------|-------|
| **Status** | **CANNOT VERIFY** |
| **Evidence** | Load path: `Clients.jsx` → `EngagementsTable` → `GET /api/engagements` (`engagements.py` L314–327). Indexes: `database.py` L56–61 `(leader_id, fiscal_year, is_archived)`. `materialize_leader_derived_data` on **`GET /api/pipeline` only** (`pipeline.py` L70), not engagements list. Default `limit=100` (`pagination.py`). **No timing metrics** in codebase. |
| **Gap vs intent** | Sep 2: noticeable lag into engagements tab; target <1s not measured. |
| **Effort** | S |
| **Risk** | Perceived slowness unaddressed without measurement. |
| **Needs** | Chrome Performance trace on staging web app. |

---

### A4 — Filters do not persist across pages

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | Leader + FY: `GlobalSelectorContext.jsx` — in-memory React state, survives sidebar nav, **lost on refresh** (no `sessionStorage`). Month: local state in `EngagementsTable.jsx` L436–439, resets on FY change. Engagement filters: URL `?ef=` JSON on Clients routes only (`EngagementsTable.jsx` L422–454). Nikhil: persist until **logout** — not implemented. |
| **Gap vs intent** | Sep 2: filters reset between tabs; Laksh agreed filters should stay constant. |
| **Effort** | M |
| **Risk** | Leaders waste time re-filtering every session. |

---

### A5 — Actions not saving / not in Actions tab

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | **Local + staging** (`audit/local_staging_verification.json`): action **without** deadline → **201**, appears in list. Action **with** `deadline: "2026-09-16"` → **HTTP 500**. Root cause: `engagement_actions.py` L100 stores Pydantic `datetime.date` in MongoDB; BSON cannot encode `date` (`InvalidDocument`). **Prod:** `engagement_actions` count **0**. Code path unified in `8922814`. |
| **Gap vs intent** | Sep 2: Gora action with **16 Sep deadline** did not save — **matches deadline BSON bug exactly**. |
| **Effort** | S (store deadline as ISO string or datetime) |
| **Risk** | Every action with a deadline fails; users may see generic error or silent failure in UI. |

---

### A6 — Overdue calculation

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | `frontend/src/lib/isActionOverdue.js` L7–16: overdue iff `due < today` (strict); **due today is NOT overdue**. Uses browser **local** midnight, not IST (`datetime.js` uses `Asia/Kolkata` elsewhere). No unit tests. |
| **Gap vs intent** | Sep 2: Nikhil asked backend to double-check overdue; IST/UTC exposure from collections audit. |
| **Effort** | S |
| **Risk** | Off-by-one day for IST users on date-only deadline strings. |

---

### B1 — Engagement status categories

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | Schema `engagement.py` L7: `Signed, Not Signed, Waived, Waiver Requested, NA`. UI: `EngagementsTable.jsx` L62, `AddEngagementModal.jsx` L154–161. **Prod query:** `distinct el_status` → `["NA","Not Signed","Signed","Waived"]`; retired count (`DS`,`BS`,`-`,`Waved`) → **0**. |
| **Gap vs intent** | Sep 2: exactly five categories including **"Waved"** (own category); DS/BS and trailing hyphen removed. Code uses **"Waived"** not "Waved". |
| **Effort** | XS |
| **Risk** | Label mismatch with meeting language; low data risk (no retired values on prod). |

---

### B2 — Amit Shah missing from leader dropdown

| Field | Value |
|-------|-------|
| **Status** | **DONE** |
| **Evidence** | `LeaderFYSelector.jsx`: `role=user` sees read-only label with `user.full_name` + `useLeader` practice name (BIU); no multi-option `<select>`. E2E `b2_amit_shah_dropdown.spec.ts` pass. |
| **Gap vs intent** | Sep 2: Amit Shah cannot find his name on his own dashboard. **Resolved:** scoped user sees their full name, not a leader picker. |
| **Effort** | XS |
| **Risk** | Low — no DB rename or role change required. |

---

### B3 — Client dropdown on action creation

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | `ClientCombobox.jsx` in `Actions.jsx`. **Local + staging API:** create action with `engagement_id` → **PASS** (`local_staging_verification.json`). Browser combobox UX not automated. |
| **Gap vs intent** | Sep 2: client dropdown as first field from Actions area. API wiring works; full UI untested in browser. |
| **Effort** | XS |
| **Risk** | Low if A5 deadline bug fixed. |

---

### B4 — New clients widget

| Field | Value |
|-------|-------|
| **Status** | **DONE** |
| **Evidence** | `NewClientsCard.jsx` + `LeaderDashboard.jsx`: `select[aria-label="Filter by month"]` filters `useNewClients` rows by `created_at` (FY month slot). Source still `new_clients.py` / `audit_log`. E2E `B4_card_has_month_selector` pass. |
| **Gap vs intent** | Sep 2: month selector on card. **Shipped (v1):** client-side filter on existing API `created_at`. Apr–Aug manual backfill still not in code. |
| **Effort** | M |
| **Risk** | Low for current FY; historical backfill remains a data task if needed. |

---

### B5 — Additional work manual input table

| Field | Value |
|-------|-------|
| **Status** | **DONE** (adoption pending) |
| **Evidence** | `AdditionalWorkCard.jsx` + `additional_work.py` CRUD; E2E `b5_additional_work.spec.ts` pass. **Prod query:** `additional_work.countDocuments({})` → **0**. |
| **Gap vs intent** | Sep 2: manual interim table for extra work on existing clients; board-level reporting. **Action:** ask leaders to enter additional work on dashboard; demo in standup if helpful. |
| **Effort** | XS |
| **Risk** | Feature works but unused — board reporting gap remains until leaders adopt. |

---

### B6 — Actions tracker: Status and Remarks

| Field | Value |
|-------|-------|
| **Status** | **DONE** |
| **Evidence** | `Actions.jsx`: status filter + `select[aria-label="Filter by engagement point"]` + `select[aria-label="Filter by month"]` (client-side on `createdAt`). E2E `B6_engagement_point_and_month_filters_present` pass. |
| **Gap vs intent** | Sep 3: Status + Remarks columns; filter Pending; engagement point and month filters. **Shipped.** |
| **Effort** | S |
| **Risk** | Low — leader-scale lists only; API query params deferred unless volume grows. |

---

### B7 — Hide administrative / management columns

| Field | Value |
|-------|-------|
| **Status** | **DONE** |
| **Evidence** | `initialColumnVisibility(role)` in `fyTableConfig.js`; `EngagementsTable.jsx`: Columns toggle only for `admin` / `management`; leaders default-hidden Manager, Rel. Partner, EL Status. E2E `b7_column_visibility.spec.ts` pass. |
| **Gap vs intent** | Sep 3: Rajendra — hide admin columns for leader sign-off; admins retain access. **Shipped.** |
| **Effort** | S |
| **Risk** | Low — UI-only role gate. |

---

### B9 — Collection tab comparative view

| Field | Value |
|-------|-------|
| **Status** | **DONE** |
| **Evidence** | `Collections.jsx` dual-fetches prior FY when `activeFY=2627`; `CollectionsYoYTable.jsx` + `buildYoYMonthRows()` in `collectionsRollup.js`. Month | prior collected | current collected | Δ | Δ% + YTD row. E2E `B9_yoy_table_visible_on_fy2627` pass. `CollectionFunnelChart.jsx` not wired (intentional). |
| **Gap vs intent** | Sep 3: compare FY25-26 vs FY26-27 by month on Collections tab. **Shipped (leader tab).** Firmwide YoY deferred. |
| **Effort** | M |
| **Risk** | Low — read-only summary from existing collection_entries API. |

---

### B10 — Dedicated QA tester

| Field | Value |
|-------|-------|
| **Status** | **CANNOT VERIFY** |
| **Evidence** | Sep 2: Om committed to dedicated tester. No hiring record, test plan, or CI gate in repo. `backend/tests/` exists (developer-written). |
| **Gap vs intent** | Organizational commitment. |
| **Effort** | — |
| **Risk** | Minor regressions (e.g. A1) reach production without independent QA. |

---

### B11 — KPI scorecard queries

| Field | Value |
|-------|-------|
| **Status** | **DEFERRED** |
| **Evidence** | `Scorecard.jsx`, `KraConfigTab.jsx`, `/api/appraisals/scorecard` exist. E2E `b11_scorecard.spec.ts` pass. **Scorecard hidden from nav** (`AppLayout.jsx` L20). |
| **Gap vs intent** | Sep 2: Nikhil owns KPI responses to Rajendra by mid-Sep. **Deferred** until B2/B3 naming/role decisions signed off; KRA config unchanged. |
| **Effort** | L |
| **Risk** | Scorecard/KPI sign-off blocked pending client decisions. |

---

### B12 — DPDP presentation

| Field | Value |
|-------|-------|
| **Status** | **CANNOT VERIFY** |
| **Evidence** | Sep 2: Yogansh to resend deck; Mumbai 8 Sep slot. No artifact in repo. |
| **Gap vs intent** | Organizational. |
| **Effort** | — |
| **Risk** | Compliance timeline unknown. |

---

### D1 — Pipeline movement formula (B8)

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | Formula in code: `engagements.py` `_auto_update_bluesky`, `bluesky_service.py` `compute_converted_from_pipeline`, `closing = opening + additional − converted`. Values are **stored** in `blue_sky_entries`, not purely derived at read time. **Live validation:** `audit/validate_bluesky_chain.py` → `audit/bluesky_chain_validation.json` — **43 failures** Apr–Aug FY2627 across 9 leaders. Breakdown: **~35 `missing_entry`** (no row for Apr/May/Jun/Aug for most leaders); **9 `converted_from_pipeline`** (stored `converted=0`, expected non-zero — e.g. manan Jul expected ₹24,72,000); **2 `opening_eq_prior_closing`** (varun May/Jul: ₹92L opening mismatch). Manan Jul: only July row exists; `opening=0` is valid if no prior month row, but `converted=0` vs expected ₹24,72,000 fails Nikhil's formula. |
| **Gap vs intent** | Sep 3 (20 min): opening[M]=closing[M−1]; converted=(G+A)[M+1]−(G+A)[M]; additional=closing−opening+converted. Nikhil most likely to ask about this next meeting. |
| **Effort** | M |
| **Risk** | Pipeline movement table shows wrong converted/additional; undermines trust in dashboard. |

---

### D2 — Historical-year representation

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | **Prod query:** `financial_years` → slugs `2526` (locked), `2627` (editable) only — **no 2425**. FY2425 in `consolidated_summaries` import rows only. FY2526 green-only: `EngagementsTable` `hideAmberBlueSky`, `consolidated_service.py` `_apply_closed_fy2526_rules`, FY2526 lock verified. `MonthlyEvolutionCard.jsx` still allows G/A/BS edit on prior-year `fy_actual` rows. |
| **Gap vs intent** | Sep 3: past years green=annual collected, total=same; FY2425 annual only; FY2526 month-wise from sheet. FY2425 record still missing. |
| **Effort** | M |
| **Risk** | FY2425 invisible in FY selector; inconsistent past-year display. |

---

### D3 — FY2526 collections data

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | **Prod query:** `sum(collection_entries.collected where fiscal_year=2526)` → **₹693,560,221** vs sheet **₹703,672,234** → gap **−₹10,112,013** (= SP ₹86,27,012 + VP ₹14,85,000). Phase 2 audit: 108/108 leader-month cells pass for 9 mapped leaders. `sp`/`vp` leaders: **do not exist**. FY2526 write-locked (`is_editable: false`). 15 Sep fixes applied per `audit/fix_fy2526/APPLY_LOG.md`. |
| **Gap vs intent** | Sep 3: Nikhil confirmed sheet correct; firm total must match board deck. Outstanding Mar 2026 balances not loaded. |
| **Effort** | S |
| **Risk** | Board deck firm total wrong by ₹1.01 Cr until SP/VP decision. |

---

### D4 — Initial and board plan figures (AK/SP/VP)

| Field | Value |
|-------|-------|
| **Status** | **PARTIAL** |
| **Evidence** | **Prod query:** `ak` board snap `green=0, total=0` vs sheet ₹4.77 Cr. `CODE_TO_LEADER['AK']=None` in `consolidated_service.py` L27. SP/VP: no leader docs. Report [`audit/D4_AK_SP_VP_DEVIATION_REPORT.md`](D4_AK_SP_VP_DEVIATION_REPORT.md) exists in repo — **send to Nikhil not confirmed**. |
| **Gap vs intent** | Sep 3: Rajendra asked if initial/board correct; Nikhil confirmed sheet correct in every regard. |
| **Effort** | S |
| **Risk** | Signed-off plan numbers not in dashboard for AK/SP/VP. |

---

### D5 — Engagements vs snapshot divergence

| Field | Value |
|-------|-------|
| **Status** | **NOT DONE** |
| **Evidence** | **Prod query (FY2627):** NP engagements `blue_sky=30,012,050` matches **July** snap BS; Aug snap BS **−₹42,47,050** stale. **RT:** prior report queried wrong slug `rt` (0 rows); correct slug `ritesh` has **62 engagements / ₹15.01 Cr total** (`audit/e2e/artifacts/q1_rt_ritesh_prod.json`). E2E confirms engagement edits do not auto-sync snapshots. Dual paths: `_auto_upsert_pipeline_snapshot` vs `materialize_leader_derived_data`. |
| **Gap vs intent** | Architectural: if leaders maintain engagements, snapshots must derive from them. Aug plan reached snapshots, not engagement rows (NP/RT pattern from 15 Sep audit **still true on prod**). |
| **Effort** | L |
| **Risk** | Client-level plan numbers stale; leader edits do not flow to board-level snapshots. |

---

## 6. Suggested fix order

| Priority | Items | Reasoning |
|----------|-------|-----------|
| **P0** | A1 (deploy `023555c`), downward-corruption triage | Live data-entry risk; fix exists locally but not on `origin/prod` |
| **P1** | D4 AK mapping, D3 SP/VP decision | Direct deviation from Nikhil's signed sheet; blocks board sign-off |
| **P1** | A5 deadline BSON bug + live smoke test | 0 prod action records; original P0 user complaint |
| **P2** | D1 bluesky chain backfill / converted wiring | Nikhil's most likely next-meeting question |
| **P2** | D5 sync engagements → snapshots for current month | Stops NP-class drift recurring |
| **P3** | A4 filters, B4 month selector, B9 Collections YoY, B2 BIU name | UX commitments; lower data-integrity risk |
| **P4** | B6 filters, B7 role columns, A6 IST, D2 FY2425 | Polish and compliance |
| **Blocked** | B10, B11, B12 | Client/org decisions |

---

## Appendix: Query artifacts (read-only)

| File | Description |
|------|-------------|
| `audit/downward_corruption_scan.json` | 1 downward candidate |
| `audit/implausible_amounts_scan.json` | 0 upward hits |
| `audit/bluesky_chain_validation.json` | 43 formula failures |
| `audit/supplementary_queries.json` | el_status, FY totals, D5 NP/RT, leader checks |
| `audit/scan_downward_corruption.py` | Downward scan script |
| `audit/validate_bluesky_chain.py` | D1 chain validator |
| `audit/supplementary_queries.py` | Supplementary query runner |

**Playwright E2E:** `audit/e2e/` → `audit/E2E_VERIFICATION_REPORT.md` (37/45 tests passed on staging `cbva1_db`).  
**Prior API script:** `audit/local_staging_verification.py` → `audit/local_staging_verification.json` (9/10 pass).

### Run locally against staging DB

```powershell
# Terminal 1 — backend (staging MongoDB, not prod .env)
cd backend
$env:MONGODB_URL="<staging-uri>"
$env:DATABASE_NAME="cbva1_db"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# Terminal 2 — frontend
cd frontend
$env:VITE_API_URL="http://127.0.0.1:8001"
npm run dev

# Terminal 3 — seed + API tests (first run seeds test user)
python audit/local_staging_verification.py
```

**Test login (staging only):** `verify.local@staging.cbva.in` / `VerifyLocal123!`  
**App:** http://localhost:5173

**Security:** Do not commit MongoDB URIs. Rotate staging password if exposed in chat.
