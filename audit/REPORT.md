# CBVA Business Leader Dashboard: DB vs Source-of-Truth Audit Report

**Date:** 12 Sep 2026  
**Database:** MongoDB Atlas `cbva1_db` (from `backend/.env`)  
**Source of truth:** `expected_collections_FY25-26_*.csv`, `expected_business_plan_summary.csv`  
**Mode:** Read-only — no DB or code changes applied.

---

## 1. Executive summary

| Area | Match rate | Firm ₹ gap vs sheet |
|---|---|---|
| FY25-26 collections (leader totals via `collection_entries`) | **9 / 12 leaders PASS** (₹1 tolerance) | **−₹10,112,013** (693.56 Cr vs 703.67 Cr) |
| FY25-26 leader×month grid (mapped leaders only) | **108 / 108 PASS** | 0 on present leaders |
| FY25-26 consolidated import (API hist row) | **10 / 12 leaders match entries**; AH stale | **−₹578,927** on AH vs entries; firm import −₹578,927 vs sheet |
| FY26-27 plan snapshots (firm totals, Section 5.1) | **0 / 13 PASS** | **−₹60.9 Cr to −₹70.0 Cr** per snapshot |
| FY26-27 monthly actuals (Apr–Jul, leader level) | **~20 / 99 cells PASS** | Large gaps; Apr firm tx ₹5.87 Cr vs sheet ₹3.16 Cr per leader sum mismatch |
| Receipt-level FY25-26 (1,309 rows) | **CANNOT_VERIFY** | No receipt documents in DB |

**Overall:** FY25-26 **monthly aggregates for the nine leaders present in `collection_entries` match the sheet closely**. The firm total fails only because **SP (₹86.27L) and VP (₹14.85L) have no leader records or collection rows**. FY26-27 **plan numbers in `pipeline_snapshots` materially diverge from the Summary sheet** for AK (initial/board zeros), SP/VP (missing), and firm totals (~₹61–70 Cr short). **Consolidated Summary import values match the expected CSV** for static rows; live API overrides and snapshots do not.

### Top 3 root causes (with evidence)

1. **Leader mapping gaps (SP, VP missing; AK blank in app mapping)** — `leaders` has 10 docs, no `sp` or `vp`. `consolidated_service.CODE_TO_LEADER` maps `AK`, `SP`, `VP` → `None` ([`backend/app/services/consolidated_service.py`](backend/app/services/consolidated_service.py) L25–38). AK `pipeline_snapshots` board/initial are **0/0/0/0** while sheet Board AK total is ₹4.77 Cr; Aug monthly snap for `ak` is ₹3.96 Cr.

2. **FY25-26 collections stored as month aggregates, not receipts** — Query: `db.collection_transactions.find({fiscal_year:"2526"})` → **0 docs**. FY25-26 actuals live on `collection_entries.collected` (108 docs, 9 leaders × 12 months). Row-level match (Date × Invoice × party × Gross × Partner) is impossible → `CANNOT_VERIFY_NO_SOURCE`.

3. **Transmission / design: live recomputation vs frozen sheet** — Bluesky Known/Unidentified uses **current** `engagements.blue_sky` against monthly snap BS ([`consolidated_service._leader_bundle`](backend/app/services/consolidated_service.py) L141–163). Monthly snapshots are **mutable** (`updated_at` into Sep 2026). Historical snapshot-as-of-date cannot be reproduced from `audit_log` alone → `CANNOT_VERIFY_NO_SOURCE` for point-in-time history.

---

## 2. Discovery findings (Section 3)

### 2.1 MongoDB collections

