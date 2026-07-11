from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.hiring import HiringRequirementCreate, HiringRequirementUpdate, HiringRequirementResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "role_title": doc["role_title"],
        "level": doc.get("level", "Analyst"),
        "expected_joining_date": doc.get("expected_joining_date"),
        "status": doc.get("status", "Open"),
        "expected_cost": doc.get("expected_cost", 0),
        "remarks": doc.get("remarks", doc.get("notes", "")),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=dict)
async def list_hiring(
    leader_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.hiring_requirements.find({"leader_id": leader_id}).sort("created_at", 1)
    docs = await cursor.to_list(length=100)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=HiringRequirementResponse, status_code=201)
async def create_hiring(body: HiringRequirementCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await database.db.hiring_requirements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{req_id}", response_model=HiringRequirementResponse)
async def update_hiring(
    req_id: str,
    body: HiringRequirementUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.hiring_requirements.find_one({"_id": ObjectId(req_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Hiring requirement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.hiring_requirements.find_one_and_update(
        {"_id": ObjectId(req_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)


@router.delete("/{req_id}", status_code=204)
async def delete_hiring(req_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.hiring_requirements.find_one({"_id": ObjectId(req_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Hiring requirement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.hiring_requirements.delete_one({"_id": ObjectId(req_id)})
    return None
