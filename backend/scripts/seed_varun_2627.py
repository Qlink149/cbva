#!/usr/bin/env python3
"""One-off seed: move Varun FY 26-27 dashboard values from frontend hardcodes into the DB.

Replaces the removed HARDCODED_VARUN_2627 overrides in
frontend/src/lib/consolidatedSummary.js with real, editable, audited rows:
  - Board Plan row        -> pipeline_snapshots (snapshot_type="board")
  - Blue-sky ledger       -> blue_sky_entries (April-July 2026)
  - Apr-Jun collections   -> collection_entries (planned + collected)
  - FY 24-25 / FY 25-26 prior-year totals -> consolidated_summaries matrix cells

Idempotent: upserts by natural keys; safe to re-run.
Run AFTER deploying the hardcode removal and BEFORE the go-live baseline snapshot.
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import connect_db, close_db
from app.core import database
from app.services import audit_service

LEADER_ID = "varun"
FY = "2627"

SEED_ACTOR = {
    "_id": "system",
    "full_name": "System — Varun FY26-27 Seed",
    "role": "admin",
    "email": "system@seed",
}

BOARD_PLAN = {
    "label": "Board Plan FY 26-27 (March 2026)",
    "green": 68700000,
    "amber": 41150000,
    "blue_sky": 53150000,
    "total": 163000000,
}

BLUE_SKY_ROWS = [
    {"month": "April 2026", "sort_order": 1, "opening": 52400000, "additional": None, "converted": -1900000, "closing": 54300000},
    {"month": "May 2026", "sort_order": 2, "opening": 54300000, "additional": None, "converted": 8410000, "closing": 45883750},
    {"month": "June 2026", "sort_order": 3, "opening": 45883750, "additional": None, "converted": -2400000, "closing": 48283750},
    {"month": "July 2026", "sort_order": 4, "opening": 48283750, "additional": None, "converted": None, "closing": None},
]

COLLECTIONS = [
    {"month": "April 2026", "sort_order": 1, "planned": 5190250, "collected": 4007824},
    {"month": "May 2026", "sort_order": 2, "planned": 16531250, "collected": 13019506},
    {"month": "June 2026", "sort_order": 3, "planned": 13484500, "collected": 7887504},
]

PRIOR_YEAR_TOTALS = {
    "hist_fy2425_actual": 82695305,
    "hist_fy2526_actual": 126385146,
}


async def _audit(entity_type: str, entity_id, label: str, action: str, changes: list[dict]) -> None:
    await audit_service.log_event(
        entity_type=entity_type,
        entity_id=str(entity_id),
        entity_label=label,
        action=action,
        user=SEED_ACTOR,
        changes=changes,
        leader_id=LEADER_ID,
        fiscal_year=FY,
        source="script",
    )


async def seed_board_plan(now: datetime) -> None:
    key = {"leader_id": LEADER_ID, "fiscal_year": FY, "label": BOARD_PLAN["label"]}
    existing = await database.db.pipeline_snapshots.find_one(key)
    doc = {
        **key,
        "green": BOARD_PLAN["green"],
        "amber": BOARD_PLAN["amber"],
        "blue_sky": BOARD_PLAN["blue_sky"],
        "total": BOARD_PLAN["total"],
        "snapshot_type": "board",
        "sort_order": 0,
        "as_of_date": None,
        "updated_at": now,
    }
    result = await database.db.pipeline_snapshots.update_one(
        key, {"$set": doc, "$setOnInsert": {"created_at": now}}, upsert=True
    )
    entry_id = result.upserted_id or (existing or {}).get("_id")
    action = "updated" if existing else "created"
    changes = [
        {"field": f, "label": f.replace("_", " ").title(), "old": (existing or {}).get(f), "new": BOARD_PLAN[f]}
        for f in ("green", "amber", "blue_sky", "total")
        if (existing or {}).get(f) != BOARD_PLAN[f]
    ]
    if not existing or changes:
        await _audit("pipeline_snapshot", entry_id, BOARD_PLAN["label"], action, changes)
    print(f"pipeline_snapshots: board plan {action}")


async def seed_blue_sky(now: datetime) -> None:
    for row in BLUE_SKY_ROWS:
        key = {"leader_id": LEADER_ID, "fiscal_year": FY, "month": row["month"]}
        existing = await database.db.blue_sky_entries.find_one(key)
        doc = {
            **key,
            "sort_order": row["sort_order"],
            "opening": row["opening"],
            "additional": row["additional"],
            "converted": row["converted"],
            "closing": row["closing"],
            "updated_at": now,
        }
        result = await database.db.blue_sky_entries.update_one(
            key, {"$set": doc, "$setOnInsert": {"remarks": "", "created_at": now}}, upsert=True
        )
        entry_id = result.upserted_id or (existing or {}).get("_id")
        action = "updated" if existing else "created"
        changes = [
            {"field": f, "label": f.title(), "old": (existing or {}).get(f), "new": row[f]}
            for f in ("opening", "additional", "converted", "closing")
            if (existing or {}).get(f) != row[f]
        ]
        if not existing or changes:
            await _audit("bluesky_entry", entry_id, row["month"], action, changes)
        print(f"blue_sky_entries: {row['month']} {action}")


async def seed_collections(now: datetime) -> None:
    for row in COLLECTIONS:
        key = {"leader_id": LEADER_ID, "fiscal_year": FY, "month": row["month"]}
        existing = await database.db.collection_entries.find_one(key)
        doc = {
            **key,
            "sort_order": row["sort_order"],
            "planned": row["planned"],
            "collected": row["collected"],
            "variance": row["collected"] - row["planned"],
            "updated_at": now,
        }
        result = await database.db.collection_entries.update_one(
            key,
            {"$set": doc, "$setOnInsert": {"outstanding": None, "remarks": "", "created_at": now}},
            upsert=True,
        )
        entry_id = result.upserted_id or (existing or {}).get("_id")
        action = "updated" if existing else "created"
        changes = [
            {"field": f, "label": f.title(), "old": (existing or {}).get(f), "new": row[f]}
            for f in ("planned", "collected")
            if (existing or {}).get(f) != row[f]
        ]
        if not existing or changes:
            await _audit("collection", entry_id, row["month"], action, changes)
        print(f"collection_entries: {row['month']} {action}")


async def seed_prior_year_totals() -> None:
    """Set Varun's FY 24-25 / FY 25-26 actual totals in the consolidated matrix."""
    summary = await database.db.consolidated_summaries.find_one({"report_fy": FY})
    if not summary:
        print(f"consolidated_summaries: no doc for report_fy={FY} — SKIPPED "
              "(prior-year rows will show '—' until the consolidated import runs)")
        return

    code = None
    for col in summary.get("columns", []):
        if col.get("leader_id") == LEADER_ID:
            code = col.get("code")
            break
    if not code:
        print(f"consolidated_summaries: no column mapped to leader '{LEADER_ID}' — SKIPPED")
        return

    changes = []
    rows = summary.get("rows", [])
    for row in rows:
        target = PRIOR_YEAR_TOTALS.get(row.get("row_key"))
        if target is None:
            continue
        old = (row.get("values") or {}).get(code)
        if old != target:
            row.setdefault("values", {})[code] = target
            changes.append({"field": f"{row['row_key']}.{code}",
                            "label": row.get("label", row["row_key"]),
                            "old": old, "new": target})

    if not changes:
        print("consolidated_summaries: prior-year totals already correct")
        return

    await database.db.consolidated_summaries.update_one(
        {"_id": summary["_id"]},
        {"$set": {"rows": rows, "updated_at": datetime.now(timezone.utc)}},
    )
    await _audit("consolidated_summary", summary["_id"],
                 f"Consolidated FY {FY} — Varun prior-year totals", "updated", changes)
    print(f"consolidated_summaries: set {len(changes)} prior-year cell(s) for column {code}")


async def main() -> None:
    await connect_db()
    if database.db is None:
        print("ERROR: could not connect to MongoDB — check MONGODB_URL")
        sys.exit(1)
    now = datetime.now(timezone.utc)
    await seed_board_plan(now)
    await seed_blue_sky(now)
    await seed_collections(now)
    await seed_prior_year_totals()
    await close_db()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
