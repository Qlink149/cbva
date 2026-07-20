from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, date
from bson import ObjectId
from app.schemas.engagement import EngagementCreate, EngagementUpdate, RemarksUpdate, EngagementResponse
from app.core.serialization import serialize_datetime
from app.services.engagement_service import compute_totals
from app.services.engagement_change_service import list_changes
from app.services import audit_service
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.dependencies.pagination import pagination_params
from app.services.fy_calendar import get_fy_month_calendar_year
from app.services.fiscal_year import assert_fy_editable

router = APIRouter()

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]
MONTH_FULL_NAMES = {
    "04": "April",   "05": "May",      "06": "June",     "07": "July",
    "08": "August",  "09": "September","10": "October",  "11": "November",
    "12": "December","01": "January",  "02": "February", "03": "March",
}


def _serialize_remarks_history(entries: list | None) -> list[dict]:
    if not entries:
        return []
    return [
        {
            "text": e.get("text", ""),
            "at": serialize_datetime(e.get("at")),
            "by": e.get("by", ""),
        }
        for e in entries
    ]


def _resolve_monthly_plan(doc: dict) -> dict[str, int]:
    """Return the engagement's monthly plan, seeding from legacy month fields
    when the standardized `monthly_plan` map is absent (zero-migration)."""
    existing = doc.get("monthly_plan")
    if existing:
        return {k: v for k, v in existing.items() if v is not None}
    legacy = {
        "05": doc.get("may_col"),
        "06": doc.get("june_col"),
        "07": doc.get("july_col"),
        "08": doc.get("august_col"),
    }
    return {k: v for k, v in legacy.items() if v is not None}


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "num": doc["num"],
        "name": doc["name"],
        "model": doc.get("model", "—"),
        "rel_partner": doc.get("rel_partner", ""),
        "el_status": doc.get("el_status", "—"),
        "green": doc.get("green", 0),
        "amber": doc.get("amber", 0),
        "blue_sky": doc.get("blue_sky", 0),
        "total": doc.get("total", 0),
        "collected": doc.get("collected", 0),
        "may_col": doc.get("may_col"),
        "june_col": doc.get("june_col"),
        "july_col": doc.get("july_col"),
        "august_col": doc.get("august_col"),
        "monthly_plan": _resolve_monthly_plan(doc),
        "person_responsible": doc.get("person_responsible"),
        "originator": doc.get("originator"),
        "assignment_type": doc.get("assignment_type"),
        "client_scope": doc.get("client_scope", "Domestic"),
        "balance": doc.get("balance"),
        "remarks": doc.get("remarks", ""),
        "remarks_history": _serialize_remarks_history(doc.get("remarks_history")),
        "is_archived": doc.get("is_archived", False),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


def _engagement_derived_changes(existing: dict, green: int, amber: int, blue_sky: int, collected: int) -> list[dict]:
    old_totals = compute_totals(
        existing.get("green", 0),
        existing.get("amber", 0),
        existing.get("blue_sky", 0),
        existing.get("collected", 0),
    )
    new_totals = compute_totals(green, amber, blue_sky, collected)
    derived: list[dict] = []
    for field, label in (("total", "Total"), ("balance", "Balance")):
        if old_totals[field] != new_totals[field]:
            derived.append(
                {
                    "field": field,
                    "label": label,
                    "old": old_totals[field],
                    "new": new_totals[field],
                    "derived": True,
                }
            )
    return derived


async def _auto_upsert_pipeline_snapshot(
    leader_id: str,
    fiscal_year: str,
    now: datetime,
    user: dict | None = None,
    triggered_by: ObjectId | None = None,
) -> None:
    """Auto-upsert a monthly pipeline snapshot whenever any engagement is saved."""
    today = date.today()
    month_key = f"{today.month:02d}"
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    month_label = f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"
    sort_order = FY_MONTH_KEYS.index(month_key) + 1 if month_key in FY_MONTH_KEYS else 0

    before_snap = await database.db.pipeline_snapshots.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "label": month_label}
    )

    agg = await database.db.engagements.aggregate([
        {"$match": {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False}},
        {"$group": {
            "_id": None,
            "green": {"$sum": "$green"},
            "amber": {"$sum": "$amber"},
            "blue_sky": {"$sum": "$blue_sky"},
            "total": {"$sum": "$total"},
        }},
    ]).to_list(1)

    if agg:
        snap = agg[0]
        await database.db.pipeline_snapshots.update_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "label": month_label},
            {
                "$set": {
                    "leader_id": leader_id,
                    "fiscal_year": fiscal_year,
                    "label": month_label,
                    "green": snap["green"],
                    "amber": snap["amber"],
                    "blue_sky": snap["blue_sky"],
                    "total": snap["total"],
                    "snapshot_type": "monthly",
                    "updated_at": now,
                },
                "$setOnInsert": {"sort_order": sort_order, "created_at": now, "as_of_date": None},
            },
            upsert=True,
        )

        if user is not None:
            after_snap = await database.db.pipeline_snapshots.find_one(
                {"leader_id": leader_id, "fiscal_year": fiscal_year, "label": month_label}
            )
            if after_snap:
                old_total = before_snap.get("total") if before_snap else None
                new_total = after_snap.get("total")
                if before_snap is None or old_total != new_total:
                    await audit_service.log_event(
                        entity_type="pipeline_snapshot",
                        entity_id=str(after_snap["_id"]),
                        entity_label=month_label,
                        action="updated" if before_snap else "created",
                        user=user,
                        changes=[{"field": "total", "label": "Total", "old": old_total, "new": new_total}],
                        leader_id=leader_id,
                        fiscal_year=fiscal_year,
                        source="system",
                        triggered_by=triggered_by,
                    )


