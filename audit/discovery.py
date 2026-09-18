"""Phase 1 discovery dump (read-only). Prints collection counts and samples."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from db_util import get_db

OUT = Path(__file__).resolve().parent / "discovery.json"

COLS = [
    "engagements",
    "leaders",
    "users",
    "clients",
    "pipeline_snapshots",
    "baseline_plans",
    "collection_entries",
    "collection_transactions",
    "audit_log",
    "financial_years",
    "consolidated_summaries",
    "blue_sky_entries",
    "el_summaries",
    "additional_work",
    "engagement_change_log",
]


def _sample(doc: dict | None) -> dict | None:
    if not doc:
        return None
    out = {}
    for k, v in doc.items():
        out[k] = f"{type(v).__name__}:{repr(v)[:120]}"
    return out


async def main() -> None:
    client, db = get_db()
    try:
        counts = {}
        samples = {}
        for c in COLS:
            n = await db[c].count_documents({})
            counts[c] = n
            samples[c] = _sample(await db[c].find_one({}))
        leaders = []
        async for d in db.leaders.find({}, {"_id": 1, "name": 1, "practice": 1, "is_active": 1}):
            leaders.append(d)
        fys = []
        async for d in db.financial_years.find({}):
            fys.append({k: d.get(k) for k in ("slug", "label", "is_current", "is_active", "is_editable")})
        out = {
            "database": db.name,
            "counts": counts,
            "leaders": leaders,
            "financial_years": fys,
            "samples": samples,
        }
        OUT.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
        print(f"Wrote {OUT}")
        print("database", db.name)
        for k, v in counts.items():
            print(f"  {k}: {v}")
        print("leaders", leaders)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
