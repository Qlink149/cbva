from __future__ import annotations

from contextvars import ContextVar
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from loguru import logger

from app.core import database

REDACTED_FIELDS = frozenset({"password", "password_hash", "refresh_token_hashes"})
REDACTED_VALUE = "•••"
DEFAULT_SKIP = frozenset({"updated_at", "created_at", "_id"})

request_id_ctx: ContextVar[str | None] = ContextVar("audit_request_id", default=None)


def _actor_name(user: dict) -> str:
    return user.get("full_name") or user.get("email") or "Unknown"


def _actor_id(user: dict) -> str:
    uid = user.get("_id")
    if uid is None:
        return "unknown"
    return str(uid)


def _is_redacted_field(field: str) -> bool:
    if field in REDACTED_FIELDS:
        return True
    lower = field.lower()
    return "token" in lower or "password" in lower


def _redact_value(field: str, value: Any) -> Any:
    if _is_redacted_field(field):
        return REDACTED_VALUE
    return value


def _field_label(field: str, field_labels: dict[str, str] | None) -> str:
    if field_labels and field in field_labels:
        return field_labels[field]
    return field.replace("_", " ").title()


def _values_differ(old: Any, new: Any) -> bool:
    return old != new


def _diff(
    before: dict,
    updates: dict,
    *,
    field_labels: dict[str, str] | None = None,
    skip: frozenset[str] = DEFAULT_SKIP,
) -> list[dict]:
    changes: list[dict] = []
    for field, new_val in updates.items():
        if field in skip:
            continue
        old_val = before.get(field)
        if not _values_differ(old_val, new_val):
            continue
        if _is_redacted_field(field):
            changes.append(
                {
                    "field": field,
                    "label": _field_label(field, field_labels),
                    "old": REDACTED_VALUE,
                    "new": REDACTED_VALUE,
                }
            )
        else:
            changes.append(
                {
                    "field": field,
                    "label": _field_label(field, field_labels),
                    "old": old_val,
                    "new": new_val,
                }
            )
    return changes


def _redact_snapshot(doc: dict) -> dict:
    snap = deepcopy(doc)
    for key in list(snap.keys()):
        if _is_redacted_field(key):
            snap[key] = REDACTED_VALUE
    return snap


def _serialize_audit_doc(doc: dict) -> dict:
    out = {
        "id": str(doc["_id"]),
        "entity_type": doc["entity_type"],
        "entity_id": doc["entity_id"],
        "entity_label": doc.get("entity_label", ""),
        "action": doc["action"],
        "changes": doc.get("changes") or [],
        "snapshot": doc.get("snapshot"),
        "actor_id": doc.get("actor_id", ""),
        "actor_name": doc.get("actor_name", ""),
        "actor_role": doc.get("actor_role", ""),
        "leader_id": doc.get("leader_id"),
        "fiscal_year": doc.get("fiscal_year"),
        "source": doc.get("source", "ui"),
        "triggered_by": str(doc["triggered_by"]) if doc.get("triggered_by") else None,
        "request_id": doc.get("request_id"),
        "created_at": doc["created_at"],
    }
    return out


async def log_event(
    *,
    entity_type: str,
    entity_id: str,
    entity_label: str,
    action: str,
    user: dict,
    changes: list[dict] | None = None,
    snapshot: dict | None = None,
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    source: str = "ui",
    triggered_by: ObjectId | None = None,
) -> ObjectId | None:
    changes = changes or []
    if action == "updated" and not changes:
        return None

    now = datetime.now(timezone.utc)
    doc = {
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "entity_label": entity_label,
        "action": action,
        "changes": changes,
        "snapshot": snapshot,
        "actor_id": _actor_id(user),
        "actor_name": _actor_name(user),
        "actor_role": user.get("role", ""),
        "leader_id": leader_id,
        "fiscal_year": fiscal_year,
        "source": source,
        "triggered_by": triggered_by,
        "request_id": request_id_ctx.get(),
        "created_at": now,
    }

    try:
        result = await database.db.audit_log.insert_one(doc)
        return result.inserted_id
    except Exception as exc:
        logger.warning(
            "Audit log insert failed for {} {} ({}): {}",
            entity_type,
            entity_id,
            action,
            exc,
        )
        return None


