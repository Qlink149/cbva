"""CRUD for Additional Work (separate from Blue Sky Additional)."""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId

from app.schemas.additional_work import (
    AdditionalWorkCreate,
    AdditionalWorkUpdate,
    AdditionalWorkResponse,
)
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable
from app.services.fy_calendar import FY_MONTH_KEYS

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "engagement_id": doc.get("engagement_id"),
        "client_name": doc.get("client_name", ""),
        "month_key": doc.get("month_key", ""),
        "amount": int(doc.get("amount") or 0),
        "notes": doc.get("notes", ""),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


@router.get("/", response_model=dict)
async def list_additional_work(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.additional_work.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort([("month_key", 1), ("client_name", 1)])
    docs = await cursor.to_list(length=500)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=AdditionalWorkResponse, status_code=201)
async def create_additional_work(
    body: AdditionalWorkCreate,
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)
    if body.month_key not in FY_MONTH_KEYS:
        raise HTTPException(status_code=400, detail="Invalid month_key")
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await database.db.additional_work.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "additional_work", doc, current_user,
        label=body.client_name,
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc)


@router.put("/{work_id}", response_model=AdditionalWorkResponse)
async def update_additional_work(
    work_id: str,
    body: AdditionalWorkUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.additional_work.find_one({"_id": ObjectId(work_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Additional work entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "month_key" in updates and updates["month_key"] not in FY_MONTH_KEYS:
        raise HTTPException(status_code=400, detail="Invalid month_key")
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.additional_work.find_one_and_update(
        {"_id": ObjectId(work_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "additional_work", existing, updates, current_user,
        label=existing.get("client_name", ""),
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return _serialize(result)


@router.delete("/{work_id}", status_code=204)
async def delete_additional_work(
    work_id: str,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.additional_work.find_one({"_id": ObjectId(work_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Additional work entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    await database.db.additional_work.delete_one({"_id": ObjectId(work_id)})
    await audit_service.log_delete(
        "additional_work", existing, current_user,
        label=existing.get("client_name", ""),
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return None
