"""Dry-run / apply archive all FY2526 engagement documents (soft delete)."""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db  # noqa: E402

from _common import FY2526  # noqa: E402

QUERY = {"fiscal_year": FY2526, "is_archived": False}


async def run(apply: bool) -> int:
    client, db = get_db()
    try:
        by_leader: dict[str, list[dict]] = {}
        total = 0
        async for doc in db.engagements.find(QUERY):
            lid = doc.get("leader_id", "?")
            by_leader.setdefault(lid, []).append(doc)
            total += 1

        print(f"FY2526 engagements to archive: {total}")
        for lid in sorted(by_leader.keys()):
            docs = by_leader[lid]
            print(f"\n  {lid}: {len(docs)} docs")
            for d in docs[:3]:
                print(f"    {d['_id']}  {d.get('name', '')[:50]}")
            if len(docs) > 3:
                print(f"    ... and {len(docs) - 3} more")

        if apply and total > 0:
            now = datetime.now(timezone.utc)
            result = await db.engagements.update_many(
                QUERY,
                {"$set": {"is_archived": True, "updated_at": now}},
            )
            print(f"\nAPPLIED: matched={result.matched_count} modified={result.modified_count}")
        elif not apply:
            print("\nDRY-RUN only (pass --apply to write)")
    finally:
        client.close()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    sys.exit(asyncio.run(run(args.apply)))


if __name__ == "__main__":
    main()
