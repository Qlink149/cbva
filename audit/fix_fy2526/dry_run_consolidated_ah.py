"""Dry-run / apply consolidated_summaries AH fix for FY2526 board actual collections."""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.consolidated_import import parse_consolidated_xlsx  # noqa: E402
from db_util import get_db  # noqa: E402

from _common import AH_ROW_KEY, XLSX_PATH  # noqa: E402

TARGET_AH = 78_259_952.67


def ah_from_parsed(rows: list[dict]) -> float | None:
    for r in rows:
        if r.get("row_key") == AH_ROW_KEY:
            return float(r.get("values", {}).get("AH") or 0)
    return None


async def current_ah(db, report_fy: str) -> tuple[float | None, dict | None]:
    doc = await db.consolidated_summaries.find_one({"report_fy": report_fy})
    if not doc:
        return None, None
    for row in doc.get("rows") or []:
        if row.get("row_key") == AH_ROW_KEY:
            return float(row.get("values", {}).get("AH") or 0), doc
    return None, doc


async def run(apply: bool) -> None:
    if not XLSX_PATH.exists():
        print(f"Missing xlsx: {XLSX_PATH}")
        sys.exit(1)

    parsed_rows = parse_consolidated_xlsx(XLSX_PATH)
    parsed_ah = ah_from_parsed(parsed_rows)
    print(f"Parsed xlsx AH for {AH_ROW_KEY}: {parsed_ah:,.2f}" if parsed_ah else "Row not found in xlsx")

    client, db = get_db()
    try:
        for report_fy in ("2526", "2627"):
            cur, doc = await current_ah(db, report_fy)
            print(f"\nreport_fy={report_fy} current AH={cur:,.2f}" if cur is not None else f"\nreport_fy={report_fy} row missing")

            if parsed_ah and abs(parsed_ah - TARGET_AH) < 0.01:
                print(f"  xlsx AH matches target {TARGET_AH:,.2f} — would re-import full matrix")
                if apply and doc:
                    now = datetime.now(timezone.utc)
                    await db.consolidated_summaries.update_one(
                        {"_id": doc["_id"]},
                        {
                            "$set": {
                                "rows": parsed_rows,
                                "source_file": str(XLSX_PATH.name),
                                "updated_at": now,
                            }
                        },
                    )
                    print("  APPLIED full re-import")
            elif cur is not None and abs(cur - TARGET_AH) > 0.01:
                print(f"  patch AH {cur:,.2f} -> {TARGET_AH:,.2f}")
                if apply:
                    result = await db.consolidated_summaries.update_one(
                        {"report_fy": report_fy, "rows.row_key": AH_ROW_KEY},
                        {
                            "$set": {
                                "rows.$[r].values.AH": TARGET_AH,
                                "rows.$[r].imported_total": TARGET_AH,
                            }
                        },
                        array_filters=[{"r.row_key": AH_ROW_KEY}],
                    )
                    print(f"  APPLIED patch matched={result.matched_count} modified={result.modified_count}")
            else:
                print("  no change needed")
    finally:
        client.close()

    if not apply:
        print("\nDRY-RUN only (pass --apply to write)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.apply))


if __name__ == "__main__":
    main()
