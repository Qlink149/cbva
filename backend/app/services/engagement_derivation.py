"""Derive dashboard pipeline / collection views from engagements + consolidated plans."""
from __future__ import annotations

from datetime import date, datetime, timezone

from app.core import database
from app.services.fy_calendar import get_fy_month_calendar_year

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]
MONTH_FULL_NAMES = {
    "04": "April", "05": "May", "06": "June", "07": "July",
    "08": "August", "09": "September", "10": "October", "11": "November",
    "12": "December", "01": "January", "02": "February", "03": "March",
}

# Leader id → consolidated column code (mirrors consolidated_service.CODE_TO_LEADER)
LEADER_TO_CODE: dict[str, str] = {
    "amol": "AH",
    "abhitan": "AM",
    "manan": "MM",
    "biu": "BIU",
    "np": "NP",
    "priyesh": "PV",
    "ritesh": "RT",
    "varun": "VC",
    "vinay": "VS",
}


def _fy_display_label(fiscal_year: str) -> str:
    if len(fiscal_year) == 4 and fiscal_year.isdigit():
        return f"20{fiscal_year[:2]}-{fiscal_year[2:]}"
    return fiscal_year


def _month_label(month_key: str, fiscal_year: str) -> str:
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    return f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"


def _to_int(val) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(round(float(val)))
    except (TypeError, ValueError):
        return None


def _plan_amounts_from_rows(rows: list[dict], code: str, prefix: str) -> dict[str, int | None] | None:
    """Extract green/amber/blue_sky/total for a leader code from consolidated row_keys."""
    fields = {
        "green": f"{prefix}_green",
        "amber": f"{prefix}_amber",
        "blue_sky": f"{prefix}_bluesky",
        "total": f"{prefix}_total",
    }
    by_key = {r.get("row_key"): r for r in rows if r.get("kind") == "data" and r.get("row_key")}
    out: dict[str, int | None] = {}
    found = False
    for field, row_key in fields.items():
        row = by_key.get(row_key)
        if not row:
            out[field] = None
            continue
        val = _to_int((row.get("values") or {}).get(code))
        out[field] = val
        if val is not None:
            found = True
    if not found:
        return None
    if out.get("total") is None:
        parts = [out.get("green"), out.get("amber"), out.get("blue_sky")]
        if any(p is not None for p in parts):
            out["total"] = sum(p or 0 for p in parts)
    return out


async def aggregate_engagements(leader_id: str, fiscal_year: str) -> dict:
    agg = await database.db.engagements.aggregate([
        {"$match": {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False}},
        {
            "$group": {
                "_id": None,
                "green": {"$sum": "$green"},
                "amber": {"$sum": "$amber"},
                "blue_sky": {"$sum": "$blue_sky"},
                "total": {"$sum": "$total"},
                "collected": {"$sum": "$collected"},
            }
        },
    ]).to_list(1)
    if not agg:
        return {"green": 0, "amber": 0, "blue_sky": 0, "total": 0, "collected": 0}
    row = agg[0]
    total = row.get("total") or (row["green"] + row["amber"] + row["blue_sky"])
    return {
        "green": row.get("green", 0),
        "amber": row.get("amber", 0),
        "blue_sky": row.get("blue_sky", 0),
        "total": total,
        "collected": row.get("collected", 0),
    }


async def planned_by_month_from_engagements(leader_id: str, fiscal_year: str) -> dict[str, int]:
    docs = await database.db.engagements.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False},
        {"monthly_plan": 1},
    ).to_list(length=500)
    by_month: dict[str, int] = {}
    for doc in docs:
        for mk, val in (doc.get("monthly_plan") or {}).items():
            if val:
                by_month[mk] = by_month.get(mk, 0) + val
    return by_month


async def _load_consolidated_rows(fiscal_year: str) -> list[dict]:
    doc = await database.db.consolidated_summaries.find_one({"report_fy": fiscal_year})
    return list(doc.get("rows") or []) if doc else []


async def _upsert_pipeline_snapshot(
    *,
    leader_id: str,
    fiscal_year: str,
    label: str,
    snapshot_type: str,
    sort_order: int,
    amounts: dict,
    now: datetime,
) -> None:
    green = amounts.get("green")
    amber = amounts.get("amber")
    blue_sky = amounts.get("blue_sky")
    total = amounts.get("total")
    if total is None:
        total = (green or 0) + (amber or 0) + (blue_sky or 0)

    await database.db.pipeline_snapshots.update_one(
        {
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "snapshot_type": snapshot_type,
            "label": label,
        },
        {
            "$set": {
                "leader_id": leader_id,
                "fiscal_year": fiscal_year,
                "label": label,
                "sort_order": sort_order,
                "green": green if green is not None else 0,
                "amber": amber,
                "blue_sky": blue_sky,
                "total": total if total is not None else 0,
                "snapshot_type": snapshot_type,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now, "as_of_date": None},
        },
        upsert=True,
    )


