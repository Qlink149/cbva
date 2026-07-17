import csv
import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.dependencies.auth import get_current_user, enforce_leader_scope
from app.schemas.audit import AuditLogListResponse
from app.services import audit_service
from app.core import database
from bson import ObjectId

router = APIRouter()

ADMIN_ONLY_TYPES = frozenset({"user", "auth", "settings"})
LEADER_EXCLUDED_TYPES = frozenset({"user", "auth", "settings"})
MANAGEMENT_EXCLUDED_TYPES = frozenset({"user", "settings"})

ENTITY_COLLECTIONS: dict[str, tuple[str, str | None]] = {
    "engagement": ("engagements", "leader_id"),
    "action": ("actions", "leader_id"),
    "task": ("tasks", "leader_id"),
    "team_member": ("team_members", "leader_id"),
    "hiring": ("hiring_requirements", "leader_id"),
    "collection": ("collection_entries", "leader_id"),
    "collection_transaction": ("collection_transactions", "leader_id"),
    "client_meeting": ("client_meetings", "leader_id"),
    "engagement_action": ("engagement_actions", "leader_id"),
    "pipeline_snapshot": ("pipeline_snapshots", "leader_id"),
    "bluesky_entry": ("blue_sky_entries", "leader_id"),
    "baseline": ("baseline_plans", "leader_id"),
    "el_summary": ("el_summaries", "leader_id"),
    "headcount": ("headcount_plans", "leader_id"),
    "leader": ("leaders", None),
}


def _apply_role_filters(current_user: dict, filters: dict) -> dict:
    role = current_user.get("role")
    if role == "user":
        filters["leader_id"] = current_user.get("leader_id")
        filters["entity_type_nin"] = list(LEADER_EXCLUDED_TYPES)
    elif role == "management":
        filters["entity_type_nin"] = list(MANAGEMENT_EXCLUDED_TYPES)
    return filters


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _entity_leader_id(entity_type: str, entity_id: str) -> str | None:
    mapping = ENTITY_COLLECTIONS.get(entity_type)
    if not mapping:
        return None
    collection_name, leader_field = mapping
    if leader_field is None:
        return entity_id if entity_type == "leader" else None
    try:
        doc = await database.db[collection_name].find_one({"_id": ObjectId(entity_id)})
    except Exception:
        doc = await database.db[collection_name].find_one({"_id": entity_id})
    if not doc:
        return None
    return doc.get(leader_field)


def _build_filters(
    *,
    entity_type: str | None,
    entity_id: str | None,
    actor_id: str | None,
    action: str | None,
    source: str | None,
    leader_id: str | None,
    fiscal_year: str | None,
    date_from: str | None,
    date_to: str | None,
    q: str | None,
) -> dict[str, Any]:
    return {
        k: v
        for k, v in {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor_id": actor_id,
            "action": action,
            "source": source,
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "date_from": _parse_date(date_from),
            "date_to": _parse_date(date_to),
            "q": q,
        }.items()
        if v is not None
    }


def _csv_rows(entries: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for entry in entries:
        changes = entry.get("changes") or []
        if not changes:
            rows.append(
                {
                    "timestamp": entry.get("created_at"),
                    "actor": entry.get("actor_name"),
                    "role": entry.get("actor_role"),
                    "action": entry.get("action"),
                    "module": entry.get("entity_type"),
                    "record": entry.get("entity_label"),
                    "field": "",
                    "old": "",
                    "new": "",
                    "derived": "",
                    "source": entry.get("source"),
                }
            )
            continue
        for change in changes:
            rows.append(
                {
                    "timestamp": entry.get("created_at"),
                    "actor": entry.get("actor_name"),
                    "role": entry.get("actor_role"),
                    "action": entry.get("action"),
                    "module": entry.get("entity_type"),
                    "record": entry.get("entity_label"),
                    "field": change.get("label") or change.get("field"),
                    "old": change.get("old"),
                    "new": change.get("new"),
                    "derived": change.get("derived", False),
                    "source": entry.get("source"),
                }
            )
    return rows


@router.get("/", response_model=AuditLogListResponse)
async def list_audit_log(
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_id: str | None = None,
    action: str | None = None,
    source: str | None = None,
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    q: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    filters = _build_filters(
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        action=action,
        source=source,
        leader_id=leader_id,
        fiscal_year=fiscal_year,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    filters = _apply_role_filters(current_user, filters)
    data, total = await audit_service.list_audit(filters, skip, limit)
    return {"data": data, "total": total, "skip": skip, "limit": limit}


@router.get("/entity/{entity_type}/{entity_id}", response_model=AuditLogListResponse)
async def get_entity_history(
    entity_type: str,
    entity_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") == "user":
        if entity_type in LEADER_EXCLUDED_TYPES:
            raise HTTPException(status_code=403, detail="Access denied")
        record_leader = await _entity_leader_id(entity_type, entity_id)
        if record_leader:
            enforce_leader_scope(current_user, record_leader)
    elif current_user.get("role") == "management" and entity_type in MANAGEMENT_EXCLUDED_TYPES:
        raise HTTPException(status_code=403, detail="Access denied")

    filters = {"entity_type": entity_type, "entity_id": entity_id}
    filters = _apply_role_filters(current_user, filters)
    data, total = await audit_service.list_audit(filters, skip, limit)
    return {"data": data, "total": total, "skip": skip, "limit": limit}


@router.get("/export")
async def export_audit_log(
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_id: str | None = None,
    action: str | None = None,
    source: str | None = None,
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    q: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    filters = _build_filters(
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        action=action,
        source=source,
        leader_id=leader_id,
        fiscal_year=fiscal_year,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    filters = _apply_role_filters(current_user, filters)
    data, _ = await audit_service.list_audit(filters, skip=0, limit=10000)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "timestamp", "actor", "role", "action", "module",
            "record", "field", "old", "new", "derived", "source",
        ],
    )
    writer.writeheader()
    for row in _csv_rows(data):
        ts = row["timestamp"]
        if hasattr(ts, "isoformat"):
            row["timestamp"] = ts.isoformat()
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-log.csv"'},
    )
