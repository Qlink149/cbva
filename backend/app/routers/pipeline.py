from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.pipeline import PipelineSnapshotCreate, PipelineSnapshotUpdate, PipelineSnapshotResponse
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope, require_roles
from app.services.engagement_derivation import materialize_leader_derived_data
from app.services import audit_service

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "label": doc["label"],
        "sort_order": doc["sort_order"],
        "green": doc["green"],
        "amber": doc.get("amber"),
        "blue_sky": doc.get("blue_sky"),
        "total": doc["total"],
        "snapshot_type": doc.get("snapshot_type"),
        "as_of_date": doc.get("as_of_date"),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_snapshots(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    # Refresh: initial/board/past months from consolidated; current month from engagements.
    await materialize_leader_derived_data(leader_id, fiscal_year)
    docs = await database.db.pipeline_snapshots.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("sort_order", 1).to_list(length=50)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", response_model=PipelineSnapshotResponse, status_code=201)
async def create_snapshot(body: PipelineSnapshotCreate, current_user: dict = Depends(get_current_user)):
    enforce_leader_write_scope(current_user, body.leader_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await database.db.pipeline_snapshots.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "pipeline_snapshot", doc, current_user,
        label=doc["label"],
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc)


@router.put("/{snapshot_id}", response_model=PipelineSnapshotResponse)
async def update_snapshot(
    snapshot_id: str,
    body: PipelineSnapshotUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.pipeline_snapshots.find_one({"_id": ObjectId(snapshot_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.pipeline_snapshots.find_one_and_update(
        {"_id": ObjectId(snapshot_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "pipeline_snapshot", existing, updates, current_user,
        label=existing["label"],
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return _serialize(result)


@router.delete("/{snapshot_id}", status_code=204)
async def delete_snapshot(snapshot_id: str, current_user: dict = Depends(require_roles("admin", "management"))):
    existing = await database.db.pipeline_snapshots.find_one({"_id": ObjectId(snapshot_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await database.db.pipeline_snapshots.delete_one({"_id": ObjectId(snapshot_id)})
    await audit_service.log_delete(
        "pipeline_snapshot", existing, current_user,
        label=existing["label"],
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return None
