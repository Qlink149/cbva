"""Fiscal year helpers — DB is source of truth."""

from fastapi import HTTPException
from app.core import database


def serialize_financial_year(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "slug": doc["slug"],
        "label": doc.get("label", doc["slug"]),
        "is_current": doc.get("is_current", False),
        "is_active": doc.get("is_active", True),
        "sort_order": doc.get("sort_order", 0),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


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