async def log_create(
    entity_type: str,
    doc: dict,
    user: dict,
    *,
    label: str,
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    source: str = "ui",
    triggered_by: ObjectId | None = None,
) -> ObjectId | None:
    entity_id = doc.get("_id") or doc.get("id")
    return await log_event(
        entity_type=entity_type,
        entity_id=str(entity_id),
        entity_label=label,
        action="created",
        user=user,
        changes=[],
        leader_id=leader_id or doc.get("leader_id"),
        fiscal_year=fiscal_year or doc.get("fiscal_year"),
        source=source,
        triggered_by=triggered_by,
    )


async def log_update(
    entity_type: str,
    before: dict,
    updates: dict,
    user: dict,
    *,
    label: str,
    derived: list[dict] | None = None,
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    source: str = "ui",
    triggered_by: ObjectId | None = None,
    field_labels: dict[str, str] | None = None,
    action: str = "updated",
) -> ObjectId | None:
    entity_id = before.get("_id") or before.get("id")
    changes = _diff(before, updates, field_labels=field_labels)
    if derived:
        changes = changes + derived
    return await log_event(
        entity_type=entity_type,
        entity_id=str(entity_id),
        entity_label=label,
        action=action,
        user=user,
        changes=changes,
        leader_id=leader_id or before.get("leader_id") or updates.get("leader_id"),
        fiscal_year=fiscal_year or before.get("fiscal_year") or updates.get("fiscal_year"),
        source=source,
        triggered_by=triggered_by,
    )


async def log_delete(
    entity_type: str,
    doc: dict,
    user: dict,
    *,
    label: str,
    action: str = "deleted",
    leader_id: str | None = None,
    fiscal_year: str | None = None,
    source: str = "ui",
    triggered_by: ObjectId | None = None,
    changes: list[dict] | None = None,
) -> ObjectId | None:
    entity_id = doc.get("_id") or doc.get("id")
    return await log_event(
        entity_type=entity_type,
        entity_id=str(entity_id),
        entity_label=label,
        action=action,
        user=user,
        changes=changes or [],
        snapshot=_redact_snapshot(doc),
        leader_id=leader_id or doc.get("leader_id"),
        fiscal_year=fiscal_year or doc.get("fiscal_year"),
        source=source,
        triggered_by=triggered_by,
    )


async def list_audit(filters: dict, skip: int, limit: int) -> tuple[list[dict], int]:
    query: dict[str, Any] = {}

    if filters.get("entity_type"):
        query["entity_type"] = filters["entity_type"]
    if filters.get("entity_id"):
        query["entity_id"] = str(filters["entity_id"])
    if filters.get("actor_id"):
        query["actor_id"] = str(filters["actor_id"])
    if filters.get("leader_id"):
        query["leader_id"] = filters["leader_id"]
    if filters.get("fiscal_year"):
        query["fiscal_year"] = filters["fiscal_year"]
    if filters.get("action"):
        query["action"] = filters["action"]
    if filters.get("source"):
        query["source"] = filters["source"]

    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if date_from or date_to:
        created_at: dict[str, Any] = {}
        if date_from:
            created_at["$gte"] = date_from
        if date_to:
            created_at["$lte"] = date_to
        query["created_at"] = created_at

    q = filters.get("q")
    if q:
        query["entity_label"] = {"$regex": q, "$options": "i"}

    if filters.get("entity_type_nin"):
        excluded = filters["entity_type_nin"]
        if "entity_type" in query:
            explicit = query.pop("entity_type")
            query.setdefault("$and", [])
            query["$and"].extend([
                {"entity_type": explicit},
                {"entity_type": {"$nin": excluded}},
            ])
        else:
            query["entity_type"] = {"$nin": excluded}

    total = await database.db.audit_log.count_documents(query)
    cursor = (
        database.db.audit_log.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_serialize_audit_doc(d) for d in docs], total
