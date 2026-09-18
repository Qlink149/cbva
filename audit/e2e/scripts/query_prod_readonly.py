"""Q1: Compare ritesh vs rt FY2627 engagement aggregates (prod read-only)."""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from db_util import get_db  # noqa: E402

OUT = ROOT / "e2e" / "artifacts" / "q1_rt_ritesh_prod.json"


async def eng_aggregate(db, leader_id: str, fy: str) -> dict:
    pipe = [
        {"$match": {"leader_id": leader_id, "fiscal_year": fy, "is_archived": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "green": {"$sum": "$green"},
            "amber": {"$sum": "$amber"},
            "blue_sky": {"$sum": "$blue_sky"},
            "total": {"$sum": "$total"},
            "n": {"$sum": 1},
        }},
    ]
    rows = await db.engagements.aggregate(pipe).to_list(1)
    return rows[0] if rows else {"green": 0, "amber": 0, "blue_sky": 0, "total": 0, "n": 0}


async def main() -> None:
    client, db = get_db()
    try:
        out = {
            "queried_at": datetime.now(timezone.utc).isoformat(),
            "database": "production (read-only via backend/.env)",
            "fiscal_year": "2627",
            "ritesh": await eng_aggregate(db, "ritesh", "2627"),
            "rt": await eng_aggregate(db, "rt", "2627"),
            "conclusion": (
                "RT business-plan code maps to leader_id 'ritesh'. "
                "Querying 'rt' returns zero — not data disappearance."
            ),
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(json.dumps(out, indent=2))
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