| Collection | Count | Sample / field types |
|---|---|---|
| `engagements` | 509 | `green`, `amber`, `blue_sky`, `collected`, `total`, `balance`: **int rupees**; `fiscal_year`: `"2526"`/`"2627"`; `created_at`/`updated_at`: **UTC datetime** (naive stored) |
| `leaders` | 10 | `_id` slug (`manan`, `ak`, `biu`, …); **no Excel code field** |
| `users` | 13 | `leader_id` links user → leader; `amit.sh@cbva.in` → `biu` |
| `clients` | 0 | Unused |
| `pipeline_snapshots` | 83 | `snapshot_type`: `initial`/`board`/`monthly`/`fy_actual`; `green`/`amber`/`blue_sky`/`total`: int; `label`: e.g. `"Board Plan (2026-27)"`, `"August 2026"` |
| `baseline_plans` | 0 | — |
| `collection_entries` | 133 | FY2526: `month`: `"April 2025"` … `"March 2026"`; `collected`/`planned`: int; FY2627: sparse planned months |
| `collection_transactions` | 142 | **FY2627 only**; `month`: `"04"`…`"09"`; `amount_collected`/`amount_billed`: int; **no Date, Invoice, GST, TDS** |
| `consolidated_summaries` | 2 | `report_fy` 2526 & 2627; 82 rows each; `values` dict keyed AH…VS |
| `audit_log` | 1060 | `source`: ui/system/auth; earliest `2026-07-24` |
| `financial_years` | 2 | `2526` (not editable), `2627` (current) |
| `blue_sky_entries` | 21 | Ledger opening/additional/converted/closing |

Full dump: [`audit/discovery.json`](discovery.json) via `python audit/discovery.py`.

### 2.2 Is `engagements` the single source for every dashboard number?

**No.** Multi-collection model:

| Dashboard metric | Primary store | API |
|---|---|---|
| FY25-26 Actual Collections (Summary row 22) | **`consolidated_summaries`** static import + **`collection_entries`** aggregates | `GET /api/consolidated-summary`; Leader dashboard uses `collection_entries` / no live FY2526 txs |
| FY26-27 plan snapshots (Initial/Board/Monthly) | **`pipeline_snapshots`** + materialized from consolidated | `GET /api/pipeline`, `GET /api/consolidated-summary` (dynamic rows) |
| Bluesky Known / Unidentified | **`engagements.blue_sky`** + **`pipeline_snapshots`** monthly BS (live min formula) | `GET /api/consolidated-summary` `_dynamic_value` bifur |
| FY26-27 monthly planned / actual | **`collection_entries`** + **`collection_transactions`** | `GET /api/collections` [`list_collections`](backend/app/routers/collections.py) L43–108 |
| Bluesky Achieved, Variance FY25-26, Collections % | **Imported static** in `consolidated_summaries` | Not in `DYNAMIC_PARTS` |

### 2.3 How data got into the DB

| Path | Evidence |
|---|---|
| Consolidated Excel → Mongo | `consolidated_import.parse_consolidated_xlsx` → `consolidated_summaries`; `source_file`: `Business Plan_Consolidated_FY 2026-27.xlsx` |
| Engagements / snapshots | Earliest `engagements.created_at`: **2026-07-09**; no in-repo receipt importer |
| Per-leader CSV/XLSX under `backend/csv/`, `csv-templates/` | **Assets only** — no automated loader found |
| Audit trail | `audit_log` from **2026-07-24** (UI edits); no import batch log for collections |

### 2.4 Date handling

| Topic | Behavior | Location |
|---|---|---|
| Storage | UTC datetimes (`datetime.now(timezone.utc)`) | Widespread |
| API display | IST (`Asia/Kolkata`) | [`frontend/src/lib/datetime.js`](frontend/src/lib/datetime.js) |
| Audit date filters | YYYY-MM-DD as IST day → UTC | [`serialization.py`](backend/app/core/serialization.py) L18–39 |
| FY | Indian Apr–Mar; slug `2526`, `2627` | [`fiscal_year.py`](backend/app/services/fiscal_year.py) L9–18 |
| Collection month FY2526 | **Pre-bucketed** label `"April 2025"` on `collection_entries` — not receipt Date | [`collections.py`](backend/app/routers/collections.py) L35–40 |
| Collection month FY2627 txs | Two-digit key `"04"` on `collection_transactions` | [`collection_transaction.py`](backend/app/schemas/collection_transaction.py) L10 |
| Elapsed months | `date.today()` (server local, not forced IST) | [`fy_calendar.py`](backend/app/services/fy_calendar.py) |

**Timezone signature (1st-of-month receipts):** Not testable at row level — no receipt dates in DB.

### 2.5 Revenue definition in code

**No Gross − GST − Forex; no TDS.**

