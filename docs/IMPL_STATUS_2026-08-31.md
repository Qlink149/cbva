# CBVA Insight — Implementation status (31 Aug 2026)

Local working-tree tracker. **No PRs opened in this pass.** Fill in Local test after you run the checks. Do not mark [`AUDIT_2026-08.md`](AUDIT_2026-08.md) Phase 4 as shipped until a PR merges.

Plan: [`IMPL_PLAN_2026-08-31.md`](IMPL_PLAN_2026-08-31.md).

| Item | Code | Local test | PR |
|------|------|------------|-----|
| PR0 — FY-lock bypass (fy-actuals, baselines, el-summary, `is_locked`) | done locally | pending | not opened |
| PR0.1 — pipeline snapshot POST/PUT/DELETE FY-lock | done locally | pending | not opened |
| PR1 — T1 scrollbar + T5 widths | done locally | pending | not opened |
| PR2 — T2 column collapse | done locally | pending | not opened |
| PR3 — T3 manager filter (enum + list script + AM+ filter) | done locally | pending | not opened |

---

## What to test

### PR0 — FY-lock bypass

Non-admin token, FY currently `is_editable: false` (likely `2526`). Curl/Postman, not the UI.

- `PUT /api/pipeline/fy-actuals` with that slug → **403**
- `POST /api/baselines/` with that FY key → **403**
- `PUT /api/baselines/{id}` on a locked-FY row → **403**
- `PUT /api/baselines/{id}` on an editable FY with `is_locked: true` → **403** (non-admin), **200** (admin)
- `PUT /api/el-summary/{id}` on a locked-FY row → **403**
- Admin token on the same locked-FY writes → **200**

### PR0.1 — pipeline snapshot FY-lock

Same helper as PR0 (`assert_fy_editable`, admin bypass). Local test stays pending.

- `POST /api/pipeline/` with locked `fiscal_year` → **403** (non-admin), **201** (admin)
- `PUT /api/pipeline/{id}` on a locked-FY snapshot → **403** (non-admin), **200** (admin)
- `DELETE /api/pipeline/{id}` on a locked-FY snapshot → **403** (management), **204** (admin)

FY for PUT/DELETE comes from the existing snapshot row (update payload has no `fiscal_year`).

Backend tests (from `backend/`, with a working venv + MongoDB):

```
python -m pytest tests/test_fy_lock_write_gaps.py -q
```

**Grep of other write routers (this pass):** FY-keyed operational writes already call `assert_fy_editable` (engagements, team, hiring, actions, tasks, meetings, collections, collection_transactions, bluesky, headcount, engagement_actions, el-summary, baselines, fy-actuals, now snapshot POST/PUT/DELETE).

**Found, not this item:** `PUT /api/admin/plans` upserts `pipeline_snapshots` (`initial`/`board`) without calling `assert_fy_editable`. It is admin-only, so the helper would always pass. Catalog writes (leaders, users, financial_years, auth) are not FY operational locks. Engagement saves auto-upsert monthly snapshots behind engagement FY-lock.

**Note:** Pytest needs MongoDB on `localhost:27017`. This pass could not connect (`WinError 10061`). Local test stays pending.

### PR1 — T1 + T5

- Horizontal scrollbar visible on Engagements tab (12px, same size as vertical)
- Sticky left shadows and sticky footer still align after the bar takes ~12–17px
- Header/body/footer financial columns share the same widths (Green/Amber/Blue Sky/Total/Collected/Balance = 112px from `COL_WIDTH`)
- 1280px and ~1440px viewports; two-row sticky header (`top: 0` / `top: 36`) still stacks

### PR2 — T2

- Columns control next to Filters; Manager / Rel. Partner / EL Status hide independently
- Hidden column width is reclaimed by columns to the right
- Reload / leave the page resets all three to visible
- `#`, Client, Scope stay sticky; T1 scrollbar still works

Persist-across-sessions was not built (not a decided requirement).

