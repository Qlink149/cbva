from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.engagement_action import (
    EngagementActionCreate,
    EngagementActionStatusPatch,
    EngagementActionResponse,
)
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "engagement_id": str(doc["engagement_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "engagement_num": doc["engagement_num"],
        "description": doc["description"],
        "deadline": doc.get("deadline"),
        "status": doc.get("status", "Pending"),
        "created_by": str(doc["created_by"]),
        "created_by_name": doc.get("created_by_name", ""),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_engagement_actions(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.engagement_actions.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=EngagementActionResponse, status_code=201)
async def create_engagement_action(
    body: EngagementActionCreate,
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)

    engagement = await database.db.engagements.find_one({"_id": ObjectId(body.engagement_id)})
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    if engagement["leader_id"] != body.leader_id or engagement["fiscal_year"] != body.fiscal_year:
        raise HTTPException(status_code=400, detail="Engagement does not match leader/fiscal year")

    now = datetime.now(timezone.utc)
    doc = {
        "engagement_id": ObjectId(body.engagement_id),
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "engagement_num": body.engagement_num,
        "description": body.description.strip(),
        "deadline": body.deadline,
        "status": "Pending",
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name") or current_user.get("email") or "Unknown",
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.engagement_actions.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "engagement_action", doc, current_user,
        label=doc["description"],
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc)


@router.patch("/{action_id}/status", response_model=EngagementActionResponse)
async def update_engagement_action_status(
    action_id: str,
    body: EngagementActionStatusPatch,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagement_actions.find_one({"_id": ObjectId(action_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Action not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    result = await database.db.engagement_actions.find_one_and_update(
        {"_id": ObjectId(action_id)},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await audit_service.log_update(
        "engagement_action", existing, {"status": body.status}, current_user,
        label=existing["description"],
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
        action="status_changed",
    )
    return _serialize(result)


@router.delete("/{action_id}", status_code=204)
async def delete_engagement_action(
    action_id: str,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagement_actions.find_one({"_id": ObjectId(action_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Action not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    await database.db.engagement_actions.delete_one({"_id": ObjectId(action_id)})
    await audit_service.log_delete(
        "engagement_action", existing, current_user,
        label=existing["description"],
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return None
