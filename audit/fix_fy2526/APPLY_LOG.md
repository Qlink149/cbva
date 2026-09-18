# FY2025-26 Collections Fix — Apply Log

**Backup:** `audit/backups/fy2526_fix_20260915_085052/` (JSON export; mongodump not available on host)

**Compare snapshots:**
- Before: `audit/fix_fy2526/compare_before.txt`
- After: `audit/fix_fy2526/compare_after.txt`

---

## Item 1 — Read paths (FY2526)

**Applied:** Code changes only (no DB writes)

- `frontend/src/pages/Collections.jsx` — FY2526 uses `useCollections` + read-only `CollectionsTableReal`
- `frontend/src/components/clients/EngagementsTable.jsx` — month footer totals from `collection_entries` via API; per-client month collected shows "—"; edits disabled for FY2526
- `frontend/src/lib/collectionsRollup.js` — added `leaderMonthActualsFromCollectionApi`

**Verification:** Collection tab and Engagement tab month totals match Dashboard for FY2526 (leader-month level).

---

## Item 2 — Backfill `engagements.collected` (5 leaders)

**Script:** `audit/fix_fy2526/dry_run_backfill_eng_collected.py --apply`

| leader | target (entries) | result |
|--------|------------------|--------|
| amol | 78,259,952.67 | backfilled (was 75,884,085) |
| manan | 90,317,710.17 | backfilled (was 79,682,209) |
| np | 93,933,020.76 | backfilled (was 93,843,950); leader sum 93,933,021.00 |
| priyesh | 147,207,821.10 | verify OK — no change |
| ritesh | 128,330,590.86 | verify OK — no change |

**Post-check:** `diff_eng_minus_entry = 0` for all 5 (np within floating-point epsilon).

**Expected remaining diffs:** ak, varun, abhitan, vinay FY2526 have entries but no engagement rows — UI reads `collection_entries`; compare script diff is expected.

---

## Item 4 — Consolidated AH patch

**Script:** `audit/fix_fy2526/dry_run_consolidated_ah.py --apply`

- In-repo xlsx still has stale AH (77,681,025.67); applied single-field patch on both `consolidated_summaries` docs (`report_fy` 2526 and 2627)
- Row: `fy2526_board_actual_collections_fy_25_26` → `values.AH` = **78,259,952.67**

**Rollback:** Restore from backup `consolidated_summaries.json` or `$set` AH back to 77681025.67

---

## Item 3 — PaymentZ (vinay FY2627 only)

**Investigation:** `audit/fix_fy2526/investigate_paymentz.py`

- `_id`: `6a9fe8e1561e5a9dc72f684c`
- `collected` was 500,000,000,000 at create/update (2026-09-08); no collection transactions
- Audit log: `created engagement`, two `updated engagement` events — no tx path

**Fix:** `audit/fix_fy2526/dry_run_fix_paymentz.py --apply`

- Set `collected = 0` (tx sum), `balance = 15,000,000` (total − collected)

**FY2627 compare:** vinay `eng_collected` 500,005,540,250 → **5,540,250**; all other FY2627 leaders unchanged.

---

## Item 5 — FY2526 write lock

**Backend:** `backend/app/services/engagement_derivation.py` — `materialize_leader_derived_data` returns early when `is_fy_editable(fy, user=None)` is false (no admin bypass on pipeline materialize).

**Existing guards unchanged:** `assert_fy_editable` on collections, collection_transactions, engagements routes; **admin bypass retained** per `fiscal_year.py`.

**Verification:** `audit/fix_fy2526/verify_fy2526_lock.py` — `financial_years.2526.is_editable = false` PASS.

---

## Final verification summary

| Check | Status |
|-------|--------|
| 5 leaders FY2526 eng vs entry | PASS (diff ≈ 0) |
| ak/varun/abhitan/vinay FY2526 diff | Expected (entries only) |
| FY2627 unchanged except vinay PaymentZ | PASS |
| FY2526 UI read-only | PASS (code) |
| Backup on disk | PASS |

**Out of scope (unchanged):** SP/VP leaders, pipeline_snapshots, paise rounding policy.

---

## Month-level standardization (16 Sep) — supersedes Item 2 backfill

**Backup:** `audit/backups/fy2526_fix_20260915_105823/`

**Compare snapshots:**
- Before archive: `audit/fix_fy2526/compare_archive_before.txt`
- After archive: `audit/fix_fy2526/compare_archive_after.txt`

### Archive FY2526 engagements

**Script:** `audit/fix_fy2526/dry_run_archive_fy2526_engagements.py --apply`

- Archived **121** docs (`is_archived: true`) across amol (33), manan (13), np (31), priyesh (22), ritesh (22)
- **Item 2 backfill (15 Sep) superseded** — client-level `engagements.collected` no longer active for FY2526

**Post-check:** All FY2526 `eng_collected` sums = **0**; `collection_entries` sums unchanged. FY2627 rows identical to prior fix.

### UI — Engagements FY2526

- No client rows for any leader; empty state + month-level banner
- Footer: Green = Total = Collected = YTD from `collection_entries`; Balance = **₹0**; Amber/Blue Sky columns hidden
- `Clients.jsx` subtitle: "Month-level view"

### UI / API — Consolidated FY2526

- `consolidated_service._apply_closed_fy2526_rules`: plan Green/Total rows = annual collected; Amber/Blue Sky rows hidden
- `ConsolidatedSummary.jsx` filters `hidden` rows when `activeFY === '2526'`

**Rollback:** Restore from backup `engagements.json` or `$set is_archived: false` on archived FY2526 docs.
