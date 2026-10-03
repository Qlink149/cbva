"""Phase 3: FY 2026-27 business plan reconciliation (read-only).

Compares expected_business_plan_summary.csv to:
  - pipeline_snapshots (initial / board / monthly)
  - consolidated_summaries imported values
  - collection_transactions + collection_entries for FY2627
  - live Bluesky bifur math (engagements.blue_sky)

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
    APP_CODE_TO_LEADER,
    CODE_TO_LEADER,
    LEADER_TO_CODE,
    ROOT as REPO_ROOT,
    TOL_FY_TOTAL,
    TOL_LEADER_MONTH,
    get_db,
    month_key_from_entry_label,
    nearly_equal,
    pass_fail,
)

EXPECTED = REPO_ROOT / "expected_business_plan_summary.csv"
OUT_JSON = Path(__file__).resolve().parent / "phase3_results.json"

LEADER_CODES = ["AH", "AK", "AM", "MM", "BIU", "NP", "PV", "RT", "SP", "VC", "VP", "VS"]

# Map sheet section + line -> snapshot lookup
SNAPSHOT_MAP = {
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Green"): ("initial", "green", None),
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Amber"): ("initial", "amber", None),
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Bluesky"): ("initial", "blue_sky", None),
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Total"): ("initial", "total", None),
    ("Business plan decided by Board (March 26 - FY 26-27)", "Green"): ("board", "green", None),
    ("Business plan decided by Board (March 26 - FY 26-27)", "Amber"): ("board", "amber", None),
    ("Business plan decided by Board (March 26 - FY 26-27)", "Bluesky"): ("board", "blue_sky", None),
    ("Business plan decided by Board (March 26 - FY 26-27)", "Total"): ("board", "total", None),
    ("Business Plan Update (Early April 26)", "Green"): ("monthly", "green", "April 2026"),
    ("Business Plan Update (Early April 26)", "Amber"): ("monthly", "amber", "April 2026"),
    ("Business Plan Update (Early April 26)", "Bluesky"): ("monthly", "blue_sky", "April 2026"),
    ("Business Plan Update (Early April 26)", "Total"): ("monthly", "total", "April 2026"),
    ("Business Plan Update (6 May 26)", "Green"): ("monthly", "green", "May 2026"),
    ("Business Plan Update (6 May 26)", "Amber"): ("monthly", "amber", "May 2026"),
    ("Business Plan Update (6 May 26)", "Bluesky"): ("monthly", "blue_sky", "May 2026"),
    ("Business Plan Update (6 May 26)", "Total"): ("monthly", "total", "May 2026"),
    ("Business Plan Update (June 26)", "Green"): ("monthly", "green", "June 2026"),
    ("Business Plan Update (June 26)", "Amber"): ("monthly", "amber", "June 2026"),
    ("Business Plan Update (June 26)", "Bluesky"): ("monthly", "blue_sky", "June 2026"),
    ("Business Plan Update (June 26)", "Total"): ("monthly", "total", "June 2026"),
    ("Business Plan Update (July 26)", "Green"): ("monthly", "green", "July 2026"),
    ("Business Plan Update (July 26)", "Amber"): ("monthly", "amber", "July 2026"),
    ("Business Plan Update (July 26)", "Bluesky"): ("monthly", "blue_sky", "July 2026"),
    ("Business Plan Update (July 26)", "Total"): ("monthly", "total", "July 2026"),
    ("Business Plan Update (Aug 26)", "Green"): ("monthly", "green", "August 2026"),
    ("Business Plan Update (Aug 26)", "Amber"): ("monthly", "amber", "August 2026"),
    ("Business Plan Update (Aug 26)", "Bluesky"): ("monthly", "blue_sky", "August 2026"),
    ("Business Plan Update (Aug 26)", "Total"): ("monthly", "total", "August 2026"),
}

CONSOL_ROW_KEYS = {
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Green"): "fy2627_initial_green",
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Amber"): "fy2627_initial_amber",
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Bluesky"): "fy2627_initial_bluesky",
    ("Details as per Initial Plan (January 2026 - FY 26-27)", "Total"): "fy2627_initial_total",
    ("Business plan decided by Board (March 26 - FY 26-27)", "Green"): "fy2627_board_green",
    ("Business plan decided by Board (March 26 - FY 26-27)", "Amber"): "fy2627_board_amber",
    ("Business plan decided by Board (March 26 - FY 26-27)", "Bluesky"): "fy2627_board_bluesky",
    ("Business plan decided by Board (March 26 - FY 26-27)", "Total"): "fy2627_board_total",
    ("Business Plan Update (Early April 26)", "Green"): "fy2627_monthly_04_green",
    ("Business Plan Update (Early April 26)", "Amber"): "fy2627_monthly_04_amber",
    ("Business Plan Update (Early April 26)", "Bluesky"): "fy2627_monthly_04_bluesky",
    ("Business Plan Update (Early April 26)", "Total"): "fy2627_monthly_04_total",
    ("Business Plan Update (6 May 26)", "Green"): "fy2627_monthly_05_green",
    ("Business Plan Update (6 May 26)", "Amber"): "fy2627_monthly_05_amber",
    ("Business Plan Update (6 May 26)", "Bluesky"): "fy2627_monthly_05_bluesky",
    ("Business Plan Update (6 May 26)", "Total"): "fy2627_monthly_05_total",
    ("Business Plan Update (June 26)", "Green"): "fy2627_monthly_06_green",
    ("Business Plan Update (June 26)", "Amber"): "fy2627_monthly_06_amber",
    ("Business Plan Update (June 26)", "Bluesky"): "fy2627_monthly_06_bluesky",
    ("Business Plan Update (June 26)", "Total"): "fy2627_monthly_06_total",
    ("Business Plan Update (July 26)", "Green"): "fy2627_monthly_07_green",
    ("Business Plan Update (July 26)", "Amber"): "fy2627_monthly_07_amber",
    ("Business Plan Update (July 26)", "Bluesky"): "fy2627_monthly_07_bluesky",
    ("Business Plan Update (July 26)", "Total"): "fy2627_monthly_07_total",
    ("Business Plan Update (Aug 26)", "Green"): "fy2627_monthly_08_green",
    ("Business Plan Update (Aug 26)", "Amber"): "fy2627_monthly_08_amber",
    ("Business Plan Update (Aug 26)", "Bluesky"): "fy2627_monthly_08_bluesky",
    ("Business Plan Update (Aug 26)", "Total"): "fy2627_monthly_08_total",
    ("Actual Collections (FY 25-26)", "Actual Collections (FY 25-26)"): "fy2526_board_actual_collections_fy_25_26",
    ("Bifurcation of Bluesky (April)", "Unidentified Bluesky"): "fy2627_bifur_04_unidentified",
    ("Bifurcation of Bluesky (April)", "Known Bluesky"): "fy2627_bifur_04_known",
    ("Bifurcation of Bluesky (April)", "Total Bluesky"): "fy2627_bifur_04_total_bs",
    ("Bifurcation of Bluesky (May)", "Unidentified Bluesky"): "fy2627_bifur_05_unidentified",
    ("Bifurcation of Bluesky (May)", "Known Bluesky"): "fy2627_bifur_05_known",
    ("Bifurcation of Bluesky (June)", "Unidentified Bluesky"): "fy2627_bifur_06_unidentified",
    ("Bifurcation of Bluesky (June)", "Known Bluesky"): "fy2627_bifur_06_known",
    ("Bifurcation of Bluesky (July)", "Unidentified Bluesky"): "fy2627_bifur_07_unidentified",
    ("Bifurcation of Bluesky (July)", "Known Bluesky"): "fy2627_bifur_07_known",
    ("Bifurcation of Bluesky (Aug)", "Unidentified Bluesky"): "fy2627_bifur_08_unidentified",
    ("Bifurcation of Bluesky (Aug)", "Known Bluesky"): "fy2627_bifur_08_known",
}

MONTH_ACTUAL_SECTIONS = {
    "Actual Collection for April 2026": "04",
    "Actual Collections - April 2026": "04",
    "Actual Collection for May 2026": "05",
    "Actual Collections - May 2026": "05",
    "Actual Collection for June 2026": "06",
    "Actual Collections - June 2026": "06",
    "Actual Collection for July 2026": "07",
    "Actual Collections - July 2026": "07",
    "Actual Collection for Aug 2026": "08",
}

MONTH_PLANNED_SECTIONS = {
    "Planned Collection for April 2026": "04",
    "Planned Collection for May 2026": "05",
    "Planned Collection for May 2026 (revised on 25th May)": "05_revised",
    "Planned Collection for June 2026": "06",
    "Planned Collection for July 2026": "07",
    "Planned Collection for Aug 2026": "08",
}


def load_expected() -> list[dict]:
    rows = []
    with EXPECTED.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            val = r.get("value")
            try:
                num = float(val) if val not in (None, "") else None
            except ValueError:
                num = None
            rows.append(
                {
                    "sheet_row": int(r["sheet_row"]) if r.get("sheet_row") else None,
                    "cell": r.get("cell"),
                    "section": r.get("section"),
                    "line": r.get("line"),
                    "leader_code": r.get("leader_code"),
                    "leader_name": r.get("leader_name"),
                    "value": num,
                    "is_formula": r.get("is_formula") == "True",
                    "formula": r.get("formula"),
                }
            )
    return rows


def expected_pivot(rows: list[dict], section: str, line: str) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for r in rows:
        if r["section"] == section and r["line"] == line and r["leader_code"] in LEADER_CODES + ["TOTAL"]:
            out[r["leader_code"]] = r["value"]
    return out


async def pull_db() -> dict:
    client, db = get_db()
    try:
        snaps = []
        async for s in db.pipeline_snapshots.find({"fiscal_year": "2627"}):
            snaps.append(s)

        consol = await db.consolidated_summaries.find_one({"report_fy": "2627"})
        consol_by_key = {}
        for r in (consol or {}).get("rows") or []:
            if r.get("row_key"):
                consol_by_key[r["row_key"]] = {
                    "values": r.get("values") or {},
                    "imported_total": r.get("imported_total"),
                    "label": r.get("label"),
                }

        # engagements blue_sky by leader
        known_bs: dict[str, float] = defaultdict(float)
        eng_gabs: dict[str, dict] = defaultdict(lambda: {"green": 0.0, "amber": 0.0, "blue_sky": 0.0, "total": 0.0, "n": 0})
        async for e in db.engagements.find({"fiscal_year": "2627", "is_archived": False}):
            lid = e.get("leader_id")
            known_bs[lid] += float(e.get("blue_sky") or 0)
            eng_gabs[lid]["green"] += float(e.get("green") or 0)
            eng_gabs[lid]["amber"] += float(e.get("amber") or 0)
            eng_gabs[lid]["blue_sky"] += float(e.get("blue_sky") or 0)
            eng_gabs[lid]["total"] += float(e.get("total") or 0)
            eng_gabs[lid]["n"] += 1

        # collection txs + entries FY2627
        tx_by: dict[tuple[str, str], float] = defaultdict(float)
        tx_count = 0
        async for t in db.collection_transactions.find({"fiscal_year": "2627"}):
            tx_count += 1
            tx_by[(t.get("leader_id"), t.get("month"))] += float(t.get("amount_collected") or 0)

        entry_planned: dict[tuple[str, str], float] = {}
        entry_collected: dict[tuple[str, str], float] = {}
        async for e in db.collection_entries.find({"fiscal_year": "2627"}):
            mk = month_key_from_entry_label(str(e.get("month") or ""))
            if not mk:
                continue
            lid = e.get("leader_id")
            entry_planned[(lid, mk)] = float(e.get("planned") or 0)
            entry_collected[(lid, mk)] = float(e.get("collected") or 0)

        leaders = []
        async for L in db.leaders.find({}):
            leaders.append({"_id": L["_id"], "name": L.get("name")})

        return {
            "snaps": snaps,
            "consol_by_key": consol_by_key,
            "known_bs": dict(known_bs),
            "eng_gabs": {k: dict(v) for k, v in eng_gabs.items()},
            "tx_by": {f"{a}|{b}": v for (a, b), v in tx_by.items()},
            "tx_by_tuple": dict(tx_by),
            "tx_count": tx_count,
            "entry_planned": {f"{a}|{b}": v for (a, b), v in entry_planned.items()},
            "entry_collected": {f"{a}|{b}": v for (a, b), v in entry_collected.items()},
            "entry_planned_tuple": dict(entry_planned),
            "entry_collected_tuple": dict(entry_collected),
            "leaders": leaders,
            "source_file": (consol or {}).get("source_file"),
        }
    finally:
        client.close()


def index_snaps(snaps: list[dict]) -> dict:
    """(leader_id, snapshot_type, label|None) -> doc"""
    idx = {}
    for s in snaps:
        lid = s.get("leader_id")
        st = s.get("snapshot_type")
        label = s.get("label")
        if st in ("initial", "board"):
            idx[(lid, st, None)] = s
        elif st == "monthly":
            idx[(lid, st, label)] = s
    return idx


def compare_snapshots(expected_rows: list[dict], snap_idx: dict, consol_by_key: dict) -> dict:
    mismatches = []
    side_by_side = []

    for (section, line), (stype, field, label) in SNAPSHOT_MAP.items():
        sheet = expected_pivot(expected_rows, section, line)
        firm_sheet = sheet.get("TOTAL")
        firm_db = 0.0
        firm_db_n = 0
        consol_key = CONSOL_ROW_KEYS.get((section, line))
        consol_vals = (consol_by_key.get(consol_key) or {}).get("values") or {}

        for code in LEADER_CODES:
            sheet_v = sheet.get(code)
            if sheet_v is None:
                continue
            lid = CODE_TO_LEADER.get(code)
            db_v = None
            classification_hint = None
            if lid is None:
                classification_hint = "MISSING_IN_DB"
            else:
                key = (lid, stype, label if stype == "monthly" else None)
                doc = snap_idx.get(key)
                if doc:
                    db_v = float(doc.get(field) or 0)
                    firm_db += db_v
                    firm_db_n += 1
                else:
                    classification_hint = "MISSING_IN_DB"

            # App mapping blank for AK/SP/VP on consolidated live path
            app_lid = APP_CODE_TO_LEADER.get(code)
            consol_v = consol_vals.get(code)

            ok = nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH) if db_v is not None else False
            # Board AK special case: snap may be zeros
            status = pass_fail(ok)
            side_by_side.append(
                {
                    "section": section,
                    "line": line,
                    "leader": code,
                    "sheet": sheet_v,
                    "db_snapshot": db_v,
                    "consol_import": consol_v,
                    "status": status,
                }
            )
            if not ok:
                if lid is None:
                    cls = "LEADER_MAPPING_ERROR"
                    cause = f"No leaders/_id for {code}; sheet has {sheet_v}"
                    loc = "db.leaders; CODE_TO_LEADER"
                elif db_v is None:
                    cls = "MISSING_IN_DB"
                    cause = f"No pipeline_snapshots ({stype},{label}) for {lid}"
                    loc = "db.pipeline_snapshots"
                elif code == "AK" and stype in ("initial", "board") and db_v == 0 and sheet_v:
                    cls = "LEADER_MAPPING_ERROR"
                    cause = (
                        "AK leader exists (ak) and monthly snaps have values, but board/initial "
                        f"snapshot is zero while sheet is {sheet_v}. App CODE_TO_LEADER['AK']=None "
                        "so consolidated materialize skips AK for initial/board."
                    )
                    loc = "consolidated_service.CODE_TO_LEADER L25-38; engagement_derivation.LEADER_TO_CODE; pipeline_snapshots ak board"
                else:
                    cls = "DB_DATA_ERROR"
                    cause = f"pipeline_snapshots.{field}={db_v} != sheet {sheet_v}"
                    loc = f"db.pipeline_snapshots leader_id={lid} type={stype} label={label}"
                mismatches.append(
                    {
                        "id": f"P3-SNAP-{stype}-{label or 'x'}-{field}-{code}",
                        "area": "Plan snapshot",
                        "leader": code,
                        "period": f"{section} / {line}",
                        "sheet": sheet_v,
                        "db": db_v,
                        "api_ui": consol_v,
                        "diff": None if db_v is None else float(db_v) - float(sheet_v),
                        "classification": classification_hint or cls,
                        "root_cause": cause,
                        "location": loc,
                        "proposed_fix": "Align pipeline_snapshots and CODE_TO_LEADER with sheet; re-materialize from current Summary",
                    }
                )

            # consol vs sheet separately when differ
            if consol_v is not None and sheet_v is not None and not nearly_equal(consol_v, sheet_v, TOL_LEADER_MONTH):
                mismatches.append(
                    {
                        "id": f"P3-CONSOL-{consol_key}-{code}",
                        "area": "Plan snapshot",
                        "leader": code,
                        "period": f"imported {consol_key}",
                        "sheet": sheet_v,
                        "db": consol_v,
                        "api_ui": consol_v,
                        "diff": float(consol_v) - float(sheet_v),
                        "classification": "TIME_SNAPSHOT_MISMATCH",
                        "root_cause": "consolidated_summaries import differs from expected_business_plan_summary.csv (xlsx version drift)",
                        "location": "db.consolidated_summaries; consolidated_import.py",
                        "proposed_fix": "Re-import from Business_Plan_Consolidated current file",
                    }
                )

        # firm total check from sheet TOTAL vs sum of mapped leaders' snaps
        if firm_sheet is not None and firm_db_n:
            ok_firm = nearly_equal(firm_db, firm_sheet, TOL_FY_TOTAL)
            side_by_side.append(
                {
                    "section": section,
                    "line": line,
                    "leader": "TOTAL(db_sum)",
                    "sheet": firm_sheet,
                    "db_snapshot": firm_db,
                    "consol_import": (consol_by_key.get(consol_key) or {}).get("imported_total"),
                    "status": pass_fail(ok_firm),
                }
            )

    return {"mismatches": mismatches, "side_by_side": side_by_side}


def compare_collections(expected_rows: list[dict], db: dict) -> dict:
    mismatches = []
    side = []
    tx_by = db["tx_by_tuple"]
    entry_planned = db["entry_planned_tuple"]
    entry_collected = db["entry_collected_tuple"]

    # Actuals by month from sheet (prefer "Actual Collection for X" over summary duplicates)
    for section, mk in MONTH_ACTUAL_SECTIONS.items():
        if "Collections -" in section:
            continue  # use primary "Actual Collection for" rows
        sheet = expected_pivot(expected_rows, section, section)
        if not sheet:
            # try line == section name variants
            sheet = expected_pivot(expected_rows, section, section.split(" for ")[-1] if False else section)
        # load any leader values under that section
        sheet = {}
        for r in expected_rows:
            if r["section"] == section and r["leader_code"] in LEADER_CODES + ["TOTAL"]:
                sheet[r["leader_code"]] = r["value"]
        if not sheet:
            continue

        for code in LEADER_CODES:
            sheet_v = sheet.get(code)
            if sheet_v is None:
                continue
            lid = CODE_TO_LEADER.get(code)
            db_v = None
            if lid:
                tx_sum = tx_by.get((lid, mk), 0.0)
                entry_c = entry_collected.get((lid, mk), 0.0)
                # Mirror collections.py: prefer tx sum if > 0
                db_v = tx_sum if tx_sum > 0 else entry_c
            ok = nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH) if db_v is not None else (abs(sheet_v or 0) <= TOL_LEADER_MONTH and lid is None)
            # blank sheet cells for SP/VP in some months
            if lid is None:
                if sheet_v and abs(sheet_v) > TOL_LEADER_MONTH:
                    mismatches.append(
                        {
                            "id": f"P3-ACT-{mk}-{code}",
                            "area": "Monthly plan-actual",
                            "leader": code,
                            "period": f"FY26-27 {mk} actual",
                            "sheet": sheet_v,
                            "db": None,
                            "api_ui": None,
                            "diff": sheet_v,
                            "classification": "LEADER_MAPPING_ERROR",
                            "root_cause": f"Sheet has actual {sheet_v} for {code} but leader missing in DB",
                            "location": "db.leaders",
                            "proposed_fix": f"Add leader {code} and collection txs/entries",
                        }
                    )
                    side.append({"month": mk, "kind": "actual", "leader": code, "sheet": sheet_v, "db": None, "status": "FAIL"})
                continue

            side.append({"month": mk, "kind": "actual", "leader": code, "sheet": sheet_v, "db": db_v, "status": pass_fail(nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH))})
            if not nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH):
                mismatches.append(
                    {
                        "id": f"P3-ACT-{mk}-{code}",
                        "area": "Monthly plan-actual",
                        "leader": code,
                        "period": f"FY26-27 month {mk} actual",
                        "sheet": sheet_v,
                        "db": db_v,
                        "api_ui": db_v,
                        "diff": float(db_v) - float(sheet_v),
                        "classification": "DB_DATA_ERROR",
                        "root_cause": (
                            f"collection_transactions/entries actual={db_v} vs sheet={sheet_v}. "
                            "API: routers/collections.py list_collections L81-92; "
                            "consolidated_service._leader_collections L109-127"
                        ),
                        "location": "db.collection_transactions / collection_entries fiscal_year=2627",
                        "proposed_fix": "Align monthly actuals with sheet (or accept Aug blank-in-sheet extras as informational)",
                    }
                )

    # Planned
    for section, mk_raw in MONTH_PLANNED_SECTIONS.items():
        sheet = {}
        for r in expected_rows:
            if r["section"] == section and r["leader_code"] in LEADER_CODES + ["TOTAL"]:
                sheet[r["leader_code"]] = r["value"]
        if not sheet:
            continue
        mk = mk_raw.replace("_revised", "")
        is_revised = mk_raw.endswith("_revised")
        for code in LEADER_CODES:
            sheet_v = sheet.get(code)
            if sheet_v is None:
                continue
            lid = CODE_TO_LEADER.get(code)
            db_v = entry_planned.get((lid, mk)) if lid else None
            side.append(
                {
                    "month": mk_raw,
                    "kind": "planned",
                    "leader": code,
                    "sheet": sheet_v,
                    "db": db_v,
                    "status": pass_fail(nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH)) if db_v is not None else "FAIL",
                }
            )
            if lid and (db_v is None or not nearly_equal(db_v, sheet_v, TOL_LEADER_MONTH)):
                mismatches.append(
                    {
                        "id": f"P3-PLAN-{mk_raw}-{code}",
                        "area": "Monthly plan-actual",
                        "leader": code,
                        "period": f"FY26-27 planned {mk_raw}",
                        "sheet": sheet_v,
                        "db": db_v,
                        "api_ui": db_v,
                        "diff": None if db_v is None else float(db_v) - float(sheet_v),
                        "classification": "MISSING_IN_DB" if db_v is None else "DB_DATA_ERROR",
                        "root_cause": (
                            "collection_entries.planned mismatch or missing. "
                            + ("Sheet has both original May plan and 25 May revision; DB stores one planned per month." if is_revised or mk == "05" else "")
                        ),
                        "location": "db.collection_entries; engagement_derivation materialize planned from monthly_plan",
                        "proposed_fix": "Store original + revised May plans; match dashboard to sheet's chosen row",
                    }
                )

    # Aug actuals informational: if DB has and sheet blank
    aug_sheet = {}
    for r in expected_rows:
        if r["section"] == "Actual Collection for Aug 2026" and r["leader_code"] in LEADER_CODES:
            aug_sheet[r["leader_code"]] = r["value"]
    aug_db_total = 0.0
    for code, lid in CODE_TO_LEADER.items():
        if not lid:
            continue
        v = tx_by.get((lid, "08"), 0.0) or entry_collected.get((lid, "08"), 0.0)
        aug_db_total += v
        sheet_v = aug_sheet.get(code)
        if (sheet_v is None or sheet_v == 0) and v > 0:
            mismatches.append(
                {
                    "id": f"P3-AUG-EXTRA-{code}",
                    "area": "Monthly plan-actual",
                    "leader": code,
                    "period": "Aug 2026 actual",
                    "sheet": sheet_v,
                    "db": v,
                    "api_ui": v,
                    "diff": v,
                    "classification": "EXTRA_IN_DB",
                    "root_cause": "DB has August 2026 actuals; sheet Aug actual cells are blank — informational, not treated as error vs truth when sheet blank",
                    "location": "db.collection_transactions month=08 fy=2627",
                    "proposed_fix": "Confirm with CBVA whether to update sheet or hide Aug actuals in UI until sheet filled",
                }
            )

    return {"mismatches": mismatches, "side": side, "aug_db_total": aug_db_total}


def compare_bifur_and_derived(expected_rows: list[dict], db: dict, snap_idx: dict) -> dict:
    mismatches = []
    notes = []

    # Live bifur formula from code
    notes.append(
        {
            "metric": "Bluesky Known/Unidentified",
            "code_formula": (
                "known = min(sum(engagements.blue_sky), monthly_snapshot.blue_sky); "
                "unidentified = monthly_snapshot.blue_sky - known "
                "(consolidated_service._leader_bundle L151-163)"
            ),
            "sheet_formula": "Unidentified is input; Known = Total Bluesky - Unidentified",
        }
    )

    for month_label, mk, section in [
        ("April 2026", "04", "Bifurcation of Bluesky (April)"),
        ("May 2026", "05", "Bifurcation of Bluesky (May)"),
        ("June 2026", "06", "Bifurcation of Bluesky (June)"),
        ("July 2026", "07", "Bifurcation of Bluesky (July)"),
        ("August 2026", "08", "Bifurcation of Bluesky (Aug)"),
    ]:
        sheet_uid = expected_pivot(expected_rows, section, "Unidentified Bluesky")
        sheet_known = expected_pivot(expected_rows, section, "Known Bluesky")
        sheet_total = expected_pivot(expected_rows, section, "Total Bluesky")
        for code in LEADER_CODES:
            lid = CODE_TO_LEADER.get(code)
            if not lid:
                continue
            snap = snap_idx.get((lid, "monthly", month_label))
            if not snap:
                continue
            total_bs = float(snap.get("blue_sky") or 0)
            known_eng = float(db["known_bs"].get(lid) or 0)
            known = min(known_eng, total_bs)
            unid = total_bs - known
            s_uid = sheet_uid.get(code)
            s_known = sheet_known.get(code)
            if s_uid is not None and not nearly_equal(unid, s_uid, TOL_LEADER_MONTH):
                mismatches.append(
                    {
                        "id": f"P3-BIFUR-UID-{mk}-{code}",
                        "area": "Plan snapshot",
                        "leader": code,
                        "period": f"{section} Unidentified",
                        "sheet": s_uid,
                        "db": unid,
                        "api_ui": unid,
                        "diff": unid - float(s_uid),
                        "classification": "TRANSMISSION_OR_CALC_ERROR",
                        "root_cause": (
                            f"Live bifur uses CURRENT engagements.blue_sky sum ({known_eng}) "
                            f"against monthly snap BS ({total_bs}), not the sheet's frozen Unidentified. "
                            "Historical bifur cannot be reproduced from current engagements."
                        ),
                        "location": "consolidated_service._leader_bundle L141-163; _dynamic_value bifur L224-231",
                        "proposed_fix": "Store bifur Known/Unidentified per snapshot date; stop recomputing hist months from live engagements",
                    }
                )
            if s_known is not None and not nearly_equal(known, s_known, TOL_LEADER_MONTH):
                mismatches.append(
                    {
                        "id": f"P3-BIFUR-KNOWN-{mk}-{code}",
                        "area": "Plan snapshot",
                        "leader": code,
                        "period": f"{section} Known",
                        "sheet": s_known,
                        "db": known,
                        "api_ui": known,
                        "diff": known - float(s_known),
                        "classification": "TRANSMISSION_OR_CALC_ERROR",
                        "root_cause": "Same as Unidentified — live engagement blue_sky vs frozen sheet Known",
                        "location": "consolidated_service._leader_bundle",
                        "proposed_fix": "Persist Known/Unidentified on pipeline_snapshots or bifur collection",
                    }
                )

    # Bluesky Achieved April = (G+A May) - (G+A April)
    notes.append(
        {
            "metric": "Bluesky Achieved in April 2026",
            "sheet_formula": "(Green+Amber at 6 May) - (Green+Amber at Early April) per leader",
            "code_formula": "NOT computed live — static hist row in consolidated_summaries (not in DYNAMIC_PARTS)",
        }
    )
    sheet_ach = expected_pivot(expected_rows, "Bluesky Achieved in April 2026", "Bluesky Achieved in April 2026")
    for code in LEADER_CODES:
        lid = CODE_TO_LEADER.get(code)
        if not lid:
            continue
        apr = snap_idx.get((lid, "monthly", "April 2026"))
        may = snap_idx.get((lid, "monthly", "May 2026"))
        if not apr or not may:
            continue
        computed = (float(may.get("green") or 0) + float(may.get("amber") or 0)) - (
            float(apr.get("green") or 0) + float(apr.get("amber") or 0)
        )
        sheet_v = sheet_ach.get(code)
        if sheet_v is not None and not nearly_equal(computed, sheet_v, TOL_LEADER_MONTH):
            mismatches.append(
                {
                    "id": f"P3-BS-ACH-{code}",
                    "area": "Derived metric",
                    "leader": code,
                    "period": "Bluesky Achieved April 2026",
                    "sheet": sheet_v,
                    "db": computed,
                    "api_ui": None,
                    "diff": computed - float(sheet_v),
                    "classification": "TRANSMISSION_OR_CALC_ERROR",
                    "root_cause": "Recomputed from current monthly snaps G+A May−Apr does not match sheet; snaps may have been overwritten after snapshot dates",
                    "location": "pipeline_snapshots April/May 2026; consolidated hist row static",
                    "proposed_fix": "Freeze monthly snaps as-of date; keep Bluesky Achieved as stored value",
                }
            )
        elif sheet_v is not None and nearly_equal(computed, sheet_v, TOL_LEADER_MONTH):
            notes.append({"metric": f"Bluesky Achieved Apr {code}", "status": "PASS", "value": computed})

    # Variance FY25-26
    notes.append(
        {
            "metric": "Variance FY25-26",
            "sheet_formula": "Actual row 22 - Board plan row 20",
            "code_formula": "Static imported fy2526_board_variance_in_collections_vs_board_plan_fy_25_26 — not recomputed",
        }
    )

    notes.append(
        {
            "metric": "Collections % (row 96 quirk)",
            "sheet_formula": "Collections upto June ÷ July plan total (quirk 6.2.5)",
            "code_formula": "Not in DYNAMIC_PARTS; if present stays as imported static slug row",
            "classification_note": "Confirm with CBVA which denominator they intend",
        }
    )

    notes.append(
        {
            "metric": "Time / historical snapshot",
            "finding": (
                "pipeline_snapshots are mutable (updated_at into Sep 2026). "
                "audit_log cannot reconstruct full Leader×Category as-of each snapshot date. "
                "Tag: CANNOT_VERIFY_NO_SOURCE for true point-in-time history beyond current snap docs."
            ),
        }
    )

    mismatches.append(
        {
            "id": "P3-TIME-HISTORY",
            "area": "Time",
            "leader": "ALL",
            "period": "All FY26-27 snapshots",
            "sheet": "frozen Summary cells",
            "db": "mutable pipeline_snapshots",
            "api_ui": "live overrides for dynamic rows",
            "diff": None,
            "classification": "CANNOT_VERIFY_NO_SOURCE",
            "root_cause": (
                "No immutable as_of snapshot store; monthly/current snaps overwritten. "
                "Cannot prove Leader×Category totals exactly as-of each sheet snapshot date from audit_log alone."
            ),
            "location": "pipeline_snapshots; engagements.py _auto_upsert_pipeline_snapshot; engagement_derivation.materialize_leader_derived_data",
            "proposed_fix": "Write append-only snapshot versions with as_of_date when board/monthly updates are published",
        }
    )

    # Leader mapping summary issues
    for code in ("SP", "VP"):
        mismatches.append(
            {
                "id": f"P3-LEADER-{code}",
                "area": "Leader mapping",
                "leader": code,
                "period": "all",
                "sheet": "present in Summary columns",
                "db": None,
                "api_ui": None,
                "diff": None,
                "classification": "LEADER_MAPPING_ERROR",
                "root_cause": f"No leaders document for {code}; APP_CODE_TO_LEADER['{code}']=None",
                "location": "db.leaders; consolidated_service.CODE_TO_LEADER",
                "proposed_fix": f"Create leader ({'sp' if code=='SP' else 'vinay_pathak'}/vp) and map code",
            }
        )
    mismatches.append(
        {
            "id": "P3-LEADER-AK-MAP",
            "area": "Leader mapping",
            "leader": "AK",
            "period": "consolidated live path",
            "sheet": "Amitabh Khemka column C",
            "db": "leaders._id=ak exists",
            "api_ui": "CODE_TO_LEADER AK=None blanks live overrides",
            "diff": None,
            "classification": "LEADER_MAPPING_ERROR",
            "root_cause": "AK present in DB but consolidated_service.CODE_TO_LEADER maps AK→None; board snap for ak is 0/0/0/0",
            "location": "backend/app/services/consolidated_service.py L25-38; engagement_derivation.LEADER_TO_CODE omits ak",
            "proposed_fix": "Set CODE_TO_LEADER['AK']='ak' and LEADER_TO_CODE['ak']='AK'; re-materialize board/initial",
        }
    )
    mismatches.append(
        {
            "id": "P3-LEADER-BIU-NAME",
            "area": "Leader mapping",
            "leader": "BIU",
            "period": "naming",
            "sheet": "Amit Shah (label in F3)",
            "db": "leaders name='BIU'; user Amit Dinesh Shah → biu",
            "api_ui": "BIU",
            "diff": None,
            "classification": "LEADER_MAPPING_ERROR",
            "root_cause": "Code BIU correctly maps to biu; display name is 'BIU' not 'Amit Shah'. Functional id OK; label mismatch only.",
            "location": "db.leaders biu; users amit.sh@cbva.in",
            "proposed_fix": "Optionally set leaders.name to 'Amit Shah (BIU)' for UI parity",
        }
    )

    return {"mismatches": mismatches, "notes": notes}


async def main() -> None:
    expected_rows = load_expected()
    db = await pull_db()
    snap_idx = index_snaps(db["snaps"])

    snap_cmp = compare_snapshots(expected_rows, snap_idx, db["consol_by_key"])
    coll_cmp = compare_collections(expected_rows, db)
    derived = compare_bifur_and_derived(expected_rows, db, snap_idx)

    # Firm snapshot quick table (5.1)
    firm_table = []
    for section, line, label in [
        ("Details as per Initial Plan (January 2026 - FY 26-27)", "Green", "Initial Green"),
        ("Details as per Initial Plan (January 2026 - FY 26-27)", "Amber", "Initial Amber"),
        ("Details as per Initial Plan (January 2026 - FY 26-27)", "Bluesky", "Initial Bluesky"),
        ("Details as per Initial Plan (January 2026 - FY 26-27)", "Total", "Initial Total"),
        ("Business plan decided by Board (March 26 - FY 26-27)", "Green", "Board Green"),
        ("Business plan decided by Board (March 26 - FY 26-27)", "Amber", "Board Amber"),
        ("Business plan decided by Board (March 26 - FY 26-27)", "Bluesky", "Board Bluesky"),
        ("Business plan decided by Board (March 26 - FY 26-27)", "Total", "Board Total"),
        ("Business Plan Update (Early April 26)", "Total", "Apr Total"),
        ("Business Plan Update (6 May 26)", "Total", "May Total"),
        ("Business Plan Update (June 26)", "Total", "Jun Total"),
        ("Business Plan Update (July 26)", "Total", "Jul Total"),
        ("Business Plan Update (Aug 26)", "Total", "Aug Total"),
    ]:
        sheet = expected_pivot(expected_rows, section, line if "Total" in label or line in ("Green", "Amber", "Bluesky", "Total") else line)
        # fix: use line from tuple
        sheet = expected_pivot(expected_rows, section, line)
        sheet_total = sheet.get("TOTAL")
        stype, field, mlabel = SNAPSHOT_MAP[(section, line)]
        db_sum = 0.0
        for code, lid in CODE_TO_LEADER.items():
            if not lid:
                continue
            doc = snap_idx.get((lid, stype, mlabel if stype == "monthly" else None))
            if doc:
                db_sum += float(doc.get(field) or 0)
        firm_table.append(
            {
                "label": label,
                "sheet": sheet_total,
                "db_sum_mapped_leaders": db_sum,
                "status": pass_fail(nearly_equal(db_sum, sheet_total, TOL_FY_TOTAL)) if sheet_total is not None else "N/A",
            }
        )

    all_mismatches = snap_cmp["mismatches"] + coll_cmp["mismatches"] + derived["mismatches"]
    out = {
        "source_file_in_db": db["source_file"],
        "tx_count_2627": db["tx_count"],
        "leaders": db["leaders"],
        "firm_table_5_1": firm_table,
        "snapshot_side_by_side_fail_count": sum(1 for r in snap_cmp["side_by_side"] if r["status"] == "FAIL"),
        "snapshot_side_by_side_pass_count": sum(1 for r in snap_cmp["side_by_side"] if r["status"] == "PASS"),
        "collection_side_fail": sum(1 for r in coll_cmp["side"] if r["status"] == "FAIL"),
        "collection_side_pass": sum(1 for r in coll_cmp["side"] if r["status"] == "PASS"),
        "aug_db_total": coll_cmp["aug_db_total"],
        "derived_notes": derived["notes"],
        "mismatches": all_mismatches,
        "snapshot_fails_sample": [r for r in snap_cmp["side_by_side"] if r["status"] == "FAIL"][:80],
        "known_bs_by_leader": db["known_bs"],
        "eng_gabs": db["eng_gabs"],
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {OUT_JSON}")
    print(f"Snapshot PASS/FAIL: {out['snapshot_side_by_side_pass_count']}/{out['snapshot_side_by_side_fail_count']}")
    print(f"Collection cells PASS/FAIL: {out['collection_side_pass']}/{out['collection_side_fail']}")
    print(f"Mismatches: {len(all_mismatches)}")
    for row in firm_table:
        print(f"  {row['label']}: sheet={row['sheet']} db={row['db_sum_mapped_leaders']} {row['status']}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
