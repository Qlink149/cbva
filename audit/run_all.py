"""Run all read-only audit scripts and print side-by-side tables."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


async def main() -> None:
    from phase2_collections_fy2526 import main as p2
    from phase3_business_plan import main as p3
    from side_by_side_tables import main as tables

    print("=== Phase 2 ===")
    await p2()
    print("\n=== Phase 3 ===")
    await p3()
    print("\n=== Side-by-side ===")
    await tables()


if __name__ == "__main__":
    asyncio.run(main())
