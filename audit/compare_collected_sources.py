"""Compare engagements.collected vs collection_entries.collected vs tx sums per leader+FY.

Read-only. Uses backend/.env DATABASE_NAME.
"""
from __future__ import annotations

import asyncio
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_util import get_db

OUT_CSV = Path(__file__).resolve().parent / "collected_sources_comparison.csv"
FYS = ["2526", "2627"]


async def main() -> None:
    client, db = get_db()
    rows: list[dict] = []
    try:
        leaders = []
        async for L in db.leaders.find({"is_active": True}, {"_id": 1, "name": 1}):
            leaders.append(L)
        leaders.sort(key=lambda x: x["_id"])

        print(
            f"{'leader':<10} {'fy':<6} {'eng_collected':>16} {'entry_collected':>16} "
            f"{'tx_collected':>16} {'diff_eng_entry':>16} {'diff_eng_tx':>14}  notes"
        )
        print("-" * 110)

        for L in leaders:
            lid = L["_id"]
            name = L.get("name", "")
            for fy in FYS:
                eng_sum = 0
                n_eng = 0
                async for e in db.engagements.find(
                    {"leader_id": lid, "fiscal_year": fy, "is_archived": False}
                ):
                    eng_sum += e.get("collected") or 0
                    n_eng += 1

                entry_sum = 0
                n_ent = 0
                async for c in db.collection_entries.find({"leader_id": lid, "fiscal_year": fy}):
                    entry_sum += c.get("collected") or 0
                    n_ent += 1

                tx_sum = 0
                n_tx = 0
                async for t in db.collection_transactions.find({"leader_id": lid, "fiscal_year": fy}):
                    tx_sum += t.get("amount_collected") or 0
                    n_tx += 1

                diff_ee = eng_sum - entry_sum
                diff_et = eng_sum - tx_sum

                notes = []
                if n_eng == 0 and entry_sum > 0:
                    notes.append("entries only")
                if n_tx == 0 and entry_sum > 0 and fy == "2526":
                    notes.append("fy2526 import on entries")
                if entry_sum == 0 and tx_sum > 0 and eng_sum != tx_sum:
                    notes.append("eng != tx (recompute gap?)")
                if eng_sum > 1_000_000_000:
                    notes.append("OUTLIER eng collected")

                note_str = "; ".join(notes)
                row = {
                    "leader_id": lid,
                    "leader_name": name,
                    "fiscal_year": fy,
                    "engagements_collected_sum": eng_sum,
                    "collection_entries_collected_sum": entry_sum,
                    "collection_transactions_sum": tx_sum,
                    "diff_eng_minus_entry": diff_ee,
                    "diff_eng_minus_tx": diff_et,
                    "n_engagements": n_eng,
                    "n_collection_entries": n_ent,
                    "n_collection_transactions": n_tx,
                    "notes": note_str,
                }
                rows.append(row)

                if eng_sum or entry_sum or tx_sum or n_eng or n_ent:
                    print(
                        f"{lid:<10} {fy:<6} {eng_sum:>16,} {entry_sum:>16,} {tx_sum:>16,} "
                        f"{diff_ee:>16,} {diff_et:>14,}  {note_str}"
                    )
    finally:
        client.close()

    if rows:
        with OUT_CSV.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"\nWrote {OUT_CSV} ({len(rows)} rows)")


if __name__ == "__main__":
    asyncio.run(main())
