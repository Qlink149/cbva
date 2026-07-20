from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime, timezone
from app.schemas.headcount import HeadcountPlanUpsert, HeadcountPlanResponse
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
        "fiscal_year": doc.get("fiscal_year", ""),
        "designation": doc["designation"],
        "board_approved": doc.get("board_approved", 0),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_headcount(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.headcount_plans.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    )
    docs = await cursor.to_list(length=100)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=HeadcountPlanResponse)
async def upsert_headcount(body: HeadcountPlanUpsert, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    if not (body.fiscal_year or "").strip():
        raise HTTPException(status_code=400, detail="fiscal_year is required")
    await assert_fy_editable(body.fiscal_year, current_user)
    now = datetime.now(timezone.utc)
    filt = {
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "designation": body.designation,
    }
    existing = await database.db.headcount_plans.find_one(filt)
    result = await database.db.headcount_plans.find_one_and_update(
        filt,
        {
            "$set": {"board_approved": body.board_approved, "updated_at": now},
            "$setOnInsert": {
                "leader_id": body.leader_id,
                "fiscal_year": body.fiscal_year,
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
            fiscal_year=body.fiscal_year,
        )
    else:
        await audit_service.log_create(
            "headcount", result, current_user,
            label=body.designation,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
    return _serialize(result)
