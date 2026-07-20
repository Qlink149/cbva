from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.action import ActionCreate, ActionUpdate, ActionStatusPatch, ActionResponse
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "num": doc["num"],
        "category": doc.get("category", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "Not Started"),
        "notes": doc.get("notes", ""),
        "remarks": doc.get("remarks", ""),
        "due_date": doc.get("due_date"),
        "forum": doc.get("forum"),
        "responsibility": doc.get("responsibility"),
        "date_raised": doc.get("date_raised"),
        "expected_completion": doc.get("expected_completion"),
        "cross_ref_risks": doc.get("cross_ref_risks"),
        "cross_ref_issues": doc.get("cross_ref_issues"),
        "cross_ref_decisions": doc.get("cross_ref_decisions"),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_actions(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.actions.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("num", 1)
    docs = await cursor.to_list(length=100)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=ActionResponse, status_code=201)
async def create_action(body: ActionCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)
    if not (body.description or "").strip():
        raise HTTPException(status_code=400, detail="Description is required")

    now = datetime.now(timezone.utc)
    last = await database.db.actions.find_one(
        {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year},
        sort=[("num", -1)],
    )
    next_num = (last.get("num") or 0) + 1 if last else 1

    doc = {
        **body.model_dump(exclude={"source"}),
        "num": next_num,
        "created_at": now,
        "updated_at": now,
    }
    if body.source is not None:
        doc["source"] = body.source.model_dump()

    result = await database.db.actions.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "action", doc, current_user,
        label=f"#{next_num} {doc.get('description', '')}".strip(),
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc)


@router.put("/{action_id}", response_model=ActionResponse)
async def update_action(
    action_id: str,
    body: ActionUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.actions.find_one({"_id": ObjectId(action_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Action not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.actions.find_one_and_update(
        {"_id": ObjectId(action_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "action", existing, updates, current_user,
        label=f"#{existing.get('num', '')} {existing.get('description', '')}".strip(),
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return _serialize(result)


@router.patch("/{action_id}/status", response_model=ActionResponse)
async def update_action_status(
    action_id: str,
    body: ActionStatusPatch,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.actions.find_one({"_id": ObjectId(action_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Action not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    updates = {"status": body.status, "updated_at": datetime.now(timezone.utc)}
    result = await database.db.actions.find_one_and_update(
        {"_id": ObjectId(action_id)},
        {"$set": updates},
        return_document=True,
    )
    await audit_service.log_update(
        "action", existing, updates, current_user,
        label=f"#{existing.get('num', '')} {existing.get('description', '')}".strip(),
        action="status_changed",
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return _serialize(result)
