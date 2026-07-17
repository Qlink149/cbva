from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime, timezone
from bson import ObjectId
from app.schemas.bluesky import BlueSkyEntryUpdate, BlueSkyEntryResponse, BlueSkyListResponse
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fy_calendar import (
    FY_MONTH_KEYS,
    get_available_fy_month_keys,
    get_fy_month_calendar_year,
)

router = APIRouter()

MONTH_FULL_NAMES = {
    "04": "April", "05": "May", "06": "June", "07": "July",
    "08": "August", "09": "September", "10": "October", "11": "November",
    "12": "December", "01": "January", "02": "February", "03": "March",
}


def _month_label(month_key: str, fiscal_year: str) -> str:
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    return f"{MONTH_FULL_NAMES.get(month_key, month_key)} {cal_year}"


def _key_from_month_label(month_str: str) -> str | None:
    for key, name in MONTH_FULL_NAMES.items():
        if month_str.startswith(name):
            return key
    return None


def _serialize(doc: dict, *, month_key: str | None = None, is_current_month: bool = False) -> dict:
    mk = month_key or doc.get("month_key") or _key_from_month_label(doc.get("month", ""))
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "month": doc["month"],
        "month_key": mk,
        "sort_order": doc["sort_order"],
        "opening": doc.get("opening"),
        "additional": doc.get("additional"),
        "converted": doc.get("converted"),
        "closing": doc.get("closing"),
        "remarks": doc.get("remarks", ""),
        "has_data": True,
        "is_current_month": is_current_month,
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _empty_month_row(
    *,
    leader_id: str,
    fiscal_year: str,
    month_key: str,
    sort_order: int,
    is_current_month: bool,
) -> dict:
    return {
        "id": None,
        "leader_id": leader_id,
        "fiscal_year": fiscal_year,
        "month": _month_label(month_key, fiscal_year),
        "month_key": month_key,
        "sort_order": sort_order,
        "opening": None,
        "additional": None,
        "converted": None,
        "closing": None,
        "remarks": "",
        "has_data": False,
        "is_current_month": is_current_month,
        "created_at": None,
        "updated_at": None,
    }


@router.get("/", response_model=BlueSkyListResponse)
async def list_bluesky(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Return Opening/Additional/Converted/Closing for FY April → current month.

    Months without a ledger row are included with null values (UI shows '-').
    """
    enforce_leader_scope(current_user, leader_id)

    as_of = date.today()
    available_keys = get_available_fy_month_keys(fiscal_year, as_of)
    current_mk = f"{as_of.month:02d}"

    cursor = database.db.blue_sky_entries.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    )
    docs = await cursor.to_list(length=20)

    by_key: dict[str, dict] = {}
    for doc in docs:
        mk = doc.get("month_key") or _key_from_month_label(doc.get("month", ""))
        if mk:
            by_key[mk] = doc

    rows: list[dict] = []
    for i, mk in enumerate(available_keys):
        is_current = mk == current_mk
        sort_order = i + 1
        existing = by_key.get(mk)
        if existing:
            rows.append(_serialize(existing, month_key=mk, is_current_month=is_current))
        else:
            rows.append(
                _empty_month_row(
                    leader_id=leader_id,
                    fiscal_year=fiscal_year,
                    month_key=mk,
                    sort_order=sort_order,
                    is_current_month=is_current,
                )
            )

    data_rows = [r for r in rows if r.get("has_data")]
    totals = {
        "opening": next((r["opening"] for r in data_rows if r.get("opening") is not None), None),
        "additional": sum(r.get("additional") or 0 for r in data_rows) if data_rows else None,
        "converted": sum(r.get("converted") or 0 for r in data_rows) if data_rows else None,
        "closing": next(
            (r["closing"] for r in reversed(data_rows) if r.get("closing") is not None),
            None,
        ),
    }

    return {"data": rows, "totals": totals}


@router.put("/{entry_id}", response_model=BlueSkyEntryResponse)
async def update_bluesky(
    entry_id: str,
    body: BlueSkyEntryUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.blue_sky_entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="BlueSky entry not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)

    # Keep closing coherent if opening/additional/converted changed without closing
    if any(k in updates for k in ("opening", "additional", "converted")) and "closing" not in updates:
        opening = updates.get("opening", existing.get("opening") or 0)
        additional = updates.get("additional", existing.get("additional") or 0)
        converted = updates.get("converted", existing.get("converted") or 0)
        updates["closing"] = opening + additional - converted

    result = await database.db.blue_sky_entries.find_one_and_update(
        {"_id": ObjectId(entry_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "bluesky_entry", existing, updates, current_user,
        label=existing["month"],
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    mk = result.get("month_key") or _key_from_month_label(result.get("month", ""))
    return _serialize(result, month_key=mk)
