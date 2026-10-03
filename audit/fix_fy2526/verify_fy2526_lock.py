"""Verify FY2526 is locked in DB and document write-path guards."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db  # noqa: E402


WRITE_PATHS = [
    "POST/PUT /api/collections -> assert_fy_editable (collections.py)",
    "POST/DELETE /api/collection-transactions -> assert_fy_editable",
    "POST/PUT/DELETE /api/engagements -> assert_fy_editable",
    "materialize_leader_derived_data -> is_fy_editable(fy, user=None) skip writes",
]


async def main() -> None:
    client, db = get_db()
    try:
        fy = await db.financial_years.find_one({"slug": "2526"})
        if not fy:
            print("FAIL: financial_years slug 2526 not found")
            sys.exit(1)

        editable = fy.get("is_editable")
        if editable is None:
            editable = fy.get("is_current", False)
        print(f"financial_years.2526 is_editable={editable}")
        if editable:
            print("WARN: FY2526 is editable — expected locked")
        else:
            print("PASS: FY2526 locked in DB")

        print("\nWrite paths with assert_fy_editable (admin bypass documented):")
        for p in WRITE_PATHS:
            print(f"  - {p}")
        print("\nNote: users with role=admin bypass assert_fy_editable per fiscal_year.py")
        print("\nManual API 403 checks: use non-admin JWT against PUT /api/engagements, POST collection tx, PUT collection_entries for fy=2526")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
