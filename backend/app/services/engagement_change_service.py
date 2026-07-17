from datetime import datetime, timezone
from bson import ObjectId

from app.core import database

TRACKED_FIELDS = (
    "green",
    "amber",
    "blue_sky",
    "collected",
    "may_col",
    "june_col",
    "july_col",
)


def _serialize_change_from_audit(
    audit_doc: dict,
    change: dict,
    engagement_id: str,
) -> dict:
    return {
        "id": str(audit_doc["_id"]),
        "engagement_id": engagement_id,
        "leader_id": audit_doc.get("leader_id", ""),
        "fiscal_year": audit_doc.get("fiscal_year", ""),
        "field": change["field"],
        "old_value": change.get("old"),
        "new_value": change.get("new"),
        "changed_by": audit_doc.get("actor_id", ""),
        "changed_by_name": audit_doc.get("actor_name", ""),
        "changed_at": audit_doc["created_at"],
    }


async def log_changes(
    existing: dict,
    updates: dict,
    user: dict,
) -> None:
    """Legacy — replaced by audit_service.log_update. Kept for compatibility."""
    pass


async def list_changes(engagement_id: str, limit: int = 20) -> list[dict]:
    """Flatten audit_log entries for an engagement into legacy change rows."""
    cursor = (
        database.db.audit_log.find(
            {
                "entity_type": "engagement",
                "entity_id": str(engagement_id),
                "changes": {"$exists": True, "$ne": []},
            }
        )
        .sort("created_at", -1)
        .limit(limit * 5)
    )
    docs = await cursor.to_list(length=limit * 5)
    rows: list[dict] = []
    for doc in docs:
        for change in doc.get("changes") or []:
            rows.append(_serialize_change_from_audit(doc, change, str(engagement_id)))
            if len(rows) >= limit:
                return rows
    return rows
