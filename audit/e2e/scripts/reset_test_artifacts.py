"""Reset E2E-created artifacts between test files (staging only)."""
from __future__ import annotations

import asyncio
import os
import re
import sys


async def main() -> None:
    from motor.motor_asyncio import AsyncIOMotorClient

    url = os.environ.get("MONGODB_URL")
    if not url:
        raise SystemExit("MONGODB_URL required")
    db_name = os.environ.get("DATABASE_NAME", "cbva1_db").strip()
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=20000)
    db = client[db_name]

    r1 = await db.engagements.delete_many({"name": re.compile(r"^E2E_", re.I)})
    r2 = await db.engagement_actions.delete_many({"description": re.compile(r"^E2E_", re.I)})
    r3 = await db.additional_work.delete_many({"client_name": re.compile(r"^E2E_", re.I)})
    print(f"reset: engagements={r1.deleted_count}, actions={r2.deleted_count}, additional_work={r3.deleted_count}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