async def _auto_update_bluesky(
    leader_id: str,
    fiscal_year: str,
    old_blue_sky: int,
    new_blue_sky: int,
    old_green: int,
    new_green: int,
    old_amber: int,
    new_amber: int,
    now: datetime,
    user: dict | None = None,
    triggered_by: ObjectId | None = None,
) -> None:
    """Update Opening/Additional/Converted/Closing for the CURRENT month only.

    Past months are never rewritten — they stay as historical ledger closes.
    opening for a new month row = previous month's closing when available.
    """
    if new_blue_sky == old_blue_sky:
        return

    delta = new_blue_sky - old_blue_sky
    today = date.today()
    month_key = f"{today.month:02d}"
    if month_key not in FY_MONTH_KEYS:
        return

    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    month_label = f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"
    sort_order = FY_MONTH_KEYS.index(month_key) + 1

    is_conversion = (delta < 0) and (new_green > old_green or new_amber > old_amber)

    existing = await database.db.blue_sky_entries.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "month": month_label}
    )

    if existing:
        additional = existing.get("additional") or 0
        converted = existing.get("converted") or 0
        opening = existing.get("opening") or 0
        if delta > 0:
            additional += delta
        elif is_conversion:
            converted += abs(delta)
        else:
            additional = max(0, additional + delta)
        closing = opening + additional - converted
        await database.db.blue_sky_entries.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "month_key": month_key,
                "additional": additional,
                "converted": converted,
                "closing": closing,
                "updated_at": now,
            }},
        )
        if user is not None:
            await audit_service.log_event(
                entity_type="bluesky_entry",
                entity_id=str(existing["_id"]),
                entity_label=month_label,
                action="updated",
                user=user,
                changes=[{"field": "closing", "label": "Closing", "old": existing.get("closing"), "new": closing}],
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                source="system",
                triggered_by=triggered_by,
            )
    else:
        # Opening = latest prior month's closing in this FY (skip gaps)
        opening = 0
        cur_idx = FY_MONTH_KEYS.index(month_key)
        for prev_key in reversed(FY_MONTH_KEYS[:cur_idx]):
            prev_cal = get_fy_month_calendar_year(prev_key, fiscal_year)
            prev_label = f"{MONTH_FULL_NAMES.get(prev_key, prev_key)} {prev_cal}"
            prev_entry = await database.db.blue_sky_entries.find_one(
                {"leader_id": leader_id, "fiscal_year": fiscal_year, "month": prev_label}
            )
            if prev_entry and prev_entry.get("closing") is not None:
                opening = prev_entry.get("closing") or 0
                break

        additional = max(0, delta) if delta > 0 else 0
        converted = abs(delta) if is_conversion else 0
        if delta < 0 and not is_conversion:
            additional = 0
        closing = opening + additional - converted

        insert_result = await database.db.blue_sky_entries.insert_one({
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "month": month_label,
            "month_key": month_key,
            "sort_order": sort_order,
            "opening": opening,
            "additional": additional,
            "converted": converted,
            "closing": closing,
            "remarks": "",
            "created_at": now,
            "updated_at": now,
        })
        if user is not None:
            await audit_service.log_event(
                entity_type="bluesky_entry",
                entity_id=str(insert_result.inserted_id),
                entity_label=month_label,
                action="created",
                user=user,
                changes=[{"field": "closing", "label": "Closing", "old": None, "new": closing}],
                leader_id=leader_id,
                fiscal_year=fiscal_year,
                source="system",
                triggered_by=triggered_by,
            )


