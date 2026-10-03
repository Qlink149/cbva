from fastapi import APIRouter, Depends, Query
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope

router = APIRouter()


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc.get("fiscal_year"),
        "record_type": doc.get("record_type", "cit_a"),
        "group": doc.get("group", ""),
        "assessee_name": doc.get("assessee_name", ""),
        "ay": doc.get("ay", ""),
        "pan": doc.get("pan", ""),
        "charge_or_nfac": doc.get("charge_or_nfac", ""),
        "ao_name": doc.get("ao_name", ""),
        "addl_comm_name": doc.get("addl_comm_name", ""),
        "cit_name": doc.get("cit_name", ""),
        "time_barring": doc.get("time_barring", ""),
        "status": doc.get("status", ""),
        "remarks": doc.get("remarks", ""),
        "sort_order": doc.get("sort_order", 0),
        "is_shared_template": doc.get("is_shared_template", False),
        "content_hash": doc.get("content_hash", ""),
        "created_at": serialize_datetime(doc["created_at"]),
        "updated_at": serialize_datetime(doc["updated_at"]),
    }


@router.get("/", response_model=dict)
async def list_assessments(
    leader_id: str = Query(...),
    fiscal_year: str = Query(None),
    include_shared: bool = Query(True),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    query: dict = {"leader_id": leader_id}
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    cursor = database.db.assessments.find(query).sort("sort_order", 1)
    docs = await cursor.to_list(length=500)
    if include_shared:
        shared_query: dict = {"leader_id": "firmwide", "is_shared_template": True}
        if fiscal_year:
            shared_query["fiscal_year"] = fiscal_year
        shared = await database.db.assessments.find(shared_query).sort("sort_order", 1).to_list(length=500)
        docs = shared + docs
    return {"data": [_serialize(d) for d in docs]}
