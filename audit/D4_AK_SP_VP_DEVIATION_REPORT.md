# D4 Deviation Report: AK / SP / VP Leader Mapping

**To:** Nikhil Popli (CBVA)  
**From:** Clara AI engineering (verification pass, 15 Sep 2026)  
**Subject:** Dashboard figures vs signed-off business plan sheet — AK, SP, VP  
**Source of truth:** Business plan sheet confirmed correct on 3 Sep 2026 call

---

## Summary

Three leader codes in the consolidated business plan **do not map correctly** in the live CBVA dashboard. This causes:

1. **AK** — Initial and Board plan snapshots show **₹0** while the sheet has **₹4.77 Cr** (board total).
2. **SP (SPB)** — No leader record; FY25-26 collections **₹86,27,012.20** missing from DB totals.
3. **VP (Vinay Pathak)** — No leader record; FY25-26 collections **₹14,85,000** missing from DB totals.

**Combined firm-level gap on FY25-26 collections:** **₹1,01,12,012.20**  
Dashboard firm total: **₹69.36 Cr** vs sheet **₹70.37 Cr**

---

## AK — Leader exists, mapping broken for Initial/Board

| Metric | Sheet | DB `pipeline_snapshots` | Gap |
|--------|------:|------------------------:|----:|
| Board — Green | ₹1.23 Cr | ₹0 | −₹1.23 Cr |
| Board — Amber | ₹0.36 Cr | ₹0 | −₹0.36 Cr |
| Board — Blue Sky | ₹5.41 Cr | ₹0 | −₹5.41 Cr |
| **Board — Total** | **₹4.77 Cr** | **₹0** | **−₹4.77 Cr** |

**Root cause:** `leaders` has `_id: "ak"`, and AK **monthly** snapshots are present and correct. But `CODE_TO_LEADER['AK'] = None` in [`backend/app/services/consolidated_service.py`](../backend/app/services/consolidated_service.py), so `materialize_leader_derived_data` **skips AK** when writing Initial/Board rows.

**Evidence:** `audit/phase3_results.json` → `P3-SNAP-board-x-total-AK`

**Proposed fix:** Set `CODE_TO_LEADER['AK'] = 'ak'` and add `'ak': 'AK'` to `LEADER_TO_CODE` in `engagement_derivation.py`; re-materialize Initial/Board snapshots.

---

## SP — Missing leader entirely

| Metric | Sheet | DB |
|--------|------:|---:|
| FY25-26 collections (annual) | ₹86,27,012.20 | No `leaders` doc, no `collection_entries` |

**Evidence:** `audit/phase2_results.json` → `P2-LEADER-TOTAL-SP`, `audit/phase3_results.json` → `P3-LEADER-SP`

**Note:** Sheet column label is **SP** (business plan identifies as SPB). Needs CBVA confirmation of display name and whether SP is a separate practice leader or rolls up elsewhere.

---

## VP — Missing leader entirely

| Metric | Sheet | DB |
|--------|------:|---:|
| FY25-26 collections (annual) | ₹14,85,000 | No `leaders` doc, no `collection_entries` |

**Evidence:** `audit/phase2_results.json` → `P2-LEADER-TOTAL-VP`, `audit/phase3_results.json` → `P3-LEADER-VP`

**Note:** Sheet column **VP** = Vinay Pathak (distinct from **VS** = Vinay Shah, who exists as `leader_id: vinay`).

---

## Impact on sign-off

| Area | Status |
|------|--------|
| FY25-26 leader×month grid (9 mapped leaders) | **108/108 PASS** |
| FY25-26 firm collections total | **FAIL** — short by ₹1.01 Cr |
| FY26-27 Initial/Board snapshots (firm) | **FAIL** — AK zeros contribute to ~₹61–70 Cr firm gap |
| Board deck parity | **Will not match** until SP/VP loaded and AK mapping fixed |

---

## Requested decision from CBVA

1. **AK:** Confirm fix — map AK → `ak` and re-materialize Initial/Board? (No new leader needed.)
2. **SP:** Create new leader record? What display name (`SPB` / full name)? Load FY25-26 monthly collections from sheet?
3. **VP:** Create new leader for Vinay Pathak? Confirm distinct from VS (Vinay Shah).
4. **Sign-off:** Accept firm total excluding SP/VP until leaders are added, or block sign-off until resolved?

---

*Generated from read-only audit artifacts. No production DB or code changes applied in this report.*
