"""New Clients list: audit-derived engagements + manual entries from additional_work."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.schemas.additional_work import AdditionalWorkCreate, AdditionalWorkResponse
from app.services.fiscal_year import assert_fy_editable, assert_month_unlocked
from app.services.fy_calendar import FY_MONTH_KEYS
from app.services import audit_service

router = APIRouter()


async def _audit_derived_rows(leader_id: str, fiscal_year: str) -> list[dict]:
    cursor = database.db.audit_log.find(
        {
            "entity_type": "engagement",
            "action": "created",
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
        }
    ).sort("created_at", -1)
    audit_docs = await cursor.to_list(length=500)

    seen: set[str] = set()
    ordered_ids: list[str] = []
    created_at_by_id: dict[str, object] = {}
    for a in audit_docs:
        eid = str(a.get("entity_id") or "")
        if not eid or eid in seen:
            continue
        seen.add(eid)
        ordered_ids.append(eid)
        created_at_by_id[eid] = a.get("created_at")

    if not ordered_ids:
        return []

    oids = []
    for eid in ordered_ids:
        try:
            oids.append(ObjectId(eid))
        except Exception:
            continue

    eng_docs = await database.db.engagements.find(
        {"_id": {"$in": oids}, "leader_id": leader_id, "fiscal_year": fiscal_year}
    ).to_list(length=500)
    by_id = {str(d["_id"]): d for d in eng_docs}

    rows = []
    for eid in ordered_ids:
        eng = by_id.get(eid)
        if not eng or eng.get("is_archived"):
            continue
        rows.append(
            {
                "id": eid,
                "source": "engagement",
                "leader_id": eng["leader_id"],
                "fiscal_year": eng["fiscal_year"],
                "name": eng.get("name", ""),
                "num": eng.get("num"),
                "green": eng.get("green", 0),
                "amber": eng.get("amber", 0),
                "blue_sky": eng.get("blue_sky", 0),
                "total": eng.get("total", 0),
                "el_status": eng.get("el_status", "NA"),
                "logged_month": None,
                "nature_of_work": "",
                "created_at": serialize_datetime(created_at_by_id.get(eid) or eng.get("created_at")),
            }
        )
    return rows


@router.get("/")
async def list_new_clients(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    rows = await _audit_derived_rows(leader_id, fiscal_year)

    manual_cursor = database.db.additional_work.find(
        {
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "entry_type": "new_client",
        }
    ).sort([("logged_month", 1), ("client_name", 1)])
    manual_docs = await manual_cursor.to_list(length=500)
    for doc in manual_docs:
        rows.append(
            {
                "id": str(doc["_id"]),
                "source": "manual",
                "leader_id": doc["leader_id"],
                "fiscal_year": doc["fiscal_year"],
                "name": doc.get("client_name", ""),
                "num": None,
                "green": 0,
                "amber": 0,
                "blue_sky": 0,
                "total": 0,
                "el_status": "NA",
                "logged_month": doc.get("logged_month") or doc.get("month_key"),
                "nature_of_work": doc.get("nature_of_work", ""),
                "created_at": serialize_datetime(doc.get("created_at")),
            }
        )

    return {"data": rows}


@router.post("/", response_model=AdditionalWorkResponse, status_code=201)
async def create_manual_new_client(
    body: AdditionalWorkCreate,
    current_user: dict = Depends(get_current_user),
):
    """Manual new-client entry (distinct from audit-derived engagement creates)."""
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)
    month_key = body.logged_month or body.month_key
    if month_key not in FY_MONTH_KEYS:
        raise HTTPException(status_code=400, detail="Invalid logged_month")
    assert_month_unlocked(body.fiscal_year, month_key, current_user)

    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc["entry_type"] = "new_client"
    doc["month_key"] = month_key
    doc["logged_month"] = month_key
    doc["amount"] = doc.get("amount") or 0
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await database.db.additional_work.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "additional_work", doc, current_user,
        label=body.client_name,
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    from app.routers.additional_work import _serialize
    return _serialize(doc)
