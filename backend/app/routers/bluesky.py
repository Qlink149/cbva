from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime, timezone
from bson import ObjectId
from app.schemas.bluesky import (
    BlueSkyEntryUpdate,
    BlueSkyEntryUpsert,
    BlueSkyEntryResponse,
    BlueSkyListResponse,
)
from app.core import database
from app.core.serialization import serialize_datetime
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
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
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


async def _prior_closing(leader_id: str, fiscal_year: str, month_key: str) -> int:
    if month_key not in FY_MONTH_KEYS:
        return 0
    cur_idx = FY_MONTH_KEYS.index(month_key)
    for prev_key in reversed(FY_MONTH_KEYS[:cur_idx]):
        prev_label = _month_label(prev_key, fiscal_year)
        prev_entry = await database.db.blue_sky_entries.find_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "month": prev_label}
        )
        if prev_entry and prev_entry.get("closing") is not None:
            return prev_entry.get("closing") or 0
        prev_by_key = await database.db.blue_sky_entries.find_one(
            {"leader_id": leader_id, "fiscal_year": fiscal_year, "month_key": prev_key}
        )
        if prev_by_key and prev_by_key.get("closing") is not None:
            return prev_by_key.get("closing") or 0
    return 0


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


@router.post("/", response_model=BlueSkyEntryResponse, status_code=201)
async def upsert_bluesky(
    body: BlueSkyEntryUpsert,
    current_user: dict = Depends(get_current_user),
):
    """Create or update a Blue Sky ledger row for any available FY month (incl. prior months)."""
    enforce_leader_write_scope(current_user, body.leader_id)

    if body.month_key not in FY_MONTH_KEYS:
        raise HTTPException(status_code=400, detail="Invalid month_key")

    as_of = date.today()
    available = get_available_fy_month_keys(body.fiscal_year, as_of)
    if body.month_key not in available:
        raise HTTPException(status_code=400, detail="Month is outside the editable FY window")

    month_label = _month_label(body.month_key, body.fiscal_year)
    sort_order = FY_MONTH_KEYS.index(body.month_key) + 1
    now = datetime.now(timezone.utc)

    existing = await database.db.blue_sky_entries.find_one(
        {
            "$or": [
                {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year, "month_key": body.month_key},
                {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year, "month": month_label},
            ]
        }
    )

    if existing:
        updates = {
            k: v
            for k, v in body.model_dump().items()
            if k not in ("leader_id", "fiscal_year", "month_key") and v is not None
        }
        updates["month_key"] = body.month_key
        updates["month"] = month_label
        updates["sort_order"] = sort_order
        updates["updated_at"] = now
        if any(k in updates for k in ("opening", "additional", "converted")) and "closing" not in updates:
            opening = updates.get("opening", existing.get("opening") or 0)
            additional = updates.get("additional", existing.get("additional") or 0)
            converted = updates.get("converted", existing.get("converted") or 0)
            updates["closing"] = opening + additional - converted
        result = await database.db.blue_sky_entries.find_one_and_update(
            {"_id": existing["_id"]}, {"$set": updates}, return_document=True
        )
        await audit_service.log_update(
            "bluesky_entry", existing, updates, current_user,
            label=month_label,
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
        )
        return _serialize(result, month_key=body.month_key)

    opening = body.opening if body.opening is not None else await _prior_closing(
        body.leader_id, body.fiscal_year, body.month_key
    )
    additional = body.additional if body.additional is not None else 0
    converted = body.converted if body.converted is not None else 0
    closing = opening + additional - converted
    remarks = body.remarks if body.remarks is not None else ""

    doc = {
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "month": month_label,
        "month_key": body.month_key,
        "sort_order": sort_order,
        "opening": opening,
        "additional": additional,
        "converted": converted,
        "closing": closing,
        "remarks": remarks,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.blue_sky_entries.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "bluesky_entry", doc, current_user,
        label=month_label,
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc, month_key=body.month_key)


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