```1:4:backend/app/services/engagement_service.py
def compute_totals(green: int, amber: int, blue_sky: int, collected: int) -> dict:
    total = green + amber + blue_sky
    balance = total - collected
```

Collections actual = sum of `amount_collected` on txs, else `collection_entries.collected` ([`collections.py`](backend/app/routers/collections.py) L81–83).

### 2.6 Snapshot handling

| Snapshot | Stored as | Mutable? |
|---|---|---|
| Initial / Board FY26-27 | `pipeline_snapshots` `snapshot_type` initial/board; also in `consolidated_summaries` | Admin-frozen in derivation for initial/board writes; **AK board/initial = 0 in DB** |
| Early April … Aug monthly | `pipeline_snapshots` monthly + consolidated import rows | **Current month overwritten** from engagements on save |
| FY25-26 actual on Summary | Static `consolidated_summaries` row `fy2526_board_actual_collections_fy_25_26` | Import-only for display; **AH value stale vs current sheet** |
| Historical as-of reconstruction | **Not supported** | `audit_log` exists but snaps overwritten |

---

## 3. Phase 2 — FY 2025-26 collections

### 3.1 Side-by-side: Section 4.1 leader totals

Run: `python audit/side_by_side_tables.py`

| Leader | Sheet Revenue | DB `collection_entries` | Consol import | Status |
|---|---|---|---|---|
| AH | 78,259,952.67 | 78,259,952 | 77,681,026 | PASS / import FAIL |
| AK | 21,414,813.83 | 21,414,814 | 21,414,814 | PASS |
| AM | 4,561,167.00 | 4,561,167 | 4,561,167 | PASS |
| MM | 90,317,710.17 | 90,317,710 | 90,317,710 | PASS |
| NP | 93,933,020.76 | 93,933,021 | 93,933,021 | PASS |
| PV | 147,207,821.10 | 147,207,821 | 147,207,821 | PASS |
| RT | 128,330,590.86 | 128,330,591 | 128,330,591 | PASS |
| **SP** | **8,627,012.20** | **—** | 8,627,012 | **FAIL** |
| VC | 126,385,145.81 | 126,385,145 | 126,385,146 | PASS |
| **VP** | **1,485,000.00** | **—** | 1,485,000 | **FAIL** |
| VS | 3,150,000.00 | 3,150,000 | 3,150,000 | PASS |
| **TOTAL** | **703,672,234.40** | **693,560,221** | **703,093,307** | **FAIL** |

**Query (leader totals):** Python sum over `db.collection_entries.find({fiscal_year:"2526"})` grouped by `leader_id` → mapped to codes via `LEADER_TO_CODE` in [`audit/db_util.py`](db_util.py).

**Month grid:** 108 comparable cells (9 leaders × 12 months) **all PASS** within ₹10 tolerance. Failures are only SP/VP months (9 cells) where leaders are absent.

### 3.2 Receipt-level reconciliation

| Metric | Sheet | DB |
|---|---|---|
| Receipt rows | 1,309 | 0 (`collection_transactions` fy=2526) |
| Match key Date×Invoice×party×Gross×Partner | N/A | **CANNOT_VERIFY_NO_SOURCE** |

### 3.3 Diagnostic signatures checked

| Signature | Result |
|---|---|
| DB lower by total TDS (₹64.13 Cr) | **Not observed** — entries match Revenue, not Gross−TDS |
| Timezone 1st-of-month shift | **Not testable** — no receipt dates |
| Whole leader column zero/missing | **SP, VP missing** — confirmed |
| TDS deduction in code | **No TDS fields in codebase** |
| O/S total ₹4.07 Cr imported as receipts | **Not observed** — O/S rows not in `collection_entries` |
| Consolidated import vs entries | **AH import ₹77.68 Cr vs entries ₹78.26 Cr** — `TIME_SNAPSHOT_MISMATCH` on older xlsx |

---

## 4. Phase 3 — FY 2026-27 business plan

### 4.1 Side-by-side: Section 5.1 firm snapshot totals

