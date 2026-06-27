from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.collection import CollectionEntryUpdate, CollectionEntryResponse, CollectionListResponse
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
        "planned": doc["planned"],
        "collected": doc["collected"],
        "outstanding": doc.get("outstanding"),
        "variance": doc["variance"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/", response_model=CollectionListResponse)
async def list_collections(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.collection_entries.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("sort_order", 1)
    docs = await cursor.to_list(length=20)
    total_collected = sum(d["collected"] for d in docs)
    return {"data": [_serialize(d) for d in docs], "total_collected": total_collected}


@router.put("/{entry_id}", response_model=CollectionEntryResponse)
async def update_collection(
    entry_id: str,
    body: CollectionEntryUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.collection_entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Collection entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    planned = updates.get("planned", existing["planned"])
    collected = updates.get("collected", existing["collected"])
    updates["variance"] = collected - planned
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.collection_entries.find_one_and_update(
        {"_id": ObjectId(entry_id)}, {"$set": updates}, return_document=True
    )
    return _serialize(result)
