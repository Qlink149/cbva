from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from app.schemas.engagement_action import (
    EngagementActionCreate,
    EngagementActionUpdate,
    EngagementActionStatusPatch,
    EngagementActionResponse,
)
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable

router = APIRouter()


def _coerce_deadline(d: date | datetime | None) -> datetime | None:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)


def _normalize_status(status: str | None) -> str:
    if status == "Done":
        return "Completed"
    return status or "Pending"


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "engagement_id": str(doc["engagement_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "engagement_num": doc["engagement_num"],
        "client_name": doc.get("client_name") or "",
        "description": doc["description"],
        "deadline": doc.get("deadline"),
        "remarks": doc.get("remarks") or "",
        "status": _normalize_status(doc.get("status")),
        "created_by": str(doc["created_by"]),
        "created_by_name": doc.get("created_by_name", ""),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("", include_in_schema=False)
@router.get("/", response_model=dict)
async def list_engagement_actions(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    status: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id, "fiscal_year": fiscal_year}
    if status:
        normalized = _normalize_status(status)
        if normalized == "Completed":
            query["status"] = {"$in": ["Completed", "Done"]}
        else:
            query["status"] = normalized
    cursor = database.db.engagement_actions.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    return {"data": [_serialize(d) for d in docs]}


@router.post("", response_model=EngagementActionResponse, status_code=201, include_in_schema=False)
@router.post("/", response_model=EngagementActionResponse, status_code=201)
async def create_engagement_action(
    body: EngagementActionCreate,
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)

    try:
        engagement_oid = ObjectId(body.engagement_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid engagement")

    engagement = await database.db.engagements.find_one({"_id": engagement_oid})
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    if engagement["leader_id"] != body.leader_id or engagement["fiscal_year"] != body.fiscal_year:
        raise HTTPException(status_code=400, detail="Engagement does not match leader/fiscal year")

    eng_num = body.engagement_num if body.engagement_num is not None else engagement.get("num")
    try:
        eng_num = int(eng_num)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Engagement is missing a valid client number")

    now = datetime.now(timezone.utc)
    doc = {
        "engagement_id": engagement_oid,
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "engagement_num": eng_num,
        "client_name": engagement.get("name") or "",
        "description": body.description.strip(),
        "deadline": _coerce_deadline(body.deadline),
        "remarks": (body.remarks or "").strip()[:500],
        "status": "Pending",
        "created_by": current_user["_id"],
        "created_by_name": current_user.get("full_name") or current_user.get("email") or "Unknown",
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.engagement_actions.insert_one(doc)
    doc["_id"] = result.inserted_id
    try:
        await audit_service.log_create(
            "engagement_action", doc, current_user,
            label=doc["description"],
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
    except Exception:
        # Persist succeeded; do not fail the client if audit write errors
        pass
    return _serialize(doc)


@router.patch("/{action_id}", response_model=EngagementActionResponse)
async def update_engagement_action(
    action_id: str,
    body: EngagementActionUpdate,
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(action_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid action id")
    existing = await database.db.engagement_actions.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Action not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "status" in updates:
        updates["status"] = _normalize_status(updates["status"])
    if "remarks" in updates and updates["remarks"] is not None:
        updates["remarks"] = str(updates["remarks"]).strip()[:500]
    if "description" in updates and updates["description"] is not None:
        updates["description"] = str(updates["description"]).strip()
    if "deadline" in updates:
        updates["deadline"] = _coerce_deadline(updates["deadline"])
    if not updates:
        return _serialize(existing)
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.engagement_actions.find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    try:
        await audit_service.log_update(
            "engagement_action", existing, updates, current_user,
            label=existing["description"],
            leader_id=existing["leader_id"],
            fiscal_year=existing["fiscal_year"],
        )
    except Exception:
        pass
    return _serialize(result)


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
    new_status = _normalize_status(body.status)
    result = await database.db.engagement_actions.find_one_and_update(
        {"_id": ObjectId(action_id)},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    try:
        await audit_service.log_update(
            "engagement_action", existing, {"status": new_status}, current_user,
            label=existing["description"],
            leader_id=existing["leader_id"],
            fiscal_year=existing["fiscal_year"],
            action="status_changed",
        )
    except Exception:
        pass
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
    try:
        await audit_service.log_delete(
            "engagement_action", existing, current_user,
            label=existing["description"],
            leader_id=existing["leader_id"],
            fiscal_year=existing["fiscal_year"],
        )
    except Exception:
        pass
    return None
