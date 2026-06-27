from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.el_summary import ELSummaryUpdate, ELSummaryResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


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
    if not doc:
        raise HTTPException(status_code=404, detail="EL summary not found")
    return _serialize(doc)


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
    return _serialize(result)
