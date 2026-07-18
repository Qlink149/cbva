from datetime import date

from app.core import database
from app.services.month_matching import month_field_regex, month_label_regex, pick_pipeline_snapshot
from app.services.fy_calendar import (
    is_future_fy_month,
    get_available_fy_month_keys,
    get_fy_month_calendar_year,
)


async def _empty_monthly_summary(fiscal_year: str) -> list:
    leaders = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    engagement_counts = await database.db.engagements.aggregate([
        {"$match": {"fiscal_year": fiscal_year, "is_archived": False}},
        {
            "$group": {
                "_id": "$leader_id",
                "engagement_count": {"$sum": 1},
                "el_signed_count": {
                    "$sum": {"$cond": [{"$eq": ["$el_status", "Signed"]}, 1, 0]}
                },
            }
        },
    ]).to_list(length=50)
    count_map = {row["_id"]: row for row in engagement_counts}
    return [
        {
            "_id": ldr["_id"],
            "total_green": 0,
            "total_amber": 0,
            "total_blue_sky": 0,
            "total_pipeline": 0,
            "total_collected": 0,
            "engagement_count": count_map.get(ldr["_id"], {}).get("engagement_count", 0),
            "el_signed_count": count_map.get(ldr["_id"], {}).get("el_signed_count", 0),
        }
        for ldr in leaders
    ]


async def get_firmwide_summary(fiscal_year: str, month: str | None = None) -> list:
    if month and is_future_fy_month(fiscal_year, month):
        return await _empty_monthly_summary(fiscal_year)

    if not month:
        pipeline = [
            {"$match": {"fiscal_year": fiscal_year, "is_archived": False}},
            {
                "$group": {
                    "_id": "$leader_id",
                    "total_green": {"$sum": "$green"},
                    "total_amber": {"$sum": "$amber"},
                    "total_blue_sky": {"$sum": "$blue_sky"},
                    "total_pipeline": {"$sum": "$total"},
                    "total_collected": {"$sum": "$collected"},
                    "engagement_count": {"$sum": 1},
                    "el_signed_count": {
                        "$sum": {"$cond": [{"$eq": ["$el_status", "Signed"]}, 1, 0]}
                    },
                }
            },
            {"$sort": {"total_pipeline": -1}},
        ]
        return await database.db.engagements.aggregate(pipeline).to_list(length=50)

    field_pattern = month_field_regex(month)
    label_pattern = month_label_regex(month)
    if not field_pattern or not label_pattern:
        return []

    leaders = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    leader_ids = [ldr["_id"] for ldr in leaders]

    engagement_counts = await database.db.engagements.aggregate([
        {"$match": {"fiscal_year": fiscal_year, "is_archived": False, "leader_id": {"$in": leader_ids}}},
        {
            "$group": {
                "_id": "$leader_id",
                "engagement_count": {"$sum": 1},
                "el_signed_count": {
                    "$sum": {"$cond": [{"$eq": ["$el_status", "Signed"]}, 1, 0]}
                },
            }
        },
    ]).to_list(length=50)
    count_map = {row["_id"]: row for row in engagement_counts}

    # Use collection_transactions (source of truth) instead of collection_entries
    # month here is a two-digit key like "04" which matches collection_transactions.month
    collected_rows = await database.db.collection_transactions.aggregate([
        {
            "$match": {
                "fiscal_year": fiscal_year,
                "leader_id": {"$in": leader_ids},
                "month": month,
            }
        },
        {"$group": {"_id": "$leader_id", "total_collected": {"$sum": "$amount_collected"}}},
    ]).to_list(length=50)
    collected_map = {row["_id"]: row.get("total_collected", 0) for row in collected_rows}

    snapshot_docs = await database.db.pipeline_snapshots.find(
        {
            "fiscal_year": fiscal_year,
            "leader_id": {"$in": leader_ids},
            "snapshot_type": "monthly",
            "label": {"$regex": label_pattern, "$options": "i"},
        }
    ).to_list(length=500)

    snapshots_by_leader: dict[str, list] = {}
    for doc in snapshot_docs:
        snapshots_by_leader.setdefault(doc["leader_id"], []).append(doc)

    result = []
    for ldr in leaders:
        lid = ldr["_id"]
        snap = pick_pipeline_snapshot(snapshots_by_leader.get(lid, []), month)
        counts = count_map.get(lid, {})
        green = (snap or {}).get("green") or 0
        amber = (snap or {}).get("amber") or 0
        blue_sky = (snap or {}).get("blue_sky") or 0
        total = (snap or {}).get("total") or (green + amber + blue_sky)
        result.append({
            "_id": lid,
            "total_green": green,
            "total_amber": amber,
            "total_blue_sky": blue_sky,
            "total_pipeline": total,
            "total_collected": collected_map.get(lid, 0),
            "engagement_count": counts.get("engagement_count", 0),
            "el_signed_count": counts.get("el_signed_count", 0),
        })

    result.sort(key=lambda row: row.get("total_pipeline", 0), reverse=True)
    return result


async def get_firmwide_clients(fiscal_year: str, skip: int = 0, limit: int = 200) -> tuple[list, int]:
    query = {"fiscal_year": fiscal_year, "is_archived": False}
    total = await database.db.engagements.count_documents(query)
    cursor = database.db.engagements.find(
        query,
        sort=[("leader_id", 1), ("num", 1)],
        skip=skip,
        limit=limit,
    )
    docs = await cursor.to_list(length=limit)
    return docs, total


