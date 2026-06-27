from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.engagement import EngagementCreate, EngagementUpdate, RemarksUpdate, EngagementResponse
from app.services.engagement_service import compute_totals
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.dependencies.pagination import pagination_params

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "num": doc["num"],
        "name": doc["name"],
        "model": doc.get("model", "—"),
        "rel_partner": doc.get("rel_partner", ""),
        "el_status": doc.get("el_status", "—"),
        "green": doc.get("green", 0),
        "amber": doc.get("amber", 0),
        "blue_sky": doc.get("blue_sky", 0),
        "total": doc.get("total", 0),
        "collected": doc.get("collected", 0),
        "may_col": doc.get("may_col"),
        "june_col": doc.get("june_col"),
        "july_col": doc.get("july_col"),
        "august_col": doc.get("august_col"),
        "person_responsible": doc.get("person_responsible"),
        "originator": doc.get("originator"),
        "assignment_type": doc.get("assignment_type"),
        "collections_fy2526": doc.get("collections_fy2526"),
        "balance": doc.get("balance"),
        "remarks": doc.get("remarks", ""),
        "is_archived": doc.get("is_archived", False),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=dict)
async def list_engagements(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    is_archived: bool = Query(False),
    pagination: dict = Depends(pagination_params),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query = {"leader_id": leader_id, "fiscal_year": fiscal_year, "is_archived": is_archived}
    total = await database.db.engagements.count_documents(query)
    cursor = database.db.engagements.find(query).sort("num", 1).skip(pagination["skip"]).limit(pagination["limit"])
    docs = await cursor.to_list(length=pagination["limit"])
    return {"data": [_serialize(d) for d in docs], "total": total, "skip": pagination["skip"], "limit": pagination["limit"]}


@router.post("/", response_model=EngagementResponse, status_code=201)
async def create_engagement(body: EngagementCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    last = await database.db.engagements.find_one(
        {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year},
        sort=[("num", -1)],
    )
    num = (last["num"] + 1) if last else 1
    totals = compute_totals(body.green, body.amber, body.blue_sky, body.collected)
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(),
        "num": num,
        "total": totals["total"],
        "balance": totals["balance"],
        "is_archived": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.engagements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{engagement_id}", response_model=EngagementResponse)
async def update_engagement(
    engagement_id: str,
    body: EngagementUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    green = updates.get("green", existing["green"])
    amber = updates.get("amber", existing["amber"])
    blue_sky = updates.get("blue_sky", existing["blue_sky"])
    collected = updates.get("collected", existing["collected"])
    totals = compute_totals(green, amber, blue_sky, collected)
    updates.update(totals)
    updates["updated_at"] = datetime.now(timezone.utc)

    result = await database.db.engagements.find_one_and_update(
        {"_id": ObjectId(engagement_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)


@router.delete("/{engagement_id}", status_code=204)
async def archive_engagement(engagement_id: str, current_user: dict = Depends(get_current_user)):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.engagements.update_one(
        {"_id": ObjectId(engagement_id)},
        {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc)}},
    )
    return None


@router.patch("/{engagement_id}/remarks", response_model=EngagementResponse)
async def update_remarks(
    engagement_id: str,
    body: RemarksUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.engagements.find_one({"_id": ObjectId(engagement_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Engagement not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    result = await database.db.engagements.find_one_and_update(
        {"_id": ObjectId(engagement_id)},
        {"$set": {"remarks": body.remarks, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return _serialize(result)
