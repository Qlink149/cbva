# SP / VP Leader Decision Brief

**Status:** **BLOCKED — awaiting CBVA decision**  
**Date:** 15 Sep 2026  
**Blocks:** Board sign-off on firm FY25-26 collections total; consolidated summary firm roll-up

---

## Why this matters

The signed-off business plan sheet includes two leader columns that **do not exist** in the CBVA `leaders` collection:

| Code | Sheet FY25-26 collections | DB |
|------|--------------------------:|----|
| **SP** (SPB) | ₹86,27,012.20 | Missing |
| **VP** (Vinay Pathak) | ₹14,85,000.00 | Missing |
| **Combined** | **₹1,01,12,012.20** | **₹0** |

Firm dashboard total reads **₹69.36 Cr** where the sheet says **₹70.37 Cr**.

All other mapped leaders (AH, AM, MM, BIU, NP, PV, RT, VC, VS, AK) have correct month-level `collection_entries` for FY25-26.

---

## Options

### Option A — Add both leaders (recommended for sheet parity)

1. Create `leaders` documents for SP and VP with agreed display names.
2. Create user accounts if they need dashboard access.
3. Load FY25-26 monthly `collection_entries` from Nikhil's sheet (12 months × 2 leaders = 24 rows).
4. For FY26-27: load Initial/Board snapshots and engagements as needed.
5. Update `CODE_TO_LEADER` / `LEADER_TO_CODE` mappings.

**Effort:** ~1–2 days engineering after names confirmed.  
**Outcome:** Firm total matches sheet; board deck reconciles.

### Option B — Exclude SP/VP from dashboard scope

1. Document explicitly that CBVA dashboard covers 10 practice leaders only.
2. Show firm total as "partial" with footnote excluding SP/VP.
3. Keep consolidated import rows for SP/VP in static summary only (read-only).

**Effort:** ~0.5 day (UI footnote + documentation).  
**Outcome:** Firm total will **never** match sheet without manual adjustment.

### Option C — Roll up into existing leaders

If SP/VP collections belong under another leader's practice (e.g. rolled into AH or VS), reassign sheet amounts and **do not** create new leader records.

**Requires:** Written confirmation from Nikhil on allocation.

---

## Questions for Nikhil

1. Should **SP (SPB)** and **VP (Vinay Pathak)** appear as separate leaders in the dropdown?
2. What are the correct **display names**? (e.g. "Amit Shah" style for BIU.)
3. Do SP/VP need **login access**, or are they reporting-only rows?
4. For FY26-27 plan: will SP/VP have engagement rows leaders maintain, or collections-only?

---

## Dependency

This decision is **independent of** the AK mapping fix (AK leader already exists; only `CODE_TO_LEADER` needs updating). Both should be resolved before board sign-off.

**Related report:** [`audit/D4_AK_SP_VP_DEVIATION_REPORT.md`](D4_AK_SP_VP_DEVIATION_REPORT.md)
