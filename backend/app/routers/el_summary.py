from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.el_summary import ELSummaryUpdate, ELSummaryResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service

router = APIRouter()

# Months April→June in FY order (for received_till_X fields)
_TILL_APR = ["04"]
_TILL_MAY = ["04", "05"]
_TILL_JUN = ["04", "05", "06"]


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "el_signed": doc.get("el_signed"),
        "el_not_signed": doc.get("el_not_signed"),
        "received_till_apr": doc.get("received_till_apr"),
        "received_till_apr_2026": doc.get("received_till_apr_2026"),
        "received_till_may": doc.get("received_till_may"),
        "received_till_jun9": doc.get("received_till_jun9"),
        "to_receive_may": doc.get("to_receive_may"),
        "to_receive_june": doc.get("to_receive_june"),
        "to_receive_july": doc.get("to_receive_july"),
        "total_till_june": doc.get("total_till_june"),
        "pct_collected": doc.get("pct_collected"),
        "amber_el_signed": doc.get("amber_el_signed"),
        "amber_el_not_signed": doc.get("amber_el_not_signed"),
        "amber_received": doc.get("amber_received"),
        "updated_at": doc.get("updated_at"),
    }


async def _compute_live(leader_id: str, fiscal_year: str) -> dict:
    """Compute EL summary fields live from engagements + collection_transactions."""
    agg = await database.db.engagements.aggregate([
        {"$match": {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": False}},
        {"$group": {
            "_id": None,
            "el_signed": {"$sum": {"$cond": [{"$eq": ["$el_status", "Signed"]}, 1, 0]}},
            "el_not_signed": {"$sum": {"$cond": [{"$eq": ["$el_status", "Not Signed"]}, 1, 0]}},
            "amber_el_signed": {"$sum": {"$cond": [
                {"$and": [{"$eq": ["$el_status", "Signed"]}, {"$gt": ["$amber", 0]}]}, 1, 0
            ]}},
            "amber_el_not_signed": {"$sum": {"$cond": [
                {"$and": [{"$eq": ["$el_status", "Not Signed"]}, {"$gt": ["$amber", 0]}]}, 1, 0
            ]}},
            "total_collected": {"$sum": "$collected"},
            "total_pipeline": {"$sum": "$total"},
            "amber_collected": {"$sum": {"$cond": [{"$gt": ["$amber", 0]}, "$collected", 0]}},
        }},
    ]).to_list(1)

    live = agg[0] if agg else {}
    total_collected = live.get("total_collected", 0)
    total_pipeline = live.get("total_pipeline", 0)
    pct_collected = round(total_collected / total_pipeline * 100, 1) if total_pipeline > 0 else 0.0

    # received_till_X from collection_transactions
    tx_agg = await database.db.collection_transactions.aggregate([
        {"$match": {"leader_id": leader_id, "fiscal_year": fiscal_year}},
        {"$group": {"_id": "$month", "total": {"$sum": "$amount_collected"}}},
    ]).to_list(12)
    tx_by_month = {row["_id"]: row["total"] for row in tx_agg}

    received_till_apr = sum(tx_by_month.get(m, 0) for m in _TILL_APR)
    received_till_may = sum(tx_by_month.get(m, 0) for m in _TILL_MAY)
    received_till_jun = sum(tx_by_month.get(m, 0) for m in _TILL_JUN)

    return {
        "el_signed": live.get("el_signed", 0),
        "el_not_signed": live.get("el_not_signed", 0),
        "amber_el_signed": live.get("amber_el_signed", 0),
        "amber_el_not_signed": live.get("amber_el_not_signed", 0),
        "amber_received": live.get("amber_collected", 0),
        "received_till_apr": received_till_apr,
        "received_till_may": received_till_may,
        "received_till_jun9": received_till_jun,
        "total_till_june": received_till_jun,
        "pct_collected": pct_collected,
    }


@router.get("/", response_model=ELSummaryResponse)
async def get_el_summary(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)

    doc = await database.db.el_summaries.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    )
    live = await _compute_live(leader_id, fiscal_year)

    if not doc:
        # No stored doc — return fully computed values with a synthetic id
        return {
            "id": "computed",
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "received_till_apr_2026": None,
            "to_receive_may": None,
            "to_receive_june": None,
            "to_receive_july": None,
            "updated_at": None,
            **live,
        }

    # Merge: computed values override stored; manual forward-looking fields stay from doc
    merged = _serialize(doc)
    merged.update(live)
    return merged


@router.put("/{summary_id}", response_model=ELSummaryResponse)
async def update_el_summary(
    summary_id: str,
    body: ELSummaryUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.el_summaries.find_one({"_id": ObjectId(summary_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="EL summary not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.el_summaries.find_one_and_update(
        {"_id": ObjectId(summary_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "el_summary", existing, updates, current_user,
        label=f"{existing['leader_id']} — {existing['fiscal_year']}",
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    live = await _compute_live(existing["leader_id"], existing["fiscal_year"])
    merged = _serialize(result)
    merged.update(live)
    return merged
