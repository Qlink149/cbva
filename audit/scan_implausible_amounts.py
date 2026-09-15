"""Read-only scan for implausible INR magnitudes across amount collections.

Flags any field > THRESHOLD (default 1e10 = ₹100 Cr) — whole-rupee storage.
Run: python audit/scan_implausible_amounts.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_util import get_db  # noqa: E402

THRESHOLD = 10_000_000_000  # ₹100 Cr in whole rupees

ENGAGEMENT_FIELDS = ("green", "amber", "blue_sky", "collected", "total", "balance")
COLLECTION_ENTRY_FIELDS = ("collected", "planned")
COLLECTION_TX_FIELDS = ("amount_collected", "amount_billed")
BLUE_SKY_FIELDS = ("opening", "additional", "converted", "closing")


async def scan_collection(db, name: str, fields: tuple[str, ...]) -> list[dict]:
    hits: list[dict] = []
    or_clauses = [{f: {"$gt": THRESHOLD}} for f in fields]
    query = {"$or": or_clauses} if len(or_clauses) > 1 else or_clauses[0]
    async for doc in db[name].find(query):
        row = {
            "collection": name,
            "_id": str(doc["_id"]),
            "leader_id": doc.get("leader_id"),
            "fiscal_year": doc.get("fiscal_year"),
            "name": doc.get("name") or doc.get("month"),
            "fields": {},
        }
        for f in fields:
            v = doc.get(f)
            if isinstance(v, (int, float)) and v > THRESHOLD:
                row["fields"][f] = v
        hits.append(row)
    return hits


async def main() -> None:
    client, db = get_db()
    all_hits: list[dict] = []
    try:
        all_hits.extend(await scan_collection(db, "engagements", ENGAGEMENT_FIELDS))
        all_hits.extend(await scan_collection(db, "collection_entries", COLLECTION_ENTRY_FIELDS))
        all_hits.extend(await scan_collection(db, "collection_transactions", COLLECTION_TX_FIELDS))
        all_hits.extend(await scan_collection(db, "blue_sky_entries", BLUE_SKY_FIELDS))

        out_path = Path(__file__).resolve().parent / "implausible_amounts_scan.json"
        payload = {
            "threshold_rupees": THRESHOLD,
            "count": len(all_hits),
            "hits": all_hits,
        }
        out_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

        print(f"Threshold: > INR {THRESHOLD:,} (whole rupees)")
        print(f"Hits: {len(all_hits)}")
        for h in all_hits:
            print(f"  {h['collection']} {h['_id']} leader={h.get('leader_id')} fy={h.get('fiscal_year')}")
            for k, v in h["fields"].items():
                print(f"    {k}={v:,}")
        print(f"\nWritten: {out_path}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
