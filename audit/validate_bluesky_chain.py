"""Read-only validation of blue_sky_entries chain Apr-Aug 2026 (FY2627).

Run: python audit/validate_bluesky_chain.py  (uses backend/.env)
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_util import get_db, MONTH_LABEL_TO_KEY  # noqa: E402

FISCAL_YEAR = "2627"
MONTHS = ["April 2026", "May 2026", "June 2026", "July 2026", "August 2026"]
MONTH_KEYS = ["04", "05", "06", "07", "08"]
TOL = 1.0


async def ga_sum(db, leader_id: str, month_key: str) -> int | None:
    name = next((n for n, k in MONTH_LABEL_TO_KEY.items() if k == month_key), None)
    if not name:
        return None
    label = f"{name} 2026"
    snap = await db.pipeline_snapshots.find_one({
        "leader_id": leader_id,
        "fiscal_year": FISCAL_YEAR,
        "snapshot_type": "monthly",
        "label": label,
    })
    if not snap:
        return None
    return int(snap.get("green") or 0) + int(snap.get("amber") or 0)


async def main() -> None:
    client, db = get_db()
    failures: list[dict] = []
    try:
        leaders = sorted({d["leader_id"] async for d in db.blue_sky_entries.find({"fiscal_year": FISCAL_YEAR})})

        for leader_id in leaders:
            entries = {}
            async for doc in db.blue_sky_entries.find({"leader_id": leader_id, "fiscal_year": FISCAL_YEAR}):
                entries[doc.get("month", "")] = doc

            prev_closing = None
            for i, month_label in enumerate(MONTHS):
                entry = entries.get(month_label)
                if not entry:
                    failures.append({
                        "leader_id": leader_id,
                        "month": month_label,
                        "rule": "missing_entry",
                        "detail": "No blue_sky_entries row",
                    })
                    prev_closing = None
                    continue

                opening = float(entry.get("opening") or 0)
                additional = float(entry.get("additional") or 0)
                converted = float(entry.get("converted") or 0)
                closing = float(entry.get("closing") or 0)

                if prev_closing is not None and abs(opening - prev_closing) > TOL:
                    failures.append({
                        "leader_id": leader_id,
                        "month": month_label,
                        "rule": "opening_eq_prior_closing",
                        "stored_opening": opening,
                        "prior_closing": prev_closing,
                        "diff": opening - prev_closing,
                    })

                if abs(closing - (opening + additional - converted)) > TOL:
                    failures.append({
                        "leader_id": leader_id,
                        "month": month_label,
                        "rule": "closing_identity",
                        "opening": opening,
                        "additional": additional,
                        "converted": converted,
                        "stored_closing": closing,
                        "expected_closing": opening + additional - converted,
                    })

                if abs(additional - (closing - opening + converted)) > TOL:
                    failures.append({
                        "leader_id": leader_id,
                        "month": month_label,
                        "rule": "additional_formula",
                        "stored_additional": additional,
                        "expected_additional": closing - opening + converted,
                    })

                if i + 1 < len(MONTH_KEYS):
                    ga_now = await ga_sum(db, leader_id, MONTH_KEYS[i])
                    ga_next = await ga_sum(db, leader_id, MONTH_KEYS[i + 1])
                    if ga_now is not None and ga_next is not None:
                        expected_conv = ga_next - ga_now
                        if abs(converted - expected_conv) > TOL:
                            failures.append({
                                "leader_id": leader_id,
                                "month": month_label,
                                "rule": "converted_from_pipeline",
                                "stored_converted": converted,
                                "expected_converted": expected_conv,
                                "ga_this_month": ga_now,
                                "ga_next_month": ga_next,
                            })

                prev_closing = closing

        out = Path(__file__).resolve().parent / "bluesky_chain_validation.json"
        payload = {"fiscal_year": FISCAL_YEAR, "months": MONTHS, "failure_count": len(failures), "failures": failures}
        out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        print(f"Leaders checked: {len(leaders)}")
        print(f"Chain failures: {len(failures)}")
        for f in failures[:30]:
            print(f"  {f['leader_id']} {f['month']} {f['rule']}")
        print(f"Written: {out}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
