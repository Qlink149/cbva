"""Fiscal year helpers — DB is source of truth."""

from datetime import datetime, timezone, date
from fastapi import HTTPException
from app.core import database
from app.core.serialization import serialize_datetime


def calendar_fy_slug(as_of: date | None = None) -> str:
    """Indian FY slug (Apr–Mar), e.g. Jul 2026 → '2627'."""
    d = as_of or date.today()
    if d.month >= 4:
        start = d.year % 100
        end = (d.year + 1) % 100
    else:
        start = (d.year - 1) % 100
        end = d.year % 100
    return f"{start:02d}{end:02d}"


def serialize_financial_year(doc: dict) -> dict:
    is_current = doc.get("is_current", False)
    is_editable = doc.get("is_editable")
    if is_editable is None:
        is_editable = is_current
    return {
        "id": str(doc["_id"]),
        "slug": doc["slug"],
        "label": doc.get("label", doc["slug"]),
        "is_current": is_current,
        "is_active": doc.get("is_active", True),
        "is_editable": is_editable,
        "sort_order": doc.get("sort_order", 0),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


async def is_fy_editable(fiscal_year: str, user: dict | None = None) -> bool:
    if user and user.get("role") == "admin":
        return True
    doc = await database.db.financial_years.find_one({"slug": fiscal_year})
    if not doc:
        return False
    is_editable = doc.get("is_editable")
    if is_editable is None:
        is_editable = doc.get("is_current", False)
    return bool(is_editable)


async def assert_fy_editable(fiscal_year: str, user: dict) -> None:
    if await is_fy_editable(fiscal_year, user):
        return
    raise HTTPException(
        status_code=403,
        detail="This fiscal year is locked for editing. Ask an admin to enable editing in Admin Settings.",
    )


async def list_active_financial_years() -> list[dict]:
    cursor = database.db.financial_years.find({"is_active": {"$ne": False}}).sort(
        [("sort_order", 1), ("slug", 1)]
    )
    docs = await cursor.to_list(length=50)
    return [serialize_financial_year(d) for d in docs]


async def validate_fiscal_year_slug(slug: str) -> str:
    doc = await database.db.financial_years.find_one({"slug": slug, "is_active": {"$ne": False}})
    if not doc:
        raise HTTPException(status_code=400, detail=f"Invalid or inactive fiscal year: {slug}")
    return slug


async def ensure_current_fy_matches_calendar() -> None:
    """Advance is_current to today's calendar FY when the registry has fallen behind.

    Does not override an admin who intentionally set a *future* FY as current.
    """
    calendar = calendar_fy_slug()
    calendar_doc = await database.db.financial_years.find_one(
        {"slug": calendar, "is_active": {"$ne": False}}
    )
    if not calendar_doc:
        return

    current_doc = await database.db.financial_years.find_one({"is_current": True})
    if current_doc and current_doc.get("slug") == calendar:
        # Keep current FY editable if flag was never set
        if calendar_doc.get("is_editable") is None:
            await database.db.financial_years.update_one(
                {"_id": calendar_doc["_id"]},
                {"$set": {"is_editable": True}},
            )
        return

    # Don't pull current backward if admin set a future FY as current
    if current_doc and str(current_doc.get("slug", "")) > calendar:
        return

    now = datetime.now(timezone.utc)
    await database.db.financial_years.update_many(
        {},
        {"$set": {"is_current": False, "updated_at": now}},
    )
    await database.db.financial_years.update_one(
        {"_id": calendar_doc["_id"]},
        {
            "$set": {
                "is_current": True,
                "is_editable": True,
                "updated_at": now,
            }
        },
    )
    # Lock prior years that never had an explicit editable flag
    await database.db.financial_years.update_many(
        {
            "slug": {"$ne": calendar},
            "$or": [
                {"is_editable": {"$exists": False}},
                {"is_editable": None},
            ],
        },
        {"$set": {"is_editable": False, "updated_at": now}},
    )
