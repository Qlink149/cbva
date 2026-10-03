"""Investigate vinay FY2627 PaymentZ Group engagement corruption."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db  # noqa: E402


async def main() -> None:
    client, db = get_db()
    try:
        query = {
            "leader_id": "vinay",
            "fiscal_year": "2627",
            "is_archived": False,
            "name": {"$regex": "PaymentZ", "$options": "i"},
        }
        docs = []
        async for d in db.engagements.find(query):
            docs.append(d)

        print(f"Found {len(docs)} PaymentZ engagement(s)")
        for d in docs:
            eid = str(d["_id"])
            tx_sum = 0.0
            n_tx = 0
            async for tx in db.collection_transactions.find({"engagement_id": eid}):
                tx_sum += float(tx.get("amount_collected") or 0)
                n_tx += 1
            print(f"\n_id={eid}")
            print(f"  name={d.get('name')}")
            print(f"  collected={d.get('collected'):,.2f}")
            print(f"  total={d.get('total'):,.2f}")
            print(f"  balance={d.get('balance'):,.2f}")
            print(f"  created_at={d.get('created_at')}")
            print(f"  updated_at={d.get('updated_at')}")
            print(f"  tx_sum={tx_sum:,.2f} (n={n_tx})")

            print("\n  audit_log (PaymentZ / engagement / collection):")
            async for log in db.audit_log.find(
                {
                    "leader_id": "vinay",
                    "$or": [
                        {"entity_type": "engagement", "entity_id": eid},
                        {"entity_type": "collection_transaction"},
                        {"label": {"$regex": "PaymentZ", "$options": "i"}},
                    ],
                }
            ).sort("created_at", -1).limit(20):
                print(
                    f"    {log.get('created_at')} {log.get('action')} "
                    f"{log.get('entity_type')} {log.get('label','')[:60]}"
                )
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
