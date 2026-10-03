"""Dry-run / apply backfill of engagements.collected for FY2526 (5 leaders)."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db  # noqa: E402

from _common import BACKFILL_LEADERS, FY2526, VERIFY_ONLY_LEADERS  # noqa: E402


async def entry_target(db, leader_id: str) -> float:
    total = 0.0
    async for row in db.collection_entries.find({"leader_id": leader_id, "fiscal_year": FY2526}):
        total += float(row.get("collected") or 0)
    return total


def allocate(target: float, engagements: list[dict]) -> list[tuple[dict, float, float]]:
    """Return (doc, old_collected, new_collected) per engagement."""
    if not engagements:
        return []

    current_sum = sum(float(e.get("collected") or 0) for e in engagements)
    if abs(current_sum - target) < 0.01:
        return [(e, float(e.get("collected") or 0), float(e.get("collected") or 0)) for e in engagements]

    if current_sum > 0:
        allocated = []
        running = 0.0
        for i, e in enumerate(engagements):
            old = float(e.get("collected") or 0)
            if i == len(engagements) - 1:
                new = round(target - running, 2)
            else:
                new = round(target * (old / current_sum), 2)
                running += new
            allocated.append((e, old, new))
        return allocated

    # sum == 0: assign entire target to largest-total engagement
    largest = max(engagements, key=lambda x: float(x.get("total") or 0))
    out = []
    for e in engagements:
        old = float(e.get("collected") or 0)
        new = target if e["_id"] == largest["_id"] else 0.0
        out.append((e, old, new))
    return out


async def run(apply: bool) -> int:
    client, db = get_db()
    errors = 0
    try:
        for leader_id in BACKFILL_LEADERS:
            target = await entry_target(db, leader_id)
            engagements = []
            async for e in db.engagements.find(
                {"leader_id": leader_id, "fiscal_year": FY2526, "is_archived": False}
            ):
                engagements.append(e)

            current = sum(float(e.get("collected") or 0) for e in engagements)
            verify_only = leader_id in VERIFY_ONLY_LEADERS
            print(f"\n=== {leader_id} target={target:,.2f} current={current:,.2f} n={len(engagements)} ===")

            if not engagements:
                print("  SKIP: no FY2526 engagement rows")
                continue

            if verify_only and abs(current - target) > 0.01:
                print(f"  FAIL verify-only: diff={current - target:,.2f}")
                errors += 1
                continue

            if verify_only:
                print("  VERIFY OK (no changes needed)")
                continue

            if abs(current - target) < 0.01:
                print("  OK already matches target")
                continue

            plan = allocate(target, engagements)
            new_sum = 0.0
            for e, old, new in plan:
                total = float(e.get("total") or 0)
                balance = round(total - new, 2)
                new_sum += new
                print(
                    f"  {e['_id']} {e.get('name','')[:40]:<40} "
                    f"collected {old:>14,.2f} -> {new:>14,.2f} balance={balance:>14,.2f}"
                )
                if apply and abs(old - new) > 0.001:
                    await db.engagements.update_one(
                        {"_id": e["_id"]},
                        {"$set": {"collected": new, "balance": balance}},
                    )
            print(f"  new leader sum={new_sum:,.2f} (target={target:,.2f})")
    finally:
        client.close()

    if apply:
        print("\nAPPLIED backfill")
    else:
        print("\nDRY-RUN only (pass --apply to write)")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    errors = asyncio.run(run(args.apply))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