### PR3 — T3

- Team dropdowns offer the full ladder (Articles … Senior Manager + Other); Assistant Manager selectable
- Manager column filter includes Assistant Manager and above from the roster
- Articles / Associate / Executive / Senior Executive from the roster do **not** appear
- Free-text `person_responsible` names that are not on the roster still appear (option a)
- Run from `backend/`: `python scripts/list_malformed_designations.py` — it **prints** the 6 rows, does not update them

**Hygiene remaining:** the 6 name-as-designation rows and 2 Consultant rows still pass `>= Assistant Manager` until a human corrects them. Option (b) fuzzy name-matching is a follow-up, not this pass.

---

## Notes

- Frontend still has no test setup; T1–T3 are CSS/state-heavy with no automated coverage. Separate recommendation, not this pass.
- Unknown designations (`Consultant`, `"Other"`, person-name rows) rank last in `designationRank` and therefore pass the AM+ cutoff. Do not special-case in code; clean the data.
- Hiring **Level** dropdown in TeamEntryDrawer was left unchanged (separate list including Analyst).

---

## KRA/KPI module (framework)

| Item | Code | Local test | PR |
|------|------|------------|-----|
| KRA schema + seed + admin config + rating rounds + scorecard UI | done locally | pending | not opened |

### What's built

- Three-layer **clone** config (not live inherit): all-time default → FY copy → leader copy for KPIs, category weights, and competencies
- Scorecard uses resolved list for that leader + FY (leader copy if present, else FY, else all-time)
- Admin **KRA** tab: three sections with Copy / Customize / Remove leader copy
- Combined-score stub unchanged (B3 still open)

### Seeded but swappable — not finished client decisions

- **B2 (which scorecard sheet):** All-time KPI rows are still the FY26-27 Leader Scorecard sheet as a **starting default only**. Switching sheets is an admin data edit, not a code change.
- **B3 (averaged vs separate):** Self and ExCo stay separate. `combined_score` is always `null`.
- **4th competency:** still `Pending definition from client` on the all-time row until copied/edited.

Existing FY 26-27 KPI rows (if already seeded) stay as the **FY layer**. All-time is seeded only if that layer is empty.

**Clone note:** rating after you customize a leader uses new KPI ids — earlier ratings on the FY list are not copied onto the clone.

Backend tests (MongoDB required):

```
python -m pytest tests/test_appraisal_permissions.py tests/test_kra_resolve.py -q
```

### Seeded but swappable — not finished client decisions

- **B2 (which scorecard sheet):** KPI rows are seeded from `FY26-27_Leader_Scorecard` (17 KPIs) as a **starting default only**. This is not a decision that the Scorecard sheet is final. Switching to the PerformanceMetric sheet is an admin data edit on the KRA tab, not a code change.
- **B3 (averaged vs separate):** Self and ExCo are stored and shown as separate fields (FY25-26 PDF layout). No blended final score is computed or displayed. `combined_score` on the scorecard API is always `null` (`combined_score_status: pending_spec`). Changing this later is a formula in `compute_combined_score`, not a schema migration.
- **4th competency:** `Judgement, Integrity & Credibility` is seeded with `criteria_text` = `Pending definition from client`. Do not treat that placeholder as a definition.

### Stubbed / parked

- T8 lock-until-management-rates / completeness gating (`locked` state unused)
- Combined/blended score formula
- Parsing rating-band text into auto-scoring
- Persist-on-submit rollup snapshot
- Hide ExCo ratings from the leader until lock
- Reopen-after-submit
- Behavioural KPI rows vs competency block are both stored; scorecard totals use **KPI ratings only** (overlap not merged — client question)

Weight config is three-layer clone as well (all-time / FY / leader). FY defaults still seeded for `2627` (30/35/25/10) and `2526` (40/40/10/10) if those FY copies are empty. All-time weights use the 26-27 split as the starting template only.
