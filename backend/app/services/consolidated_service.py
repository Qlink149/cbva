"""Consolidated summary: imported management sheet + live engagement-derived overrides."""
from __future__ import annotations

import copy
from datetime import date
from typing import Any

from app.core import database
from app.services import audit_service
from app.services.consolidated_import import (
    COLUMN_CODES,
    default_xlsx_path,
    parse_consolidated_xlsx,
)
from app.services.engagement_derivation import planned_by_month_from_engagements
from app.services.fy_calendar import get_available_fy_month_keys, get_fy_month_calendar_year

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]
MONTH_FULL_NAMES = {
    "04": "April", "05": "May", "06": "June", "07": "July",
    "08": "August", "09": "September", "10": "October", "11": "November",
    "12": "December", "01": "January", "02": "February", "03": "March",
}

CODE_TO_LEADER: dict[str, str | None] = {
    "AH": "amol",
    "AK": None,
    "AM": "abhitan",
    "MM": "manan",
    "BIU": "biu",
    "NP": "np",
    "PV": "priyesh",
    "RT": "ritesh",
    "SP": None,
    "VC": "varun",
    "VP": None,
    "VS": "vinay",
}

DYNAMIC_PARTS = (
    "_initial_",
    "_board_",
    "_monthly_",
    "_bifur_",
    "_coll_planned_",
    "_coll_actual_",
    "_coll_upto_",
)


def _month_label(month_key: str, fiscal_year: str) -> str:
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    return f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"


def _snap_values(snap: dict | None) -> dict[str, float] | None:
    if not snap:
        return None
    green = float(snap.get("green") or 0)
    amber = float(snap.get("amber") or 0)
    blue_sky = float(snap.get("blue_sky") or 0)
    total = float(snap.get("total") or green + amber + blue_sky)
    return {"green": green, "amber": amber, "blueSky": blue_sky, "total": total}


def _pick_snapshot(rows: list[dict], snap_type: str) -> dict[str, float] | None:
    for row in rows:
        if row.get("snapshot_type") == snap_type:
            return _snap_values(row)
    return None


def _month_key_from_label(label: str) -> str | None:
    lower = (label or "").lower()
    for key, name in MONTH_FULL_NAMES.items():
        if name.lower() in lower:
            return key
    return None


def _pick_monthly(rows: list[dict], month_key: str) -> dict[str, float] | None:
    full = MONTH_FULL_NAMES.get(month_key, "").lower()
    for row in rows:
        if row.get("snapshot_type") != "monthly":
            continue
        label = (row.get("label") or "").lower()
        if full and full in label:
            return _snap_values(row)
    return None


async def _leader_collections(leader_id: str, fiscal_year: str) -> dict[str, Any]:
    as_of = date.today()
    allowed = get_available_fy_month_keys(fiscal_year, as_of)

    entry_docs = await database.db.collection_entries.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).to_list(20)
    entry_by_key: dict[str, dict] = {}
    for doc in entry_docs:
        for key, name in MONTH_FULL_NAMES.items():
            if str(doc.get("month", "")).startswith(name):
                if key in allowed:
                    entry_by_key[key] = doc
                break

    engagement_planned = await planned_by_month_from_engagements(leader_id, fiscal_year)

    tx_docs = await database.db.collection_transactions.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).to_list(500)
    tx_by_month: dict[str, list] = {}
    for tx in tx_docs:
        mk = tx.get("month")
        if mk in allowed:
            tx_by_month.setdefault(mk, []).append(tx)

    by_month: dict[str, dict[str, float]] = {}
    total_collected = 0.0
    for mk in allowed:
        entry = entry_by_key.get(mk)
        planned = float(entry.get("planned", 0) if entry else engagement_planned.get(mk, 0) or 0)
        txs = tx_by_month.get(mk, [])
        tx_sum = sum(float(tx.get("amount_collected") or 0) for tx in txs)
        actual = tx_sum if tx_sum > 0 else float(entry.get("collected", 0) if entry else 0)
        total_collected += actual
        by_month[mk] = {"planned": planned, "actual": actual}

    return {"by_month": by_month, "total_collected": total_collected}


async def _leader_bundle(leader_id: str, fiscal_year: str) -> dict[str, Any]:
    pipeline = await database.db.pipeline_snapshots.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("sort_order", 1).to_list(50)

    engagements = await database.db.engagements.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False}
    ).to_list(500)

    known_bluesky = sum(float(e.get("blue_sky") or 0) for e in engagements)
    eng_totals = None
    if engagements:
        green = sum(float(e.get("green") or 0) for e in engagements)
        amber = sum(float(e.get("amber") or 0) for e in engagements)
        blue_sky = sum(float(e.get("blue_sky") or 0) for e in engagements)
        total = sum(float(e.get("total") or 0) for e in engagements) or green + amber + blue_sky
        eng_totals = {"green": green, "amber": amber, "blueSky": blue_sky, "total": total}

    monthly: dict[str, dict[str, float]] = {}
    bifur: dict[str, dict[str, float]] = {}
    for mk in FY_MONTH_KEYS:
        snap = _pick_monthly(pipeline, mk)
        if snap:
            monthly[mk] = snap
            total_bs = snap["blueSky"]
            known = min(known_bluesky, total_bs)
            bifur[mk] = {
                "total": total_bs,
                "known": known,
                "unidentified": total_bs - known,
                "total_bs": total_bs,
            }

    if eng_totals and not monthly:
        latest_key = FY_MONTH_KEYS[-1]
        monthly[latest_key] = eng_totals
        total_bs = eng_totals["blueSky"]
        known = min(known_bluesky, total_bs)
        bifur[latest_key] = {
            "total": total_bs,
            "known": known,
            "unidentified": total_bs - known,
            "total_bs": total_bs,
        }

    collections = await _leader_collections(leader_id, fiscal_year)

    return {
        "initial": _pick_snapshot(pipeline, "initial") or eng_totals,
        "board": _pick_snapshot(pipeline, "board") or eng_totals,
        "actual": collections["total_collected"] if collections["total_collected"] else None,
        "monthly": monthly,
        "bifur": bifur,
        "coll": collections["by_month"],
        "eng_totals": eng_totals,
    }


