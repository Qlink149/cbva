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


def _serialize_change(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "engagement_id": str(doc["engagement_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "field": doc["field"],
        "old_value": doc.get("old_value"),
        "new_value": doc.get("new_value"),
        "changed_by": str(doc["changed_by"]),
        "changed_by_name": doc.get("changed_by_name", ""),
        "changed_at": doc["changed_at"],
    }


async def log_changes(
    existing: dict,
    updates: dict,
    user: dict,
) -> None:
    """Insert one engagement_change_log row per changed financial field."""
    engagement_id = existing["_id"]
    now = datetime.now(timezone.utc)
    changed_by_name = user.get("full_name") or user.get("email") or "Unknown"
    entries = []

    for field in TRACKED_FIELDS:
        if field not in updates:
            continue
        old_val = existing.get(field)
        new_val = updates[field]
        if old_val == new_val:
            continue
        entries.append(
            {
                "engagement_id": engagement_id,
                "leader_id": existing["leader_id"],
                "fiscal_year": existing["fiscal_year"],
                "field": field,
                "old_value": old_val,
                "new_value": new_val,
                "changed_by": user["_id"],
                "changed_by_name": changed_by_name,
                "changed_at": now,
            }
        )

    if entries:
        await database.db.engagement_change_log.insert_many(entries)


async def list_changes(engagement_id: str, limit: int = 20) -> list[dict]:
    cursor = (
        database.db.engagement_change_log.find({"engagement_id": ObjectId(engagement_id)})
        .sort("changed_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_serialize_change(d) for d in docs]
