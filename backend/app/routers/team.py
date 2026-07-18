from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.team import TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service

router = APIRouter()

MAX_REPORTS_DEPTH = 10


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
        "reports_to_member_id": doc.get("reports_to_member_id"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def _validate_reports_to(
    leader_id: str,
    member_id: str | None,
    reports_to_member_id: str | None,
) -> None:
    if not reports_to_member_id:
        return
    if member_id and reports_to_member_id == member_id:
        raise HTTPException(status_code=400, detail="A member cannot report to themselves")

    try:
        parent_oid = ObjectId(reports_to_member_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reports_to_member_id")

    parent = await database.db.team_members.find_one({"_id": parent_oid})
    if not parent:
        raise HTTPException(status_code=400, detail="Reports-to member not found")
    if parent.get("leader_id") != leader_id:
        raise HTTPException(status_code=400, detail="Reports-to member must belong to the same leader")

    if not member_id:
        return

    visited = {member_id}
    current_id = reports_to_member_id
    for _ in range(MAX_REPORTS_DEPTH):
        if current_id in visited:
            raise HTTPException(status_code=400, detail="Reporting hierarchy would create a cycle")
        visited.add(current_id)
        current = await database.db.team_members.find_one({"_id": ObjectId(current_id)})
        if not current:
            break
        next_id = current.get("reports_to_member_id")
        if not next_id:
            break
        current_id = next_id
    else:
        raise HTTPException(status_code=400, detail="Reporting hierarchy exceeds maximum depth")


@router.get("/", response_model=dict)
async def list_team(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    managers_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id, "fiscal_year": fiscal_year}
    if managers_only:
        query["is_manager"] = True
    cursor = database.db.team_members.find(query).sort([("sort_order", 1), ("full_name", 1)])
    docs = await cursor.to_list(length=200)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=TeamMemberResponse, status_code=201)
async def create_member(body: TeamMemberCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    if not (body.fiscal_year or "").strip():
        raise HTTPException(status_code=400, detail="fiscal_year is required")
    await _validate_reports_to(body.leader_id, None, body.reports_to_member_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await database.db.team_members.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "team_member", doc, current_user,
        label=doc["full_name"],
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
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
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "reports_to_member_id" in body.model_dump(exclude_unset=True):
        reports_to = body.reports_to_member_id
        await _validate_reports_to(existing["leader_id"], member_id, reports_to)
        updates["reports_to_member_id"] = reports_to
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.team_members.find_one_and_update(
        {"_id": ObjectId(member_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "team_member", existing, updates, current_user,
        label=existing["full_name"],
        leader_id=existing["leader_id"],
    )
    return _serialize(result)


@router.delete("/{member_id}", status_code=204)
async def delete_member(member_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.team_members.find_one({"_id": ObjectId(member_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Team member not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.team_members.delete_one({"_id": ObjectId(member_id)})
    await audit_service.log_delete(
        "team_member", existing, current_user,
        label=existing["full_name"],
        leader_id=existing["leader_id"],
    )
    return None