async def materialize_leader_derived_data(leader_id: str, fiscal_year: str) -> bool:
    """
    Build pipeline_snapshots, collection_entries, and a bluesky row.

    Pipeline rules:
    - Initial Plan / Board Plan / past monthly rows → from consolidated sheet (proper plans)
    - Current month row → live engagement totals (July is correct from engagements)
    """
    totals = await aggregate_engagements(leader_id, fiscal_year)
    eng_count = await database.db.engagements.count_documents(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False}
    )
    consolidated_rows = await _load_consolidated_rows(fiscal_year)
    code = LEADER_TO_CODE.get(leader_id)

    has_engagement_totals = bool(
        totals["total"] or totals["green"] or totals["amber"] or totals["blue_sky"]
    )
    if eng_count == 0 and not consolidated_rows:
        return False

    now = datetime.now(timezone.utc)
    fy_label = _fy_display_label(fiscal_year)
    today = date.today()
    current_mk = f"{today.month:02d}"

    # --- Initial Plan (consolidated; never overwrite with live engagements) ---
    initial = _plan_amounts_from_rows(consolidated_rows, code, f"fy{fiscal_year}_initial") if code else None
    if initial:
        await _upsert_pipeline_snapshot(
            leader_id=leader_id,
            fiscal_year=fiscal_year,
            label=f"Initial Plan ({fy_label})",
            snapshot_type="initial",
            sort_order=0,
            amounts=initial,
            now=now,
        )
    elif has_engagement_totals:
        # Fallback only when consolidated has no initial row for this leader
        existing = await database.db.pipeline_snapshots.find_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": "initial"}
        )
        if not existing:
            await _upsert_pipeline_snapshot(
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                label=f"Initial Plan ({fy_label})",
                snapshot_type="initial",
                sort_order=0,
                amounts=totals,
                now=now,
            )

    # --- Board Plan (consolidated) ---
    board = _plan_amounts_from_rows(consolidated_rows, code, f"fy{fiscal_year}_board") if code else None
    if board:
        await _upsert_pipeline_snapshot(
            leader_id=leader_id,
            fiscal_year=fiscal_year,
            label=f"Board Plan ({fy_label})",
            snapshot_type="board",
            sort_order=1,
            amounts=board,
            now=now,
        )
    elif has_engagement_totals:
        existing = await database.db.pipeline_snapshots.find_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": "board"}
        )
        if not existing:
            await _upsert_pipeline_snapshot(
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                label=f"Board Plan ({fy_label})",
                snapshot_type="board",
                sort_order=1,
                amounts=totals,
                now=now,
            )

    # --- Monthly snapshots ---
    # Past months from consolidated; current month from live engagements.
    for i, mk in enumerate(FY_MONTH_KEYS):
        label = _month_label(mk, fiscal_year)
        sort_order = i + 2  # after initial(0) and board(1)

        if mk == current_mk and has_engagement_totals:
            await _upsert_pipeline_snapshot(
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                label=label,
                snapshot_type="monthly",
                sort_order=sort_order,
                amounts=totals,
                now=now,
            )
            continue

        monthly = (
            _plan_amounts_from_rows(consolidated_rows, code, f"fy{fiscal_year}_monthly_{mk}")
            if code
            else None
        )
        if monthly:
            await _upsert_pipeline_snapshot(
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                label=label,
                snapshot_type="monthly",
                sort_order=sort_order,
                amounts=monthly,
                now=now,
            )

    # Collection plan targets from engagement monthly_plan
    planned_by_month = await planned_by_month_from_engagements(leader_id, fiscal_year)
    for i, mk in enumerate(FY_MONTH_KEYS):
        planned = planned_by_month.get(mk, 0)
        if planned <= 0:
            continue
        label = _month_label(mk, fiscal_year)
        await database.db.collection_entries.update_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "month": label},
            {
                "$set": {
                    "leader_id": leader_id,
                    "fiscal_year": fiscal_year,
                    "month": label,
                    "sort_order": i + 1,
                    "planned": planned,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "collected": 0,
                    "outstanding": None,
                    "variance": -planned,
                    "created_at": now,
                },
            },
            upsert=True,
        )

    # Blue sky ledger is owned by engagement write cascades (_auto_update_bluesky).
    # Do NOT overwrite blue_sky_entries here — that destroys Opening/Additional/Converted history.

    return True


async def materialize_all_leaders(fiscal_year: str) -> int:
    leaders = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    count = 0
    for ldr in leaders:
        if await materialize_leader_derived_data(ldr["_id"], fiscal_year):
            count += 1
    return count
