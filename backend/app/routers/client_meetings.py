from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import Optional
from app.core import database
from app.dependencies.auth import get_current_user, enforce_leader_scope, enforce_leader_write_scope

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
    q1_status: str = ""
    q2_status: str = ""
    q3_status: str = ""
    q4_status: str = ""
    q1_date: str = ""
    q2_date: str = ""
    q3_date: str = ""
    q4_date: str = ""
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
    q1_status: Optional[str] = None
    q2_status: Optional[str] = None
    q3_status: Optional[str] = None
    q4_status: Optional[str] = None
    q1_date: Optional[str] = None
    q2_date: Optional[str] = None
    q3_date: Optional[str] = None
    q4_date: Optional[str] = None
    sort_order: Optional[int] = None


def _serialize(doc: dict) -> dict:
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
        "q1_status": doc.get("q1_status", ""),
        "q2_status": doc.get("q2_status", ""),
        "q3_status": doc.get("q3_status", ""),
        "q4_status": doc.get("q4_status", ""),
        "q1_date": doc.get("q1_date", ""),
        "q2_date": doc.get("q2_date", ""),
        "q3_date": doc.get("q3_date", ""),
        "q4_date": doc.get("q4_date", ""),
        "sort_order": doc.get("sort_order", 0),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
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
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await database.db.client_meetings.insert_one(doc)
    doc["_id"] = result.inserted_id
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
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.client_meetings.find_one_and_update(
        {"_id": ObjectId(meeting_id)}, {"$set": updates}, return_document=True
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
    await database.db.client_meetings.delete_one({"_id": ObjectId(meeting_id)})
    return None
