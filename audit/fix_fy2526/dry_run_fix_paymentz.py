"""Dry-run / apply fix for vinay FY2627 PaymentZ Group collected field."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db  # noqa: E402

# Set from investigate_paymentz.py output; updated at runtime if single match
HARDCODED_ENGAGEMENT_ID: str | None = None


async def find_paymentz(db) -> dict | None:
    query = {
        "leader_id": "vinay",
        "fiscal_year": "2627",
        "is_archived": False,
        "name": {"$regex": "PaymentZ", "$options": "i"},
    }
    docs = [d async for d in db.engagements.find(query)]
    if len(docs) != 1:
        print(f"ABORT: expected 1 PaymentZ doc, found {len(docs)}")
        return None
    return docs[0]


async def tx_sum(db, engagement_id: str) -> float:
    total = 0.0
    async for tx in db.collection_transactions.find({"engagement_id": engagement_id}):
        total += float(tx.get("amount_collected") or 0)
    return total


async def run(apply: bool) -> int:
    client, db = get_db()
    try:
        doc = await find_paymentz(db)
        if not doc:
            return 1

        eid = str(doc["_id"])
        if HARDCODED_ENGAGEMENT_ID and eid != HARDCODED_ENGAGEMENT_ID:
            print(f"ABORT: _id {eid} != hardcoded {HARDCODED_ENGAGEMENT_ID}")
            return 1

        old_collected = float(doc.get("collected") or 0)
        new_collected = await tx_sum(db, eid)
        total = float(doc.get("total") or 0)
        new_balance = round(total - new_collected, 2)

        print(f"PaymentZ _id={eid}")
        print(f"  collected {old_collected:,.2f} -> {new_collected:,.2f}")
        print(f"  balance -> {new_balance:,.2f}")

        if apply:
            await db.engagements.update_one(
                {"_id": doc["_id"]},
                {"$set": {"collected": new_collected, "balance": new_balance}},
            )
            print("APPLIED")
        else:
            print("DRY-RUN only (pass --apply to write)")
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
