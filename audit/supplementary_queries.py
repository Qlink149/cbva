"""One-off read-only supplementary queries for meeting commitments report."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_util import get_db  # noqa: E402

SHEET_FY2526 = 703_672_234
SHEET_AUG_FIRM = 1_016_635_020


async def eng_aggregate(db, leader_id: str, fy: str) -> dict:
    pipe = [
        {"$match": {"leader_id": leader_id, "fiscal_year": fy, "is_archived": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "green": {"$sum": "$green"},
            "amber": {"$sum": "$amber"},
            "blue_sky": {"$sum": "$blue_sky"},
            "total": {"$sum": "$total"},
        }},
    ]
    rows = await db.engagements.aggregate(pipe).to_list(1)
    return rows[0] if rows else {}


async def snap_month(db, leader_id: str, label: str) -> dict | None:
    return await db.pipeline_snapshots.find_one({
        "leader_id": leader_id,
        "fiscal_year": "2627",
        "snapshot_type": "monthly",
        "label": label,
    })


async def main() -> None:
    client, db = get_db()
    try:
        out: dict = {}

        out["el_status_distinct"] = await db.engagements.distinct("el_status")
        out["el_status_retired_count"] = await db.engagements.count_documents(
            {"el_status": {"$in": ["DS", "BS", "-", "Waved"]}}
        )

        fys = await db.financial_years.find({}).sort("sort_order", 1).to_list(20)
        out["financial_years"] = [
            {"slug": f.get("slug"), "is_editable": f.get("is_editable"), "is_current": f.get("is_current")}
            for f in fys
        ]

        r = await db.collection_entries.aggregate([
            {"$match": {"fiscal_year": "2526"}},
            {"$group": {"_id": None, "total": {"$sum": "$collected"}}},
        ]).to_list(1)
        firm_2526 = int(r[0]["total"]) if r else 0
        out["fy2526_collection_entries_firm_total"] = firm_2526
        out["fy2526_gap_vs_sheet"] = firm_2526 - SHEET_FY2526

        leaders_missing = []
        for code in ["sp", "vp", "ak", "biu"]:
            l = await db.leaders.find_one({"_id": code})
            leaders_missing.append({"id": code, "name": l.get("name") if l else None, "exists": l is not None})
        out["leaders_sp_vp_ak_biu"] = leaders_missing

        out["engagement_actions_count"] = await db.engagement_actions.count_documents({})
        out["additional_work_count"] = await db.additional_work.count_documents({})
        out["engagement_change_log_count"] = await db.engagement_change_log.count_documents({})

        # D5 NP / RT Jul vs Aug
        d5 = {}
        for lid in ["np", "rt"]:
            eng = await eng_aggregate(db, lid, "2627")
            jul_snap = await snap_month(db, lid, "July 2026")
            aug_snap = await snap_month(db, lid, "August 2026")
            d5[lid] = {
                "engagements": {k: eng.get(k, 0) for k in ("green", "amber", "blue_sky", "total")},
                "july_snap": {
                    "green": jul_snap.get("green") if jul_snap else None,
                    "amber": jul_snap.get("amber") if jul_snap else None,
                    "blue_sky": jul_snap.get("blue_sky") if jul_snap else None,
                    "total": jul_snap.get("total") if jul_snap else None,
                },
                "aug_snap": {
                    "green": aug_snap.get("green") if aug_snap else None,
                    "amber": aug_snap.get("amber") if aug_snap else None,
                    "blue_sky": aug_snap.get("blue_sky") if aug_snap else None,
                    "total": aug_snap.get("total") if aug_snap else None,
                },
                "eng_bs_vs_aug_snap_bs": (
                    (eng.get("blue_sky") or 0) - (aug_snap.get("blue_sky") or 0) if aug_snap else None
                ),
            }
        out["d5_np_rt"] = d5

        # Firm Aug 2026 snap sum
        aug_snaps = await db.pipeline_snapshots.find({
            "fiscal_year": "2627", "snapshot_type": "monthly", "label": "August 2026",
        }).to_list(50)
        firm_aug = sum(int(s.get("total") or 0) for s in aug_snaps)
        out["firm_aug_2026_snap_total"] = firm_aug
        out["firm_aug_gap_vs_sheet"] = firm_aug - SHEET_AUG_FIRM

        # AK board snap
        ak_board = await db.pipeline_snapshots.find_one({
            "leader_id": "ak", "fiscal_year": "2627", "snapshot_type": "board",
        })
        out["ak_board_snap"] = {
            "green": ak_board.get("green") if ak_board else None,
            "total": ak_board.get("total") if ak_board else None,
        } if ak_board else None

        path = Path(__file__).resolve().parent / "supplementary_queries.json"
        path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
        print(json.dumps(out, indent=2, default=str))
        print(f"Written: {path}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
