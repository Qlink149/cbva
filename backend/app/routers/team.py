from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.team import TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "full_name": doc["full_name"],
        "designation": doc.get("designation", ""),
        "email": doc.get("email", ""),
        "annual_cost": doc.get("annual_cost", 0),
        "joining_date": doc.get("joining_date"),
        "status": doc.get("status", "Active"),
        "notes": doc.get("notes", ""),
        "fiscal_year": doc.get("fiscal_year"),
        "is_manager": doc.get("is_manager", False),
        "is_leader": doc.get("is_leader", False),
        "sort_order": doc.get("sort_order", 0),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=dict)
async def list_team(
    leader_id: str = Query(...),
    managers_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id}
    if managers_only:
        query["is_manager"] = True
    cursor = database.db.team_members.find(query).sort([("sort_order", 1), ("full_name", 1)])
    docs = await cursor.to_list(length=200)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=TeamMemberResponse, status_code=201)
async def create_member(body: TeamMemberCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await database.db.team_members.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{member_id}", response_model=TeamMemberResponse)
async def update_member(
    member_id: str,
    body: TeamMemberUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.team_members.find_one({"_id": ObjectId(member_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Team member not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.team_members.find_one_and_update(
        {"_id": ObjectId(member_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)


@router.delete("/{member_id}", status_code=204)
async def delete_member(member_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.team_members.find_one({"_id": ObjectId(member_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Team member not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.team_members.delete_one({"_id": ObjectId(member_id)})
    return None
