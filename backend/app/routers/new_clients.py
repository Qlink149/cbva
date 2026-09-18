"""Read-only New Clients list: engagements created this FY (from audit_log), joined to engagements."""
from fastapi import APIRouter, Depends, Query
from bson import ObjectId

from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope

router = APIRouter()


@router.get("/")
async def list_new_clients(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Engagements created for this leader+FY, derived from audit_log creates + live engagement docs."""
    enforce_leader_scope(current_user, leader_id)

    cursor = database.db.audit_log.find(
        {
            "entity_type": "engagement",
            "action": "created",
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
        }
    ).sort("created_at", -1)
    audit_docs = await cursor.to_list(length=500)

    # Preserve first-seen order (newest create first); dedupe by entity_id
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
        return {"data": []}

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
        if not eng:
            continue
        if eng.get("is_archived"):
            continue
        rows.append(
            {
                "id": eid,
                "leader_id": eng["leader_id"],
                "fiscal_year": eng["fiscal_year"],
                "name": eng.get("name", ""),
                "num": eng.get("num"),
                "green": eng.get("green", 0),
                "amber": eng.get("amber", 0),
                "blue_sky": eng.get("blue_sky", 0),
                "total": eng.get("total", 0),
                "el_status": eng.get("el_status", "NA"),
                "created_at": serialize_datetime(created_at_by_id.get(eid) or eng.get("created_at")),
            }
        )

    return {"data": rows}