def _is_dynamic_row(row_key: str | None, report_fy: str) -> bool:
    if not row_key:
        return False
    if not row_key.startswith(f"fy{report_fy}_"):
        return False
    return any(part in row_key for part in DYNAMIC_PARTS)


def _dynamic_value(bundle: dict[str, Any], row_key: str) -> float | None:
    """Resolve a dynamic cell value from a leader bundle and row_key."""
    prefix_end = row_key.find("_")
    if prefix_end < 0:
        return None
    body = row_key[prefix_end + 1 :]

    if body.startswith("initial_"):
        field = body.replace("initial_", "")
        snap = bundle.get("initial")
        if not snap:
            return None
        return snap.get("blueSky" if field == "bluesky" else field)
    if body.startswith("board_"):
        field = body.replace("board_", "")
        snap = bundle.get("board")
        if not snap:
            return None
        return snap.get("blueSky" if field == "bluesky" else field)
    if body.startswith("monthly_"):
        rest = body.replace("monthly_", "", 1)
        mk, _, field = rest.partition("_")
        snap = bundle.get("monthly", {}).get(mk)
        if not snap:
            return None
        return snap.get("blueSky" if field == "bluesky" else field)
    if body.startswith("bifur_"):
        rest = body.replace("bifur_", "", 1)
        mk, _, field = rest.partition("_")
        bif = bundle.get("bifur", {}).get(mk)
        if not bif:
            return None
        key = "total_bs" if field == "total_bs" else field
        return bif.get(key)
    if body.startswith("coll_planned_"):
        mk = body.replace("coll_planned_", "").replace("_revised", "")
        planned = bundle.get("coll", {}).get(mk, {}).get("planned")
        return planned if planned else None
    if body.startswith("coll_actual_"):
        mk = body.replace("coll_actual_", "")
        val = bundle.get("coll", {}).get(mk, {}).get("actual")
        return val if val else None
    if body.startswith("coll_upto_"):
        mk = body.replace("coll_upto_", "")
        if mk not in FY_MONTH_KEYS:
            return None
        upto = FY_MONTH_KEYS[: FY_MONTH_KEYS.index(mk) + 1]
        amounts = [bundle.get("coll", {}).get(k, {}).get("actual", 0) for k in upto]
        nums = [a for a in amounts if a]
        return sum(nums) if nums else None
    return None


def _sum_cells(values: dict[str, float | None]) -> float | None:
    nums = [v for v in values.values() if isinstance(v, (int, float))]
    return sum(nums) if nums else None


async def ensure_imported_matrix(
    report_fy: str, *, user: dict | None = None
) -> list[dict[str, Any]]:
    existing = await database.db.consolidated_summaries.find_one({"report_fy": report_fy})
    if existing:
        return existing["rows"]

    xlsx_path = default_xlsx_path()
    if not xlsx_path.exists():
        return []

    rows = parse_consolidated_xlsx(xlsx_path, report_fy=report_fy)
    await database.db.consolidated_summaries.update_one(
        {"report_fy": report_fy},
        {"$set": {"report_fy": report_fy, "rows": rows, "source_file": str(xlsx_path.name)}},
        upsert=True,
    )

    if user is not None:
        doc = await database.db.consolidated_summaries.find_one({"report_fy": report_fy})
        data_rows = [r for r in rows if r.get("kind") == "data"]
        await audit_service.log_event(
            entity_type="consolidated_summary",
            entity_id=str(doc["_id"]) if doc else report_fy,
            entity_label=f"Consolidated FY {report_fy}",
            action="imported",
            user=user,
            changes=[{"field": "rows_created", "label": "Rows Created", "old": None, "new": len(data_rows)}],
            fiscal_year=report_fy,
            source="csv_import",
        )

    return rows


async def get_consolidated_summary(report_fy: str) -> dict[str, Any]:
    imported_rows = await ensure_imported_matrix(report_fy)
    leader_ids = [lid for lid in CODE_TO_LEADER.values() if lid]

    bundles: dict[str, dict] = {}
    for lid in leader_ids:
        bundles[lid] = await _leader_bundle(lid, report_fy)

    matrix: list[dict[str, Any]] = []
    for row in imported_rows:
        item = copy.deepcopy(row)
        if item.get("kind") != "data":
            matrix.append(item)
            continue

        row_key = item.get("row_key")
        values: dict[str, float | None] = {}
        for code in COLUMN_CODES:
            leader_id = CODE_TO_LEADER[code]
            imported_val = item.get("values", {}).get(code)

            if leader_id and _is_dynamic_row(row_key, report_fy):
                dynamic_val = _dynamic_value(bundles[leader_id], row_key)
                if dynamic_val is not None:
                    values[code] = dynamic_val
                else:
                    values[code] = imported_val
            else:
                values[code] = imported_val

        item["values"] = values
        item["total"] = _sum_cells(values)
        item["is_dynamic"] = bool(row_key and _is_dynamic_row(row_key, report_fy))
        matrix.append(item)

    columns = [{"code": c, "leader_id": CODE_TO_LEADER[c]} for c in COLUMN_CODES]
    return {
        "report_fy": report_fy,
        "columns": columns,
        "rows": matrix,
    }