async def get_firmwide_team(fiscal_year: str | None = None) -> list:
    query: dict = {"status": "Active"}
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    cursor = database.db.team_members.find(query, sort=[("leader_id", 1)])
    return await cursor.to_list(length=1000)


async def get_firmwide_dashboard_aggregate(fiscal_year: str) -> dict:
    """Aggregate pipeline, bluesky, and collections across all leaders for firmwide dashboard."""
    leaders = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    leader_ids = [l["_id"] for l in leaders]

    pipeline_totals = {"green": 0, "amber": 0, "blue_sky": 0, "total": 0}
    for lid in leader_ids:
        latest = await database.db.pipeline_snapshots.find_one(
            {"leader_id": lid, "fiscal_year": fiscal_year},
            sort=[("sort_order", -1)],
        )
        if latest:
            pipeline_totals["green"] += latest.get("green", 0)
            pipeline_totals["amber"] += latest.get("amber") or 0
            pipeline_totals["blue_sky"] += latest.get("blue_sky") or 0
            pipeline_totals["total"] += latest.get("total", 0)

    bluesky_docs = await database.db.blue_sky_entries.find(
        {"fiscal_year": fiscal_year, "leader_id": {"$in": leader_ids}}
    ).to_list(length=500)

    MONTH_FULL = {
        "04": "April", "05": "May", "06": "June", "07": "July",
        "08": "August", "09": "September", "10": "October", "11": "November",
        "12": "December", "01": "January", "02": "February", "03": "March",
    }

    def _mk_from_label(month_str: str) -> str | None:
        for key, name in MONTH_FULL.items():
            if month_str.startswith(name):
                return key
        return None

    from app.services.fy_calendar import get_fy_month_calendar_year
    allowed_month_keys = get_available_fy_month_keys(fiscal_year, date.today())

    bluesky_by_key: dict[str, dict] = {}
    for doc in bluesky_docs:
        mk = doc.get("month_key") or _mk_from_label(doc.get("month", ""))
        if not mk or mk not in allowed_month_keys:
            continue
        if mk not in bluesky_by_key:
            bluesky_by_key[mk] = {
                "opening": 0,
                "additional": 0,
                "converted": 0,
                "closing": 0,
                "has_data": False,
            }
        bluesky_by_key[mk]["opening"] += doc.get("opening") or 0
        bluesky_by_key[mk]["additional"] += doc.get("additional") or 0
        bluesky_by_key[mk]["converted"] += doc.get("converted") or 0
        bluesky_by_key[mk]["closing"] += doc.get("closing") or 0
        bluesky_by_key[mk]["has_data"] = True

    bluesky_monthly = []
    for i, mk in enumerate(allowed_month_keys):
        cal_year = get_fy_month_calendar_year(mk, fiscal_year)
        month_label = f"{MONTH_FULL[mk]} {cal_year}"
        agg = bluesky_by_key.get(mk)
        if agg and agg["has_data"]:
            bluesky_monthly.append({
                "month": month_label,
                "month_key": mk,
                "opening": agg["opening"],
                "additional": agg["additional"],
                "converted": agg["converted"],
                "closing": agg["closing"],
                "has_data": True,
                "sort_order": i + 1,
            })
        else:
            bluesky_monthly.append({
                "month": month_label,
                "month_key": mk,
                "opening": None,
                "additional": None,
                "converted": None,
                "closing": None,
                "has_data": False,
                "sort_order": i + 1,
            })

    data_months = [m for m in bluesky_monthly if m.get("has_data")]
    bluesky_totals = {
        "opening": next((m["opening"] for m in data_months if m.get("opening") is not None), None),
        "additional": sum(m.get("additional") or 0 for m in data_months) if data_months else None,
        "converted": sum(m.get("converted") or 0 for m in data_months) if data_months else None,
        "closing": next(
            (m["closing"] for m in reversed(data_months) if m.get("closing") is not None),
            None,
        ),
    }

    # Planned targets from collection_entries
    ce_docs = await database.db.collection_entries.find(
        {"fiscal_year": fiscal_year, "leader_id": {"$in": leader_ids}}
    ).to_list(length=500)
    planned_by_month: dict = {}
    for doc in ce_docs:
        m = doc["month"]
        planned_by_month[m] = planned_by_month.get(m, 0) + doc.get("planned", 0)

    # Actual collections from collection_transactions (source of truth)
    tx_agg = await database.db.collection_transactions.aggregate([
        {"$match": {"fiscal_year": fiscal_year, "leader_id": {"$in": leader_ids}}},
        {"$group": {"_id": "$month", "collected": {"$sum": "$amount_collected"}}},
    ]).to_list(length=12)
    actual_by_month_key: dict = {row["_id"]: row["collected"] for row in tx_agg}

    monthly_lines = []
    total_collected = 0
    for mk in allowed_month_keys:
        cal_year = get_fy_month_calendar_year(mk, fiscal_year)
        month_label = f"{MONTH_FULL[mk]} {cal_year}"
        collected = actual_by_month_key.get(mk, 0)
        total_collected += collected
        monthly_lines.append({
            "month": month_label,
            "planned": planned_by_month.get(month_label, 0),
            "collected": collected,
            "sort_order": len(monthly_lines) + 1,
        })

    return {
        "pipeline": pipeline_totals,
        "bluesky": {**bluesky_totals, "monthly_lines": bluesky_monthly},
        "collections": {"monthly_lines": monthly_lines, "total_collected": total_collected},
    }
