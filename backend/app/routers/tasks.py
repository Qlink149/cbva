from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.task import TaskCreate, TaskUpdate, TaskStatusPatch, TaskResponse
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "created_by_id": str(doc["created_by_id"]),
        "title": doc["title"],
        "assignee_name": doc.get("assignee_name", ""),
        "client_name": doc.get("client_name", ""),
        "priority": doc.get("priority", "Medium"),
        "deadline": doc.get("deadline"),
        "notes": doc.get("notes", ""),
        "status": doc.get("status", "Pending"),
        "fiscal_year": doc.get("fiscal_year"),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_tasks(
    leader_id: str = Query(...),
    fiscal_year: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id}
    if fiscal_year:
        query["$or"] = [{"fiscal_year": fiscal_year}, {"fiscal_year": None}, {"fiscal_year": {"$exists": False}}]
    cursor = database.db.tasks.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreate, current_user: dict = Depends(get_current_user)):
    leader_id = current_user.get("leader_id")
    if not leader_id:
        raise HTTPException(status_code=400, detail="User has no associated leader")
    enforce_leader_write_scope(current_user, leader_id)
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(),
        "leader_id": leader_id,
        "created_by_id": current_user["_id"],
        "status": "Pending",
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.tasks.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "task", doc, current_user,
        label=doc["title"],
        leader_id=leader_id,
    )
    return _serialize(doc)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "task", existing, updates, current_user,
        label=existing["title"],
        leader_id=existing["leader_id"],
    )
    return _serialize(result)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.tasks.delete_one({"_id": ObjectId(task_id)})
    await audit_service.log_delete(
        "task", existing, current_user,
        label=existing["title"],
        leader_id=existing["leader_id"],
    )
    return None


@router.patch("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: str,
    body: TaskStatusPatch,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.tasks.find_one({"_id": ObjectId(task_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    result = await database.db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await audit_service.log_update(
        "task", existing, {"status": body.status}, current_user,
        label=existing["title"],
        leader_id=existing["leader_id"],
        action="status_changed",
    )
    return _serialize(result)
