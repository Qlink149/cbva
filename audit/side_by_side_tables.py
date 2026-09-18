"""Print Section 4.1 and 5.1 tables: sheet vs DB side-by-side with PASS/FAIL.

Read-only. Uses phase2/phase3 result JSON if present, else recomputes.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "audit"))

from db_util import TOL_FY_TOTAL, nearly_equal, pass_fail  # noqa: E402

AUDIT = Path(__file__).resolve().parent
P2 = AUDIT / "phase2_results.json"
P3 = AUDIT / "phase3_results.json"


def fmt(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:,.2f}"
    return str(v)


async def ensure_results() -> None:
    if not P2.exists():
        from phase2_collections_fy2526 import main as p2

        await p2()
    if not P3.exists():
        from phase3_business_plan import main as p3

        await p3()


def print_4_1(p2: dict) -> None:
    print("\n=== Section 4.1 FY25-26 Actual Collections (Revenue) by leader ===")
    print(f"{'Leader':<8} {'Sheet':>18} {'DB entries':>18} {'Consol import':>18} {'Status':>8}")
    for row in p2.get("side_by_side_leader") or []:
        print(
            f"{row['leader']:<8} {fmt(row['sheet']):>18} {fmt(row.get('db_entries')):>18} "
            f"{fmt(row.get('consol_import')):>18} {row['status']:>8}"
        )
    print(f"\nMonth cells: PASS {p2.get('month_pass_count')} / FAIL {p2.get('month_fail_count')} "
          f"(of {p2.get('month_compare_count')} comparable mapped-leader cells)")
    print(f"FY2526 collection_transactions count: {p2.get('tx_2526_count')} "
          "(row-level receipt match: CANNOT_VERIFY_NO_SOURCE)")


def print_5_1(p3: dict) -> None:
    print("\n=== Section 5.1 FY26-27 firm snapshot totals (sheet TOTAL vs sum of DB snaps for mapped leaders) ===")
    print(f"{'Snapshot':<22} {'Sheet':>18} {'DB sum':>18} {'Status':>8}")
    for row in p3.get("firm_table_5_1") or []:
        print(f"{row['label']:<22} {fmt(row['sheet']):>18} {fmt(row['db_sum_mapped_leaders']):>18} {row['status']:>8}")
    print(f"\nLeader×category snapshot cells: PASS {p3.get('snapshot_side_by_side_pass_count')} / "
          f"FAIL {p3.get('snapshot_side_by_side_fail_count')}")
    print(f"Monthly collection cells: PASS {p3.get('collection_side_pass')} / FAIL {p3.get('collection_side_fail')}")
    print(f"Aug 2026 actuals present in DB (sum mapped leaders): {fmt(p3.get('aug_db_total'))}")


async def main() -> None:
    await ensure_results()
    p2 = json.loads(P2.read_text(encoding="utf-8"))
    p3 = json.loads(P3.read_text(encoding="utf-8"))
    print_4_1(p2)
    print_5_1(p3)

    # Overall quick score
    p2_ok = sum(1 for r in p2.get("side_by_side_leader") or [] if r["status"] == "PASS")
    p2_n = len(p2.get("side_by_side_leader") or [])
    p3_ok = sum(1 for r in p3.get("firm_table_5_1") or [] if r["status"] == "PASS")
    p3_n = sum(1 for r in p3.get("firm_table_5_1") or [] if r["status"] in ("PASS", "FAIL"))
    print("\n=== Quick score ===")
    print(f"4.1 leader totals: {p2_ok}/{p2_n} PASS")
    print(f"5.1 firm snapshots: {p3_ok}/{p3_n} PASS")


if __name__ == "__main__":
    asyncio.run(main())
