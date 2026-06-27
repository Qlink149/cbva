from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.bluesky import BlueSkyEntryUpdate, BlueSkyEntryResponse, BlueSkyListResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "month": doc["month"],
        "sort_order": doc["sort_order"],
        "opening": doc["opening"],
        "additional": doc.get("additional"),
        "converted": doc["converted"],
        "closing": doc["closing"],
        "remarks": doc.get("remarks", ""),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=BlueSkyListResponse)
async def list_bluesky(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.blue_sky_entries.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("sort_order", 1)
    docs = await cursor.to_list(length=20)
    total_additional = sum(d.get("additional") or 0 for d in docs)
    total_converted = sum(d["converted"] for d in docs)
    return {
        "data": [_serialize(d) for d in docs],
        "totals": {"additional": total_additional, "converted": total_converted},
    }


@router.put("/{entry_id}", response_model=BlueSkyEntryResponse)
async def update_bluesky(
    entry_id: str,
    body: BlueSkyEntryUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.blue_sky_entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="BlueSky entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.blue_sky_entries.find_one_and_update(
        {"_id": ObjectId(entry_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)
