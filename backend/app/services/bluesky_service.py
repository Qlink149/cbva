"""Blue Sky ledger helpers (converted MoM from pipeline snapshots)."""
from __future__ import annotations

from app.core import database
from app.services.fy_calendar import FY_MONTH_KEYS, get_fy_month_calendar_year

MONTH_FULL_NAMES = {
    "04": "April", "05": "May", "06": "June", "07": "July",
    "08": "August", "09": "September", "10": "October", "11": "November",
    "12": "December", "01": "January", "02": "February", "03": "March",
}


def _month_label(month_key: str, fiscal_year: str) -> str:
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    return f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"


def _prior_fy_slug(fiscal_year: str) -> str | None:
    if not fiscal_year or len(fiscal_year) != 4:
        return None
    try:
        start = int(fiscal_year[:2])
        end = int(fiscal_year[2:])
    except ValueError:
        return None
    return f"{start - 1:02d}{end - 1:02d}"


def _next_fy_slug(fiscal_year: str) -> str | None:
    if not fiscal_year or len(fiscal_year) != 4:
        return None
    try:
        start = int(fiscal_year[:2])
        end = int(fiscal_year[2:])
    except ValueError:
        return None
    return f"{start + 1:02d}{end + 1:02d}"


def prior_month_key(fiscal_year: str, month_key: str) -> tuple[str, str] | None:
    """Return (fiscal_year, month_key) for the previous FY month.

    April → March of prior FY; otherwise previous key in FY_MONTH_KEYS same FY.
    """
    if month_key not in FY_MONTH_KEYS:
        return None
    idx = FY_MONTH_KEYS.index(month_key)
    if idx > 0:
        return fiscal_year, FY_MONTH_KEYS[idx - 1]
    prior_fy = _prior_fy_slug(fiscal_year)
    if not prior_fy:
        return None
    return prior_fy, "03"


def next_month_key(fiscal_year: str, month_key: str) -> tuple[str, str] | None:
    """Return (fiscal_year, month_key) for the next FY month.

    March → April of the following FY; otherwise the next key in FY_MONTH_KEYS.
    """
    if month_key not in FY_MONTH_KEYS:
        return None
    idx = FY_MONTH_KEYS.index(month_key)
    if idx < len(FY_MONTH_KEYS) - 1:
        return fiscal_year, FY_MONTH_KEYS[idx + 1]
    next_fy = _next_fy_slug(fiscal_year)
    if not next_fy:
        return None
    return next_fy, "04"


async def _pipeline_green_amber(leader_id: str, fiscal_year: str, month_key: str) -> int | None:
    """Sum green+amber from a monthly pipeline snapshot; None if snapshot missing."""
    label = _month_label(month_key, fiscal_year)
    snap = await database.db.pipeline_snapshots.find_one(
        {
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "label": label,
            "snapshot_type": "monthly",
        }
    )
    if not snap:
        snap = await database.db.pipeline_snapshots.find_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "label": label}
        )
    if not snap:
        return None
    return int(snap.get("green") or 0) + int(snap.get("amber") or 0)


async def compute_converted_from_pipeline(
    leader_id: str,
    fiscal_year: str,
    month_key: str,
) -> int | None:
    """Converted for month M = (ΣG+ΣA)[M+1] − (ΣG+ΣA)[M], leader aggregate ₹.

    Nikhil pipeline-movement rule (Sep 2026): movement attributed to month M uses
    the next month's pipeline snapshot minus this month's. Returns None if either
    monthly pipeline snapshot is missing. Does not rewrite ledger rows by itself.
    """
    nxt = next_month_key(fiscal_year, month_key)
    if not nxt:
        return None
    next_fy, next_mk = nxt
    current = await _pipeline_green_amber(leader_id, fiscal_year, month_key)
    following = await _pipeline_green_amber(leader_id, next_fy, next_mk)
    if current is None or following is None:
        return None
    return following - current
