"""Phase 2: FY 2025-26 collections reconciliation (read-only).

Compares expected CSVs to:
  - collection_entries (monthly aggregates, fiscal_year=2526)
  - collection_transactions (expect none for 2526)
  - consolidated_summaries hist actual row

Does NOT write to MongoDB.
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "audit"))

from db_util import (  # noqa: E402
    CODE_TO_LEADER,
    LEADER_TO_CODE,
    MONTH_KEY_TO_YM,
    ROOT as REPO_ROOT,
    TOL_FY_TOTAL,
    TOL_LEADER_MONTH,
    get_db,
    month_key_from_entry_label,
    nearly_equal,
    pass_fail,
)

EXPECTED_ROWS = REPO_ROOT / "expected_collections_FY25-26_rows.csv"
EXPECTED_LM = REPO_ROOT / "expected_collections_FY25-26_leader_month.csv"
OUT_JSON = Path(__file__).resolve().parent / "phase2_results.json"

LEADER_CODES = ["AH", "AK", "AM", "MM", "NP", "PV", "RT", "SP", "VC", "VP", "VS"]


def load_expected_leader_month() -> dict[str, dict[str, float]]:
    """month(YYYY-MM) -> {code: revenue} plus TOTAL row."""
    grid: dict[str, dict[str, float]] = {}
    with EXPECTED_LM.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            month = row["month"]
            grid[month] = {c: float(row[c] or 0) for c in LEADER_CODES}
            grid[month]["TOTAL"] = float(row["TOTAL"] or 0)
    return grid


def load_expected_receipt_stats() -> dict:
    receipts = 0
    outstanding = 0
    by_leader = defaultdict(lambda: {"n": 0, "revenue": 0.0, "gross": 0.0, "gst": 0.0, "tds": 0.0, "forex": 0.0})
    with EXPECTED_ROWS.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("row_type") == "OUTSTANDING_SUMMARY":
                outstanding += 1
                continue
            receipts += 1
            code = row.get("leader_code") or ""
            if code not in LEADER_CODES:
                continue
            by_leader[code]["n"] += 1
            by_leader[code]["revenue"] += float(row.get("Revenue") or 0)
            by_leader[code]["gross"] += float(row.get("Gross Amount") or 0)
            by_leader[code]["gst"] += float(row.get("GST Amt.") or 0)
            by_leader[code]["tds"] += float(row.get("TDS") or 0)
            by_leader[code]["forex"] += float(row.get("Forex") or 0)
    return {"receipt_rows": receipts, "outstanding_rows": outstanding, "by_leader": dict(by_leader)}


async def pull_db() -> dict:
    client, db = get_db()
    try:
        tx_2526 = []
        async for t in db.collection_transactions.find({"fiscal_year": "2526"}):
            tx_2526.append(t)

        entries: list[dict] = []
        async for e in db.collection_entries.find({"fiscal_year": "2526"}):
            entries.append(e)

        consol = await db.consolidated_summaries.find_one({"report_fy": "2627"})
        hist_actual = None
        if consol:
            for r in consol.get("rows") or []:
                if r.get("row_key") == "fy2526_board_actual_collections_fy_25_26":
                    hist_actual = r.get("values") or {}
                    hist_actual_total = r.get("imported_total")
                    break
            else:
                hist_actual_total = None
        else:
            hist_actual_total = None

        leaders = []
        async for L in db.leaders.find({}):
            leaders.append({"_id": L.get("_id"), "name": L.get("name")})

        return {
            "tx_2526_count": len(tx_2526),
            "entries": entries,
            "hist_actual": hist_actual,
            "hist_actual_total": hist_actual_total,
            "leaders": leaders,
        }
    finally:
        client.close()


def entries_to_grid(entries: list[dict]) -> dict[str, dict[str, float]]:
    """Return month YYYY-MM -> {code: collected} from collection_entries."""
    grid: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    leader_totals: dict[str, float] = defaultdict(float)
    missing_month_labels = []
    for e in entries:
        lid = e.get("leader_id")
        code = LEADER_TO_CODE.get(lid)
        if not code:
            continue
        mk = month_key_from_entry_label(str(e.get("month") or ""))
        if not mk or mk not in MONTH_KEY_TO_YM:
            missing_month_labels.append(e.get("month"))
            continue
        ym = MONTH_KEY_TO_YM[mk]
        amt = float(e.get("collected") or 0)
        grid[ym][code] += amt
        leader_totals[code] += amt
    return {"by_month": {m: dict(v) for m, v in grid.items()}, "by_leader": dict(leader_totals)}


def compare(expected_lm: dict, db_grid: dict, hist_actual: dict | None, hist_total, receipt_stats) -> dict:
    mismatches = []
    side_by_side = []

    db_by_month = db_grid["by_month"]
    db_by_leader = db_grid["by_leader"]

    # Leader totals
    for code in LEADER_CODES:
        sheet = expected_lm.get("TOTAL", {}).get(code, 0.0)
        db_val = db_by_leader.get(code)
        # SP/VP: no leader in DB
        if CODE_TO_LEADER.get(code) is None:
            if sheet and abs(sheet) > TOL_FY_TOTAL:
                mismatches.append(
                    {
                        "id": f"P2-LEADER-TOTAL-{code}",
                        "area": "Collections FY25-26",
                        "leader": code,
                        "period": "FY25-26 TOTAL",
                        "sheet": sheet,
                        "db": None,
                        "api_ui": (hist_actual or {}).get(code) if hist_actual else None,
                        "diff": None if sheet is None else sheet,
                        "classification": "MISSING_IN_DB",
                        "root_cause": f"Leader code {code} has no leaders document / collection_entries; sheet has ₹{sheet}",
                        "location": "leaders collection; CODE_TO_LEADER in consolidated_service.py",
                        "proposed_fix": f"Create leader for {code} and load FY2526 monthly collected from sheet",
                    }
                )
            side_by_side.append(
                {
                    "leader": code,
                    "sheet": sheet,
                    "db_entries": None,
                    "consol_import": (hist_actual or {}).get(code) if hist_actual else None,
                    "status": "FAIL",
                }
            )
            continue

        consol_val = (hist_actual or {}).get(code) if hist_actual else None
        ok_db = nearly_equal(db_val, sheet, TOL_FY_TOTAL) if db_val is not None else False
        ok_consol = nearly_equal(consol_val, sheet, TOL_FY_TOTAL) if consol_val is not None else False
        side_by_side.append(
            {
                "leader": code,
                "sheet": sheet,
                "db_entries": db_val,
                "consol_import": consol_val,
                "status": pass_fail(ok_db),
            }
        )
        if not ok_db:
            mismatches.append(
                {
                    "id": f"P2-LEADER-TOTAL-{code}",
                    "area": "Collections FY25-26",
                    "leader": code,
                    "period": "FY25-26 TOTAL",
                    "sheet": sheet,
                    "db": db_val,
                    "api_ui": consol_val,
                    "diff": None if db_val is None else float(db_val) - float(sheet),
                    "classification": "DB_DATA_ERROR" if db_val is not None else "MISSING_IN_DB",
                    "root_cause": "collection_entries.collected sum != sheet Revenue for leader",
                    "location": "db.collection_entries fiscal_year=2526; routers/collections.py list_collections",
                    "proposed_fix": "Reload monthly collected from expected_collections_FY25-26_leader_month.csv",
                }
            )
        if consol_val is not None and not ok_consol:
            mismatches.append(
                {
                    "id": f"P2-CONSOL-ACTUAL-{code}",
                    "area": "Collections FY25-26",
                    "leader": code,
                    "period": "FY25-26 consolidated hist actual",
                    "sheet": sheet,
                    "db": consol_val,
                    "api_ui": consol_val,
                    "diff": float(consol_val) - float(sheet),
                    "classification": "TIME_SNAPSHOT_MISMATCH",
                    "root_cause": (
                        f"consolidated_summaries fy2526_board_actual_collections_fy_25_26 "
                        f"({consol_val}) differs from sheet ({sheet}); collection_entries "
                        f"may still match. Imported xlsx likely older than expected CSV."
                    ),
                    "location": "db.consolidated_summaries; consolidated_import.py; GET /api/consolidated-summary (static hist row)",
                    "proposed_fix": "Re-import Business_Plan Summary Actual Collections FY25-26 from current sheet",
                }
            )

    # Firm total
    sheet_total = expected_lm.get("TOTAL", {}).get("TOTAL", 0.0)
    db_total = sum(db_by_leader.get(c, 0) for c in LEADER_CODES if CODE_TO_LEADER.get(c))
    consol_total = hist_total
    side_by_side.append(
        {
            "leader": "TOTAL",
            "sheet": sheet_total,
            "db_entries": db_total,
            "consol_import": consol_total,
            "status": pass_fail(nearly_equal(db_total, sheet_total, TOL_FY_TOTAL)),
        }
    )
    if not nearly_equal(db_total, sheet_total, TOL_FY_TOTAL):
        mismatches.append(
            {
                "id": "P2-FIRM-TOTAL",
                "area": "Collections FY25-26",
                "leader": "TOTAL",
                "period": "FY25-26",
                "sheet": sheet_total,
                "db": db_total,
                "api_ui": consol_total,
                "diff": db_total - sheet_total,
                "classification": "DB_DATA_ERROR",
                "root_cause": "Sum of collection_entries.collected across present leaders != sheet firm Revenue",
                "location": "db.collection_entries fiscal_year=2526",
                "proposed_fix": "Include missing leaders (SP/VP) and fix any month residuals",
            }
        )

    # Leader x month
    month_mismatches = 0
    month_rows = []
    for ym, sheet_row in expected_lm.items():
        if ym == "TOTAL":
            continue
        db_row = db_by_month.get(ym, {})
        for code in LEADER_CODES:
            sheet_v = sheet_row.get(code, 0.0)
            if CODE_TO_LEADER.get(code) is None:
                if abs(sheet_v) > TOL_LEADER_MONTH:
                    month_mismatches += 1
                    mismatches.append(
                        {
                            "id": f"P2-LM-{code}-{ym}",
                            "area": "Collections FY25-26",
                            "leader": code,
                            "period": ym,
                            "sheet": sheet_v,
                            "db": None,
                            "api_ui": None,
                            "diff": sheet_v,
                            "classification": "MISSING_IN_DB",
                            "root_cause": f"No leader/entries for {code} in month {ym}",
                            "location": "leaders / collection_entries",
                            "proposed_fix": f"Add {code} leader and month collected={sheet_v}",
                        }
                    )
                continue
            db_v = db_row.get(code, 0.0)
            ok = nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH)
            month_rows.append(
                {"month": ym, "leader": code, "sheet": sheet_v, "db": db_v, "status": pass_fail(ok)}
            )
            if not ok:
                month_mismatches += 1
                mismatches.append(
                    {
                        "id": f"P2-LM-{code}-{ym}",
                        "area": "Collections FY25-26",
                        "leader": code,
                        "period": ym,
                        "sheet": sheet_v,
                        "db": db_v,
                        "api_ui": None,
                        "diff": float(db_v) - float(sheet_v),
                        "classification": "DB_DATA_ERROR",
                        "root_cause": "collection_entries.collected for month label != sheet Revenue for that month×leader",
                        "location": f"db.collection_entries leader_id={CODE_TO_LEADER[code]} month~{ym}",
                        "proposed_fix": "Correct monthly collected value from expected_collections_FY25-26_leader_month.csv",
                    }
                )

    # Receipt-level
    mismatches.append(
        {
            "id": "P2-RECEIPT-LEVEL",
            "area": "Collections FY25-26",
            "leader": "ALL",
            "period": "FY25-26",
            "sheet": receipt_stats["receipt_rows"],
            "db": 0,
            "api_ui": None,
            "diff": None,
            "classification": "CANNOT_VERIFY_NO_SOURCE",
            "root_cause": (
                "collection_transactions has 0 docs for fiscal_year=2526; schema has no "
                "Date/Invoice/Gross/GST/TDS/Forex. FY25-26 actuals exist only as monthly "
                f"aggregates on collection_entries ({len(db_by_leader)} leaders). "
                f"Sheet has {receipt_stats['receipt_rows']} receipt rows + "
                f"{receipt_stats['outstanding_rows']} O/S summary rows."
            ),
            "location": "schemas/collection_transaction.py; db.collection_transactions",
            "proposed_fix": "If row-level audit is required, import receipts with Date, Invoice No., party, amounts, partner",
        }
    )

    # TDS diagnostic: would DB be sheet - TDS?
    tds_total = sum(v["tds"] for v in receipt_stats["by_leader"].values())
    if nearly_equal(db_total, sheet_total - tds_total, TOL_FY_TOTAL):
        mismatches.append(
            {
                "id": "P2-TDS-SIGNATURE",
                "area": "Collections FY25-26",
                "leader": "TOTAL",
                "period": "FY25-26",
                "sheet": sheet_total,
                "db": db_total,
                "api_ui": None,
                "diff": db_total - sheet_total,
                "classification": "TRANSMISSION_OR_CALC_ERROR",
                "root_cause": "DB total equals sheet Revenue minus TDS — code/import deducted TDS",
                "location": "N/A (diagnostic)",
                "proposed_fix": "Store Revenue = Gross - GST - Forex (do not deduct TDS)",
            }
        )

    return {
        "mismatches": mismatches,
        "side_by_side_leader": side_by_side,
        "month_fail_count": month_mismatches,
        "month_rows_sample_fails": [r for r in month_rows if r["status"] == "FAIL"][:50],
        "month_pass_count": sum(1 for r in month_rows if r["status"] == "PASS"),
        "month_compare_count": len(month_rows),
        "db_total": db_total,
        "sheet_total": sheet_total,
        "consol_total": consol_total,
        "tds_total": tds_total,
    }


async def main() -> None:
    expected_lm = load_expected_leader_month()
    receipt_stats = load_expected_receipt_stats()
    db_data = await pull_db()
    db_grid = entries_to_grid(db_data["entries"])
    result = compare(
        expected_lm,
        db_grid,
        db_data["hist_actual"],
        db_data["hist_actual_total"],
        receipt_stats,
    )
    out = {
        "tx_2526_count": db_data["tx_2526_count"],
        "leaders_in_db": db_data["leaders"],
        "entry_count": len(db_data["entries"]),
        "receipt_stats": {
            "receipt_rows": receipt_stats["receipt_rows"],
            "outstanding_rows": receipt_stats["outstanding_rows"],
            "by_leader": {
                k: {kk: (round(vv, 2) if isinstance(vv, float) else vv) for kk, vv in v.items()}
                for k, v in receipt_stats["by_leader"].items()
            },
        },
        **result,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {OUT_JSON}")
    print(f"Leader TOTAL PASS: {sum(1 for r in result['side_by_side_leader'] if r['status']=='PASS')}")
    print(f"Month cells PASS/FAIL: {result['month_pass_count']}/{result['month_fail_count']} of {result['month_compare_count']}")
    print(f"Mismatches logged: {len(result['mismatches'])}")
    print(f"Sheet total={result['sheet_total']} DB entries={result['db_total']} Consol={result['consol_total']}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
