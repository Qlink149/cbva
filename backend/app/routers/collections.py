from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime, timezone
from bson import ObjectId
from app.schemas.collection import (
    CollectionPlanSet, CollectionEntryUpdate,
    MonthCollectionResponse, CollectionListResponse,
)
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services.fy_calendar import (
    get_fy_month_calendar_year,
    get_available_fy_month_keys,
    is_fy_month_elapsed,
)
from app.services.engagement_derivation import planned_by_month_from_engagements
from app.services import audit_service

router = APIRouter()

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]
MONTH_FULL_NAMES = {
    "04": "April",   "05": "May",      "06": "June",     "07": "July",
    "08": "August",  "09": "September","10": "October",  "11": "November",
    "12": "December","01": "January",  "02": "February", "03": "March",
}


def _month_label(month_key: str, fiscal_year: str) -> str:
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    return f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"


def _key_from_entry_month(month_str: str) -> str | None:
    """Convert a legacy collection_entries month string like 'April 2025' to '04'."""
    for key, name in MONTH_FULL_NAMES.items():
        if month_str.startswith(name):
            return key
    return None


@router.get("/", response_model=CollectionListResponse)
async def list_collections(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)

    as_of = date.today()
    allowed_month_keys = get_available_fy_month_keys(fiscal_year, as_of)

    # Planned targets from collection_entries, falling back to engagement monthly_plan
    entry_docs = await database.db.collection_entries.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).to_list(20)
    entry_by_key: dict = {}
    for doc in entry_docs:
        mk = _key_from_entry_month(doc.get("month", ""))
        if mk and mk in allowed_month_keys:
            entry_by_key[mk] = doc

    engagement_planned = await planned_by_month_from_engagements(leader_id, fiscal_year)

    # Actual collections from collection_transactions
    tx_docs = await database.db.collection_transactions.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("created_at", 1).to_list(500)
    tx_by_month: dict = {}
    for tx in tx_docs:
        if tx.get("month") in allowed_month_keys:
            tx_by_month.setdefault(tx["month"], []).append(tx)

    data = []
    total_collected = 0
    for i, mk in enumerate(allowed_month_keys):
        entry = entry_by_key.get(mk)
        planned = entry.get("planned", 0) if entry else engagement_planned.get(mk, 0)
        txs = tx_by_month.get(mk, [])
        tx_sum = sum(tx["amount_collected"] for tx in txs)
        # Use transaction sum when present; fall back to manually stored collected value
        actual = tx_sum if tx_sum > 0 else (entry.get("collected", 0) if entry else 0)
        total_collected += actual

        data.append(MonthCollectionResponse(
            month_key=mk,
            month_label=_month_label(mk, fiscal_year),
            sort_order=i + 1,
            planned=planned,
            actual=actual,
            variance=actual - planned,
            remarks=entry.get("remarks", "") if entry else "",
            entry_id=str(entry["_id"]) if entry else None,
            transactions=[
                {
                    "id": str(tx["_id"]),
                    "engagement_id": tx["engagement_id"],
                    "client_name": tx["client_name"],
                    "amount_billed": tx.get("amount_billed", 0),
                    "amount_collected": tx["amount_collected"],
                    "created_at": serialize_datetime(tx["created_at"]),
                }
                for tx in txs
            ],
        ))

    return CollectionListResponse(data=data, total_collected=total_collected)


@router.post("/", response_model=dict, status_code=200)
async def set_monthly_plan(
    body: CollectionPlanSet,
    current_user: dict = Depends(get_current_user),
):
    """Upsert the planned (target) amount for a month. Creates the row if it doesn't exist."""
    enforce_leader_write_scope(current_user, body.leader_id)

    as_of = date.today()
    if not is_fy_month_elapsed(body.month_key, body.fiscal_year, as_of):
        raise HTTPException(status_code=400, detail="Cannot set plan for a future/unavailable month")

    month_label = _month_label(body.month_key, body.fiscal_year)
    sort_order = FY_MONTH_KEYS.index(body.month_key) + 1 if body.month_key in FY_MONTH_KEYS else 0
    now = datetime.now(timezone.utc)

    existing = await database.db.collection_entries.find_one(
        {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year, "month": month_label}
    )

    if existing:
        collected = existing.get("collected", 0)
        updates = {
            "planned": body.planned,
            "variance": collected - body.planned,
            "updated_at": now,
        }
        if body.remarks is not None:
            updates["remarks"] = body.remarks
        await database.db.collection_entries.update_one(
            {"_id": existing["_id"]},
            {"$set": updates},
        )
        await audit_service.log_update(
            "collection", existing, updates, current_user,
            label=month_label,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
        return {"entry_id": str(existing["_id"]), "month_key": body.month_key, "planned": body.planned}
    else:
        doc = {
            "leader_id": body.leader_id,
            "fiscal_year": body.fiscal_year,
            "month": month_label,
            "sort_order": sort_order,
            "planned": body.planned,
            "collected": 0,
            "outstanding": None,
            "variance": -body.planned,
            "remarks": body.remarks or "",
            "created_at": now,
            "updated_at": now,
        }
        result = await database.db.collection_entries.insert_one(doc)
        doc["_id"] = result.inserted_id
        await audit_service.log_create(
            "collection", doc, current_user,
            label=month_label,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
        return {"entry_id": str(result.inserted_id), "month_key": body.month_key, "planned": body.planned}


@router.put("/{entry_id}", response_model=dict)
async def update_collection_entry(
    entry_id: str,
    body: CollectionEntryUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.collection_entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Collection entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])

    updates: dict = {}
    planned = body.planned if body.planned is not None else existing.get("planned", 0)
    collected = body.collected if body.collected is not None else existing.get("collected", 0)

    if body.planned is not None:
        updates["planned"] = planned
    if body.collected is not None:
        updates["collected"] = collected
    if body.remarks is not None:
        updates["remarks"] = body.remarks
    if updates:
        if "planned" in updates or "collected" in updates:
            updates["variance"] = collected - planned
        updates["updated_at"] = datetime.now(timezone.utc)
        await database.db.collection_entries.update_one({"_id": ObjectId(entry_id)}, {"$set": updates})
        await audit_service.log_update(
            "collection", existing, updates, current_user,
            label=existing.get("month", entry_id),
            leader_id=existing["leader_id"],
            fiscal_year=existing.get("fiscal_year"),
        )

    return {
        "entry_id": entry_id,
        "updated": True,
        "planned": planned,
        "collected": collected,
        "remarks": updates.get("remarks", existing.get("remarks", "")),
        "variance": collected - planned,
    }