@router.get("/", response_model=dict)
async def list_engagements(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    is_archived: bool = Query(False),
    pagination: dict = Depends(pagination_params),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query = {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": is_archived}
    total = await database.db.engagements.count_documents(query)
    cursor = database.db.engagements.find(query).sort("num", 1).skip(pagination["skip"]).limit(pagination["limit"])
    docs = await cursor.to_list(length=pagination["limit"])
    return {"data": [_serialize(d) for d in docs], "total": total, "skip": pagination["skip"], "limit": pagination["limit"]}


@router.post("/", response_model=EngagementResponse, status_code=201)
async def create_engagement(body: EngagementCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)
    last = await database.db.engagements.find_one(
        {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year},
        sort=[("num", -1)],
    )
    num = (last["num"] + 1) if last else 1
    totals = compute_totals(body.green, body.amber, body.blue_sky, body.collected)
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(exclude={"source"}),
        "num": num,
        "total": totals["total"],
        "balance": totals["balance"],
        "remarks_history": [],
        "is_archived": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.engagements.insert_one(doc)
    doc["_id"] = result.inserted_id

    await audit_service.log_create(
        "engagement", doc, current_user,
        label=doc["name"],
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )

    # Auto-snapshot pipeline for this month
    await _auto_upsert_pipeline_snapshot(body.leader_id, body.fiscal_year, now, user=current_user)

    # Auto-update blue_sky if any
    if body.blue_sky > 0:
        await _auto_update_bluesky(
            body.leader_id, body.fiscal_year,
            0, body.blue_sky, 0, body.green, 0, body.amber, now,
            user=current_user,
        )

    return _serialize(doc)


@router.put("/{engagement_id}", response_model=EngagementResponse)
async def update_engagement(
    engagement_id: str,
    body: EngagementUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates.pop("remarks", None)

    # Merge partial monthly_plan updates into the existing (legacy-seeded) map
    if body.monthly_plan is not None:
        merged = _resolve_monthly_plan(existing)
        merged.update({k: v for k, v in body.monthly_plan.items() if v is not None})
        updates["monthly_plan"] = merged

    green = updates.get("green", existing["green"])
    amber = updates.get("amber", existing["amber"])
    blue_sky = updates.get("blue_sky", existing.get("blue_sky", 0))
    collected = existing.get("collected", 0)
    totals = compute_totals(green, amber, blue_sky, collected)
    updates.update(totals)
    now = datetime.now(timezone.utc)
    updates["updated_at"] = now

    result = await database.db.engagements.find_one_and_update(
        {"_id": ObjectId(engagement_id)}, {"$set": updates}, return_document=True
    )

    audit_updates = {k: v for k, v in updates.items() if k not in ("total", "balance")}
    derived = _engagement_derived_changes(existing, green, amber, blue_sky, collected)
    audit_id = await audit_service.log_update(
        "engagement", existing, audit_updates, current_user,
        label=existing["name"],
        derived=derived,
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )

    # Auto-snapshot pipeline for this month
    await _auto_upsert_pipeline_snapshot(
        existing["leader_id"], existing["fiscal_year"], now,
        user=current_user, triggered_by=audit_id,
    )

    # Auto-update blue_sky_entries if blue_sky field changed
    old_bs = existing.get("blue_sky", 0)
    new_bs = updates.get("blue_sky", old_bs)
    if new_bs != old_bs:
        await _auto_update_bluesky(
            existing["leader_id"], existing["fiscal_year"],
            old_bs, new_bs,
            existing.get("green", 0), green,
            existing.get("amber", 0), amber,
            now,
            user=current_user, triggered_by=audit_id,
        )

    return _serialize(result)


@router.get("/{engagement_id}/changes", response_model=dict)
async def get_engagement_changes(
    engagement_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_scope(current_user, existing["leader_id"])
    changes = await list_changes(engagement_id, limit=limit)
    return {"data": changes}


@router.delete("/{engagement_id}", status_code=204)
async def archive_engagement(engagement_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    now = datetime.now(timezone.utc)
    await database.db.engagements.update_one(
        {"_id": ObjectId(engagement_id)},
        {"$set": {"is_archived": True, "updated_at": now}},
    )
    await audit_service.log_delete(
        "engagement", existing, current_user,
        label=existing["name"],
        action="archived",
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    # Re-snapshot after archiving
    await _auto_upsert_pipeline_snapshot(existing["leader_id"], existing["fiscal_year"], now, user=current_user)
    return None


@router.patch("/{engagement_id}/remarks", response_model=EngagementResponse)
async def update_remarks(
    engagement_id: str,
    body: RemarksUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)

    now = datetime.now(timezone.utc)
    author = current_user.get("full_name") or current_user.get("email") or "Unknown"
    new_text = body.remarks.strip()
    history = list(existing.get("remarks_history") or [])
    old_remarks = existing.get("remarks", "")

    if body.mode == "add":
        current = (existing.get("remarks") or "").strip()
        if current:
            history.insert(0, {"text": current, "at": now, "by": author})
            history = history[:2]
        remarks = new_text
    else:
        remarks = new_text

    result = await database.db.engagements.find_one_and_update(
        {"_id": ObjectId(engagement_id)},
        {"$set": {"remarks": remarks, "remarks_history": history, "updated_at": now}},
        return_document=True,
    )
    if remarks != old_remarks:
        await audit_service.log_event(
            entity_type="engagement",
            entity_id=engagement_id,
            entity_label=existing["name"],
            action="updated",
            user=current_user,
            changes=[{"field": "remarks", "label": "Remarks", "old": old_remarks, "new": remarks}],
            leader_id=existing["leader_id"],
            fiscal_year=existing["fiscal_year"],
        )
    return _serialize(result)
