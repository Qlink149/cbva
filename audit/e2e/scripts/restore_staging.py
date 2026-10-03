"""Restore staging MongoDB from prod backup + supplementary read-only prod collections."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from bson.json_util import loads

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(REPO / "backend"))

BACKUP_DIR = ROOT / "backups" / "fy2526_fix_20260915_105823"
BACKUP_COLLECTIONS = ["engagements", "collection_entries", "consolidated_summaries", "financial_years"]
SUPPLEMENTARY = ["leaders", "pipeline_snapshots", "blue_sky_entries", "audit_log"]


def staging_url() -> str:
    url = os.environ.get("MONGODB_URL")
    if not url:
        raise SystemExit("MONGODB_URL required (staging only)")
    return url


def staging_db_name() -> str:
    return os.environ.get("DATABASE_NAME", "cbva1_db").strip()


async def import_json(db, collection: str, path: Path, drop: bool = True) -> int:
    if not path.exists():
        print(f"  skip {collection}: {path.name} not found")
        return 0
    raw = path.read_text(encoding="utf-8")
    docs = loads(raw)
    if not isinstance(docs, list):
        docs = [docs]
    if drop:
        await db[collection].delete_many({})
    if docs:
        await db[collection].insert_many(docs)
    return len(docs)


async def copy_from_prod(staging_db, prod_db, collection: str, limit: int | None = None) -> int:
    cursor = prod_db[collection].find({})
    if limit:
        cursor = cursor.limit(limit)
    docs = await cursor.to_list(length=limit or 100_000)
    if not docs:
        return 0
    await staging_db[collection].delete_many({})
    await staging_db[collection].insert_many(docs)
    return len(docs)


async def main(if_empty: bool) -> None:
    from motor.motor_asyncio import AsyncIOMotorClient
    from db_util import get_db, load_env

    url = staging_url()
    db_name = staging_db_name()
    staging_client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=30000)
    staging_db = staging_client[db_name]

    count = await staging_db.engagements.count_documents({})
    if if_empty and count > 50:
        print(f"Staging already has {count} engagements — skip restore (--if-empty)")
        staging_client.close()
        return

    print(f"Restoring staging {db_name} from {BACKUP_DIR.name}")
    for coll in BACKUP_COLLECTIONS:
        n = await import_json(staging_db, coll, BACKUP_DIR / f"{coll}.json")
        print(f"  {coll}: {n} docs")

    load_env()
    prod_client, prod_db = get_db()
    try:
        for coll in SUPPLEMENTARY:
            lim = 5000 if coll == "audit_log" else None
            n = await copy_from_prod(staging_db, prod_db, coll, limit=lim)
            print(f"  prod->{coll}: {n} docs")
    finally:
        prod_client.close()

    staging_client.close()
    print("Restore complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--if-empty", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.if_empty))
