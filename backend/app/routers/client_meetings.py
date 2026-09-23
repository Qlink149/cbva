from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import Optional
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope
from app.services import audit_service
from app.services.fiscal_year import assert_fy_editable
from app.services.client_meeting_months import resolve_monthly_status, merge_monthly_status

router = APIRouter()


class ClientMeetingCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    client_name: str = Field(..., min_length=1)
    meeting_frequency: str = "Quarterly"
    dates_till_period: str = ""
    next_period: str = ""
    responsible_person: str = ""
    activity: str = ""
    notes: str = ""
    minutes: str = ""
    monthly_status: dict[str, dict] = Field(default_factory=dict)
    sort_order: int = 0


class ClientMeetingUpdate(BaseModel):
    client_name: Optional[str] = None
    meeting_frequency: Optional[str] = None
    dates_till_period: Optional[str] = None
    next_period: Optional[str] = None
    responsible_person: Optional[str] = None
    activity: Optional[str] = None
    notes: Optional[str] = None
    minutes: Optional[str] = None
    monthly_status: Optional[dict[str, dict]] = None
    sort_order: Optional[int] = None


def _serialize(doc: dict) -> dict:
    monthly = resolve_monthly_status(doc)
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "client_name": doc.get("client_name", ""),
        "meeting_frequency": doc.get("meeting_frequency", ""),
        "dates_till_period": doc.get("dates_till_period", ""),
        "next_period": doc.get("next_period", ""),
        "responsible_person": doc.get("responsible_person", ""),
        "activity": doc.get("activity", ""),
        "notes": doc.get("notes", ""),
        "minutes": doc.get("minutes", ""),
        "monthly_status": monthly,
        "sort_order": doc.get("sort_order", 0),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


@router.get("/")
async def list_client_meetings(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    cursor = database.db.client_meetings.find(
        {"leader_id": leader_id, "fiscal_year": fiscal_year}
    ).sort("sort_order", 1)
    docs = await cursor.to_list(length=500)
    return {"data": [_serialize(d) for d in docs]}


@router.post("/", status_code=201)
async def create_client_meeting(
    body: ClientMeetingCreate,
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_write_scope(current_user, body.leader_id)
    await assert_fy_editable(body.fiscal_year, current_user)
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc["monthly_status"] = merge_monthly_status({}, body.monthly_status)
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await database.db.client_meetings.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "client_meeting", doc, current_user,
        label=body.client_name,
        leader_id=body.leader_id,
        fiscal_year=body.fiscal_year,
    )
    return _serialize(doc)


@router.put("/{meeting_id}")
async def update_client_meeting(
    meeting_id: str,
    body: ClientMeetingUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.client_meetings.find_one({"_id": ObjectId(meeting_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Client meeting not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if body.monthly_status is not None:
        updates["monthly_status"] = merge_monthly_status(existing, body.monthly_status)
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.client_meetings.find_one_and_update(
        {"_id": ObjectId(meeting_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "client_meeting", existing, updates, current_user,
        label=existing.get("client_name", ""),
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return _serialize(result)


@router.delete("/{meeting_id}", status_code=204)
async def delete_client_meeting(
    meeting_id: str,
    current_user: dict = Depends(get_current_user),
):
    existing = await database.db.client_meetings.find_one({"_id": ObjectId(meeting_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Client meeting not found")
    enforce_leader_write_scope(current_user, existing["leader_id"])
    await assert_fy_editable(existing["fiscal_year"], current_user)
    await database.db.client_meetings.delete_one({"_id": ObjectId(meeting_id)})
    await audit_service.log_delete(
        "client_meeting", existing, current_user,
        label=existing.get("client_name", ""),
        leader_id=existing["leader_id"],
        fiscal_year=existing["fiscal_year"],
    )
    return None
