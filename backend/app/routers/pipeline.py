from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.schemas.pipeline import (
    PipelineSnapshotCreate,
    PipelineSnapshotUpdate,
    PipelineSnapshotResponse,
    FyActualUpsert,
)
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


def _fy_actual_label(slug: str) -> str:
    if slug and len(slug) == 4:
        return f"FY {slug[:2]}-{slug[2:]}"
    return f"FY {slug}" if slug else "FY"


def _prior_fy_slugs(slug: str, count: int = 2) -> list[str]:
    """Return older FYs first, e.g. 2627 → ['2425', '2526']."""
    if not slug or len(slug) != 4:
        return []
    out: list[str] = []
    cur = slug
    for _ in range(count):
        try:
            start = int(cur[:2])
            end = int(cur[2:])
        except ValueError:
            break
        prev = f"{start - 1:02d}{end - 1:02d}"
        out.append(prev)
        cur = prev
    return list(reversed(out))


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


@router.get("/fy-actuals")
async def list_fy_actuals(
    leader_id: str = Query(...),
    fiscal_year: str = Query(..., description="Viewing FY — returns prior two years' fy_actual rows"),
    current_user: dict = Depends(get_current_user),
):
    """Prior-year actual totals for Monthly Plan Evolution (DB-backed, not consolidated)."""
    enforce_leader_scope(current_user, leader_id)
    years = _prior_fy_slugs(fiscal_year, 2)
    docs = await database.db.pipeline_snapshots.find(
        {
            "leader_id": leader_id,
            "fiscal_year": {"$in": years},
            "snapshot_type": "fy_actual",
        }
    ).to_list(length=10)
    by_year = {d["fiscal_year"]: d for d in docs}

    rows = []
    for i, y in enumerate(years):
        doc = by_year.get(y)
        if doc:
            rows.append(_serialize(doc))
        else:
            rows.append(
                {
                    "id": None,
                    "leader_id": leader_id,
                    "fiscal_year": y,
                    "label": _fy_actual_label(y),
                    "sort_order": i,
                    "green": None,
                    "amber": None,
                    "blue_sky": None,
                    "total": None,
                    "snapshot_type": "fy_actual",
                    "as_of_date": None,
                    "created_at": None,
                    "updated_at": None,
                }
            )
    return {"data": rows, "years": years}


@router.put("/fy-actuals")
async def upsert_fy_actual(
    body: FyActualUpsert,
    current_user: dict = Depends(get_current_user),
):
    """Save a prior-year actual total (editable from the leader dashboard)."""
    enforce_leader_write_scope(current_user, body.leader_id)
    if not body.fiscal_year or len(body.fiscal_year) != 4:
        raise HTTPException(status_code=400, detail="fiscal_year must be a 4-char slug like 2425")

    now = datetime.now(timezone.utc)
    label = _fy_actual_label(body.fiscal_year)
    green = body.green if body.green is not None else 0
    amber = body.amber if body.amber is not None else 0
    blue_sky = body.blue_sky if body.blue_sky is not None else 0
    total = green + amber + blue_sky

    existing = await database.db.pipeline_snapshots.find_one(
        {
            "leader_id": body.leader_id,
            "fiscal_year": body.fiscal_year,
            "snapshot_type": "fy_actual",
        }
    )
    updates = {
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "label": label,
        "sort_order": 0,
        "green": green,
        "amber": amber,
        "blue_sky": blue_sky,
        "total": total,
        "snapshot_type": "fy_actual",
        "source": "manual",
        "updated_at": now,
    }
    # Unique index is (leader_id, fiscal_year, label) — keep label stable
    result = await database.db.pipeline_snapshots.find_one_and_update(
        {
            "leader_id": body.leader_id,
            "fiscal_year": body.fiscal_year,
            "snapshot_type": "fy_actual",
        },
        {"$set": updates, "$setOnInsert": {"created_at": now, "as_of_date": None}},
        upsert=True,
        return_document=True,
    )
    if existing:
        await audit_service.log_update(
            "pipeline_snapshot", existing, updates, current_user,
            label=label,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
    else:
        await audit_service.log_create(
            "pipeline_snapshot", result, current_user,
            label=label,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
    return _serialize(result)


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
