#!/usr/bin/env python3
"""One-off baseline snapshot for go-live audit trail."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import connect_db, close_db
from app.core import database
from app.services import audit_service

BASELINE_ACTOR = {
    "_id": "system",
    "full_name": "System — Go-live Baseline",
    "role": "admin",
    "email": "system@baseline",
}

COLLECTIONS = [
    ("engagements", {"is_archived": False}),
    ("collection_transactions", {}),
    ("actions", {}),
    ("tasks", {}),
    ("team_members", {}),
    ("hiring_requirements", {}),
    ("headcount_plans", {}),
    ("baseline_plans", {}),
    ("el_summaries", {}),
    ("blue_sky_entries", {}),
    ("client_meetings", {}),
    ("leaders", {"is_active": True}),
]


def _label_for(collection: str, doc: dict) -> str:
    if collection == "engagements":
        return doc.get("name", str(doc["_id"]))
    if collection == "collection_transactions":
        return doc.get("client_name") or str(doc["_id"])
    if collection == "actions":
        return doc.get("description") or f"Action #{doc.get('num', '')}"
    if collection == "tasks":
        return doc.get("title", str(doc["_id"]))
    if collection == "team_members":
        return doc.get("full_name", str(doc["_id"]))
    if collection == "hiring_requirements":
        return doc.get("role_title", str(doc["_id"]))
    if collection == "headcount_plans":
        return doc.get("designation", str(doc["_id"]))
    if collection == "baseline_plans":
        return f"Baseline — {doc.get('leader_id')} FY {doc.get('financial_year_id')}"
    if collection == "el_summaries":
        return f"{doc.get('leader_id')} — {doc.get('fiscal_year')}"
    if collection == "blue_sky_entries":
        return doc.get("month", str(doc["_id"]))
    if collection == "client_meetings":
        return doc.get("client_name", str(doc["_id"]))
    if collection == "leaders":
        return doc.get("name", str(doc["_id"]))
    return str(doc["_id"])


ENTITY_TYPE = {
    "engagements": "engagement",
    "collection_transactions": "collection_transaction",
    "actions": "action",
    "tasks": "task",
    "team_members": "team_member",
    "hiring_requirements": "hiring",
    "headcount_plans": "headcount",
    "baseline_plans": "baseline",
    "el_summaries": "el_summary",
    "blue_sky_entries": "bluesky_entry",
    "client_meetings": "client_meeting",
    "leaders": "leader",
}


async def main() -> None:
    await connect_db()
    total = 0
    print("Writing baseline snapshots to audit_log...")
    for collection, query in COLLECTIONS:
        count = 0
        cursor = database.db[collection].find(query)
        async for doc in cursor:
            entity_type = ENTITY_TYPE[collection]
            await audit_service.log_event(
                entity_type=entity_type,
                entity_id=str(doc["_id"]),
                entity_label=_label_for(collection, doc),
                action="baseline",
                user=BASELINE_ACTOR,
                changes=[],
                snapshot=audit_service._redact_snapshot(doc),
                leader_id=doc.get("leader_id"),
                fiscal_year=doc.get("fiscal_year"),
                source="script",
            )
            count += 1
        total += count
        print(f"  {collection}: {count}")
    print(f"Done — {total} baseline entries written.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
