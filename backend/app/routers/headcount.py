from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from app.schemas.headcount import HeadcountPlanUpsert, HeadcountPlanResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "designation": doc["designation"],
        "board_approved": doc.get("board_approved", 0),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=dict)
async def list_headcount(
    leader_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.headcount_plans.find({"leader_id": leader_id})
    docs = await cursor.to_list(length=100)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=HeadcountPlanResponse)
async def upsert_headcount(body: HeadcountPlanUpsert, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    now = datetime.now(timezone.utc)
    existing = await database.db.headcount_plans.find_one(
        {"leader_id": body.leader_id, "designation": body.designation}
    )
    result = await database.db.headcount_plans.find_one_and_update(
        {"leader_id": body.leader_id, "designation": body.designation},
        {
            "$set": {"board_approved": body.board_approved, "updated_at": now},
            "$setOnInsert": {
                "leader_id": body.leader_id,
                "designation": body.designation,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=True,
    )
    if existing:
        await audit_service.log_update(
            "headcount", existing, {"board_approved": body.board_approved}, current_user,
            label=body.designation,
            leader_id=body.leader_id,
        )
    else:
        await audit_service.log_create(
            "headcount", result, current_user,
            label=body.designation,
            leader_id=body.leader_id,
        )
    return _serialize(result)
