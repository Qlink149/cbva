from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.baseline import BaselinePlanCreate, BaselinePlanUpdate, BaselinePlanResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "financial_year_id": doc["financial_year_id"],
        "baseline_green": doc.get("baseline_green", 0),
        "baseline_amber": doc.get("baseline_amber", 0),
        "baseline_blue_sky": doc.get("baseline_blue_sky", 0),
        "baseline_total": doc.get("baseline_total", 0),
        "is_locked": doc.get("is_locked", False),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=dict)
async def list_baselines(
    leader_id: str = Query(None),
    financial_year_id: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    query: dict = {}
    if leader_id:
        enforce_leader_scope(current_user, leader_id)
        query["leader_id"] = leader_id
    if financial_year_id:
        query["financial_year_id"] = financial_year_id
    docs = await database.db.baseline_plans.find(query).to_list(length=50)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=BaselinePlanResponse, status_code=201)
async def create_baseline(body: BaselinePlanCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await database.db.baseline_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{baseline_id}", response_model=BaselinePlanResponse)
async def update_baseline(
    baseline_id: str,
    body: BaselinePlanUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.baseline_plans.find_one({"_id": ObjectId(baseline_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Baseline plan not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.baseline_plans.find_one_and_update(
        {"_id": ObjectId(baseline_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)