| Snapshot | Sheet | DB sum (mapped leaders' snaps) | Status |
|---|---|---|---|
| Initial Green | 429,830,100 | 417,577,600 | FAIL |
| Initial Amber | 57,603,500 | 54,003,500 | FAIL |
| Initial Bluesky | 275,220,000 | 221,072,500 | FAIL |
| Initial Total | 762,653,600 | 692,653,600 | FAIL |
| Board Green | 453,040,146 | 432,013,646 | FAIL |
| Board Amber | 118,641,784 | 114,641,784 | FAIL |
| Board Bluesky | 426,413,186 | 390,541,080 | FAIL |
| Board Total | 998,095,116 | 937,196,510 | FAIL |
| Apr Total | 998,095,116 | 984,921,116 | FAIL |
| May Total | 1,019,554,040 | 1,006,380,040 | FAIL |
| Jun Total | 1,019,554,040 | 1,006,380,040 | FAIL |
| Jul Total | 1,013,815,415 | 1,000,641,415 | FAIL |
| Aug Total | 1,016,635,020 | 1,003,461,020 | FAIL |

**Note:** `consolidated_summaries.values` for static import rows **match** `expected_business_plan_summary.csv` for Initial/Board/Apr (e.g. Initial Green firm 429,830,100 in both). **`pipeline_snapshots` sums fall short** primarily because **AK initial/board are zero**, **SP/VP snaps missing**, and monthly totals drift from live engagement updates.

**Query:** `db.pipeline_snapshots.find({fiscal_year:"2627", snapshot_type:"board"})` summed by `green`/`amber`/`blue_sky`/`total`.

### 4.2 Bluesky bifurcation

Sheet logic: Unidentified input; Known = Total − Unidentified.  
Code logic: `known = min(sum(engagements.blue_sky), monthly_snap.blue_sky)`; `unidentified = total − known` ([`consolidated_service.py`](backend/app/services/consolidated_service.py) L151–163).

**92 bifur mismatches** — all classified `TRANSMISSION_OR_CALC_ERROR`: live engagement BS sums today ≠ sheet's frozen Unidentified/Known at snapshot dates.

### 4.3 Monthly planned vs actual FY26-27

| Month | Sheet firm actual | DB tx sum by month | Notes |
|---|---|---|---|
| Apr 2026 | 31,567,663 | 5,871,824 (142 txs total; 6 in Apr) | Leader-level sheet cells largely **0 in DB** for Apr |
| May 2026 | 45,031,783 | 24,041,000 | Partial |
| Jun 2026 | 49,332,435 | 74,555,594 | DB **higher** than sheet at firm tx level |
| Jul 2026 | 37,142,230 | 23,810,526 | Sheet Jul actual blank in some rows; DB has txs |
| Aug 2026 | blank in sheet | 28,934,803 | **EXTRA_IN_DB** — informational |

**May plan:** DB stores one `collection_entries.planned` per month; sheet has **original** (₹5.68 Cr firm) and **25 May revision** (₹4.78 Cr) — only one can be stored.

**Collections upto / Collections %:** Sheet row 96 uses upto-June ÷ July plan (quirk 6.2.5). Code: dynamic `coll_upto_*` sums tx/entry actuals ([`consolidated_service._dynamic_value`](backend/app/services/consolidated_service.py) L240–247); Collections % row is **static import**, not recomputed.

### 4.4 Derived metrics

| Metric | Sheet | Code | Match? |
|---|---|---|---|
| Bluesky Achieved Apr 2026 (firm ₹52.72L) | (G+A May)−(G+A Apr) per leader | Static `hist_bluesky_achieved_04`; recompute from **current** snaps | **PASS on some leaders** when snaps unchanged; design risk if snaps edited |
| Variance FY25-26 | Actual − Board plan | Static import `fy2526_board_variance_in_collections_vs_board_plan_fy_25_26` | Import matches sheet CSV |
| Collections upto | Cumulative actuals | `_dynamic_value` coll_upto | Depends on tx/entry actuals |

### 4.5 Time check

- **Snapshot as-of date:** Cannot reproduce Leader×Category at each historical snapshot date from `audit_log` alone — monthly snaps overwritten (`updated_at` Sep 2026). → `P3-TIME-HISTORY` `CANNOT_VERIFY_NO_SOURCE`.
- **Status change timestamps vs effective month:** Not stored separately; only `engagements.updated_at`.
- **Seed timing:** Consolidated import from in-repo xlsx; user sheet modified 1 Sep 2026 — AH FY2526 actual import differs from expected CSV by ₹578,927 → `TIME_SNAPSHOT_MISMATCH`.

---

## 5. Mismatch table

Full export: [`audit/mismatches.csv`](mismatches.csv) (**245 rows**).  
Regenerate: `python audit/export_mismatches.py` after running phase scripts.

### Representative issues

| ID | Area | Leader | Period | Sheet | DB | API/UI | Diff | Classification | Root cause | Code/DB location | Proposed fix |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P2-FIRM-TOTAL | Collections FY25-26 | TOTAL | FY25-26 | 703,672,234 | 693,560,221 | 703,093,307 | −10,112,013 | DB_DATA_ERROR | SP+VP not in `collection_entries` | `db.collection_entries` fy=2526 | Add SP/VP leaders + 12 monthly collected rows |
| P2-LEADER-TOTAL-SP | Collections FY25-26 | SP | FY25-26 | 8,627,012 | null | 8,627,012 | +8,627,012 | MISSING_IN_DB | No `leaders` doc for SP | `leaders`; CODE_TO_LEADER SP→None | Create leader `sp` / SPB |
| P2-LEADER-TOTAL-VP | Collections FY25-26 | VP | FY25-26 | 1,485,000 | null | 1,485,000 | +1,485,000 | MISSING_IN_DB | No `leaders` doc for VP | same | Create leader for Vinay Pathak (VP) |
| P2-CONSOL-ACTUAL-AH | Collections FY25-26 | AH | FY25-26 hist | 78,259,953 | 77,681,026 | 77,681,026 | −578,927 | TIME_SNAPSHOT_MISMATCH | Stale consolidated import vs current sheet; entries correct | `consolidated_summaries` row_key `fy2526_board_actual_collections_fy_25_26` | Re-import Summary Actual FY25-26 |
| P2-RECEIPT-LEVEL | Collections FY25-26 | ALL | FY25-26 | 1,309 rows | 0 txs | — | — | CANNOT_VERIFY_NO_SOURCE | No receipt schema / no FY2526 txs | `collection_transactions` | Import receipts if row audit required |
| P3-LEADER-AK-MAP | Leader mapping | AK | consolidated | Column C | ak exists | AK=None in CODE_TO_LEADER | — | LEADER_MAPPING_ERROR | Board/initial snaps 0; live override skips AK | `consolidated_service.py` L27; `engagement_derivation.py` L17–27 | Map AK→`ak`; re-materialize board/initial |
| P3-SNAP-board-x-total-AK | Plan snapshot | AK | Board Total | 47,724,606 | 0 | 47,724,606 | −47,724,606 | LEADER_MAPPING_ERROR | pipeline_snapshots board for ak all zero | `db.pipeline_snapshots` leader_id=ak type=board | Load board values from Summary |
| P3-SNAP-monthly-Aug 2026-total-SP | Plan snapshot | SP | Aug Total | 13,174,000 | null | 13,174,000 | — | MISSING_IN_DB | SP leader absent | `pipeline_snapshots` | Create SP leader + snaps |
| P3-BIFUR-UID-04-AH | Plan snapshot | AH | Apr Unidentified BS | 494,000 | (live calc) | live | varies | TRANSMISSION_OR_CALC_ERROR | Bifur recomputed from current engagements | `_leader_bundle` L151–163 | Store frozen bifur per snapshot |
| P3-ACT-04-AH | Monthly plan-actual | AH | Apr 2026 actual | 8,477,303 | 0 | 0 | −8,477,303 | DB_DATA_ERROR | No Apr tx for amol; partial firm Apr tx ₹5.87 Cr | `collection_transactions` month=04 | Align FY2627 actual import with sheet |
| P3-AUG-EXTRA-AH | Monthly plan-actual | AH | Aug 2026 | blank | 4,459,742 | 4,459,742 | +4,459,742 | EXTRA_IN_DB | Sheet Aug actual blank; DB has txs | `collection_transactions` month=08 | Confirm with CBVA — not sheet error |
| P3-TIME-HISTORY | Time | ALL | All snapshots | frozen | mutable snaps | live | — | CANNOT_VERIFY_NO_SOURCE | No immutable snapshot versions | `pipeline_snapshots`; `engagements.py` auto-upsert | Append-only snapshot history |

---

## 6. Confirm with CBVA (Section 6 quirks — not counted as DB bugs)

| # | Item | ₹ impact (approx.) |
|---|---|---|
| 6.1.1 | Revenue = Gross − GST − Forex; TDS not deducted | N/A (sheet rule; DB stores Revenue as entered) |
| 6.1.2 | GST-only receipts booked as revenue (AETN18, Reliance Bally, etc.) | Small — keep sheet values in comparison |
| 6.1.3 | Placeholder receipts (₹1 Raymond, ₹250 Hasmukh Shah, etc.) | Negligible |
| 6.1.4 | No-invoice AH rows (Forex ₹15.71L, Not Identify ₹53.5K) | ~₹16.2L — confirm inclusion |
| 6.1.5 | Split invoices across leaders (ESR, Prism Johnson) | Affects leader attribution if importing receipts |
| 6.1.6 | Possible double receipts (Mukta A2, Whistling Woods, etc.) | Confirm with Accounts |
| 6.1.7–6.1.9 | Vertical/party spelling variants; AH columns A/ab | Normalization only |
| 6.2.3 | May shortfall row uses original plan not 25 May revision | Reporting quirk |
| 6.2.5 | Collections % = upto-June ÷ July plan | Confirm intended denominator |
| 6.2.9 | BIU label "Amit Shah"; VP no FY26-27 plan but May actual ₹50K; SP May actual ₹18L | VP/SP mapping decisions |

---

## 7. Verification scripts

All under [`audit/`](.) — read-only.

| Script | Purpose |
|---|---|
| [`discovery.py`](discovery.py) | Collection counts + samples → `discovery.json` |
| [`phase2_collections_fy2526.py`](phase2_collections_fy2526.py) | FY25-26 leader/month vs CSV → `phase2_results.json` |
| [`phase3_business_plan.py`](phase3_business_plan.py) | FY26-27 snapshots, bifur, monthly → `phase3_results.json` |
| [`side_by_side_tables.py`](side_by_side_tables.py) | Prints Section 4.1 & 5.1 with **PASS/FAIL** |
| [`export_mismatches.py`](export_mismatches.py) | Flattens mismatches → `mismatches.csv` |
| [`run_all.py`](run_all.py) | Runs phase2 + phase3 + side-by-side |
| [`db_util.py`](db_util.py) | Shared Mongo connection (uses `backend/.env` `DATABASE_NAME=cbva1_db`) |

**Run full audit:**

```bash
cd c:\Users\pc\Desktop\clara\cbva
python audit/run_all.py
python audit/export_mismatches.py
```

**Example DB queries used (read-only):**

```javascript
// Leader FY2526 collected totals
db.collection_entries.find({ fiscal_year: "2526" })

// FY2526 receipts (empty)
db.collection_transactions.find({ fiscal_year: "2526" })

// Consolidated FY25-26 actual row
db.consolidated_summaries.findOne(
  { report_fy: "2627" },
  { rows: { $elemMatch: { row_key: "fy2526_board_actual_collections_fy_25_26" } } }
)

// Board plan snapshots
db.pipeline_snapshots.find({ fiscal_year: "2627", snapshot_type: "board" })

// FY2627 actuals by month (Python sum; Atlas $sum blocked on this user)
db.collection_transactions.find({ fiscal_year: "2627" })
```

---

## 8. Recommended fix priority (not applied)

1. Add **SP** and **VP** leaders; load FY2526 `collection_entries` and FY2627 pipeline/collections.  
2. Fix **AK** in `CODE_TO_LEADER` / `LEADER_TO_CODE`; re-materialize **initial** and **board** `pipeline_snapshots` from current Summary.  
3. Re-import **consolidated_summaries** FY25-26 actual row (AH ₹578,927 gap).  
4. Decide FY2627 **actuals import strategy** (receipt-level vs monthly); align `collection_transactions` with sheet Apr–Jul.  
5. Store **immutable snapshot versions** and frozen **bifur** values per snapshot date.

---

*End of report. No database or application code was modified during this audit.*
