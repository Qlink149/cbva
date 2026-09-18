"""Read-only scan for downward magnitude corruption (values implausibly small).

Run: python audit/scan_downward_corruption.py  (uses backend/.env)
"""
from __future__ import annotations

import asyncio
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_util import get_db  # noqa: E402

ENGAGEMENT_FIELDS = ("green", "amber", "blue_sky", "collected", "total")
SMALL_ABSOLUTE = 10_000
MEDIAN_FLOOR = 100_000


def _median_positive(values: list[float]) -> float | None:
    pos = [v for v in values if v and v > 0]
    if not pos:
        return None
    return statistics.median(pos)


async def scan_engagements(db) -> list[dict]:
    hits: list[dict] = []
    groups: dict[tuple[str, str], list[dict]] = {}
    async for doc in db.engagements.find({"is_archived": {"$ne": True}}):
        key = (doc.get("leader_id", ""), doc.get("fiscal_year", ""))
        groups.setdefault(key, []).append(doc)

    for (leader_id, fiscal_year), docs in sorted(groups.items()):
        for field in ENGAGEMENT_FIELDS:
            vals = [float(d.get(field) or 0) for d in docs]
            med = _median_positive(vals)
            if med is None or med < MEDIAN_FLOOR:
                continue
            threshold = med / 100
            for d in docs:
                v = float(d.get(field) or 0)
                if v <= 0:
                    continue
                if v < threshold or (0 < v < SMALL_ABSOLUTE):
                    hits.append({
                        "collection": "engagements",
                        "_id": str(d["_id"]),
                        "leader_id": leader_id,
                        "fiscal_year": fiscal_year,
                        "name": d.get("name"),
                        "field": field,
                        "value": int(v),
                        "leader_median": int(med),
                        "ratio_to_median": round(v / med, 6),
                    })
    return hits


async def scan_collection_entries(db) -> list[dict]:
    hits: list[dict] = []
    groups: dict[tuple[str, str], list[float]] = {}
    async for doc in db.collection_entries.find({}):
        key = (doc.get("leader_id", ""), doc.get("fiscal_year", ""))
        groups.setdefault(key, []).append(float(doc.get("collected") or 0))

    for (leader_id, fiscal_year), vals in sorted(groups.items()):
        med = _median_positive(vals)
        if med is None or med < MEDIAN_FLOOR:
            continue
        threshold = med / 100
        async for doc in db.collection_entries.find({"leader_id": leader_id, "fiscal_year": fiscal_year}):
            v = float(doc.get("collected") or 0)
            if v <= 0:
                continue
            if v < threshold or (0 < v < SMALL_ABSOLUTE):
                hits.append({
                    "collection": "collection_entries",
                    "_id": str(doc["_id"]),
                    "leader_id": leader_id,
                    "fiscal_year": fiscal_year,
                    "month": doc.get("month"),
                    "field": "collected",
                    "value": int(v),
                    "leader_median": int(med),
                    "ratio_to_median": round(v / med, 6),
                })
    return hits


async def scan_collection_transactions(db) -> list[dict]:
    hits: list[dict] = []
    groups: dict[tuple[str, str], list[float]] = {}
    async for doc in db.collection_transactions.find({}):
        key = (doc.get("leader_id", ""), doc.get("fiscal_year", ""))
        groups.setdefault(key, []).append(float(doc.get("amount_collected") or 0))

    for (leader_id, fiscal_year), vals in sorted(groups.items()):
        med = _median_positive(vals)
        if med is None or med < MEDIAN_FLOOR:
            continue
        threshold = med / 100
        async for doc in db.collection_transactions.find({"leader_id": leader_id, "fiscal_year": fiscal_year}):
            v = float(doc.get("amount_collected") or 0)
            if v <= 0:
                continue
            if v < threshold or (0 < v < SMALL_ABSOLUTE):
                hits.append({
                    "collection": "collection_transactions",
                    "_id": str(doc["_id"]),
                    "leader_id": leader_id,
                    "fiscal_year": fiscal_year,
                    "engagement_id": str(doc.get("engagement_id", "")),
                    "month": doc.get("month"),
                    "field": "amount_collected",
                    "value": int(v),
                    "leader_median": int(med),
                    "ratio_to_median": round(v / med, 6),
                })
    return hits


async def main() -> None:
    client, db = get_db()
    all_hits: list[dict] = []
    try:
        all_hits.extend(await scan_engagements(db))
        all_hits.extend(await scan_collection_entries(db))
        all_hits.extend(await scan_collection_transactions(db))

        out = Path(__file__).resolve().parent / "downward_corruption_scan.json"
        payload = {"count": len(all_hits), "hits": all_hits}
        out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        print(f"Downward corruption candidates: {len(all_hits)}")
        for h in all_hits[:40]:
            label = h.get("name") or h.get("month") or h.get("_id")
            print(f"  {h['collection']} {h['leader_id']} {label} {h['field']}={h['value']} med={h['leader_median']}")
        if len(all_hits) > 40:
            print(f"  ... +{len(all_hits) - 40} more")
        print(f"Written: {out}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
