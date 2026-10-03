"""Seed E2E test users on staging only."""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
sys.path.insert(0, str(REPO / "backend"))

from app.core.security import hash_password  # noqa: E402

PASSWORD = "E2eTest123!"

LEADERS = [
    {"_id": "manan", "name": "Manan Mathuria", "practice": "Tax"},
    {"_id": "amol", "name": "Amol Hingne", "practice": "Tax"},
    {"_id": "biu", "name": "BIU", "practice": "Tax"},
    {"_id": "varun", "name": "Varun Chaudhary", "practice": "TP"},
    {"_id": "ritesh", "name": "Ritesh T", "practice": "Tax"},
    {"_id": "np", "name": "Nikhil Popli", "practice": "Tax"},
]

USERS = [
    {"email": "e2e.leader1@staging.cbva.in", "full_name": "E2E Leader One", "role": "user", "leader_id": "manan"},
    {"email": "e2e.leader2@staging.cbva.in", "full_name": "E2E Leader Two", "role": "user", "leader_id": "amol"},
    {"email": "e2e.mgmt@staging.cbva.in", "full_name": "E2E Management", "role": "management", "leader_id": "varun"},
    {"email": "e2e.admin@staging.cbva.in", "full_name": "E2E Admin", "role": "admin", "leader_id": None},
    {"email": "amit.sh@cbva.in", "full_name": "Amit Dinesh Shah", "role": "user", "leader_id": "biu"},
]


async def main() -> None:
    from motor.motor_asyncio import AsyncIOMotorClient

    url = os.environ.get("MONGODB_URL")
    if not url:
        raise SystemExit("MONGODB_URL required")
    db_name = os.environ.get("DATABASE_NAME", "cbva1_db").strip()
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=20000)
    db = client[db_name]
    now = datetime.now(timezone.utc)
    pw_hash = hash_password(PASSWORD)

    for l in LEADERS:
        await db.leaders.update_one(
            {"_id": l["_id"]},
            {"$set": {**l, "is_active": True}},
            upsert=True,
        )
        print(f"  leader {l['_id']}")

    fy_defaults = {
        "2526": {"label": "2025-26", "is_current": False, "sort_order": 1, "is_editable": False},
        "2627": {"label": "2026-27", "is_current": True, "sort_order": 2, "is_editable": True},
    }
    for slug, meta in fy_defaults.items():
        await db.financial_years.update_one(
            {"slug": slug},
            {
                "$set": {
                    **meta,
                    "slug": slug,
                    "is_active": True,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        print(f"  FY {slug} editable")

    for u in USERS:
        await db.users.update_one(
            {"email": u["email"]},
            {
                "$set": {
                    "full_name": u["full_name"],
                    "password_hash": pw_hash,
                    "designation": "Partner",
                    "role": u["role"],
                    "leader_id": u["leader_id"],
                    "is_active": True,
                    "updated_at": now,
                    "refresh_token_hashes": [],
                },
                "$setOnInsert": {"_id": ObjectId(), "created_at": now},
            },
            upsert=True,
        )
        print(f"  seeded {u['email']} ({u['role']}, leader={u['leader_id']})")

    client.close()
    print("Seed users complete.")


if __name__ == "__main__":
    asyncio.run(main())
