from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BlueSkyEntryUpdate(BaseModel):
    opening: Optional[int] = None
    additional: Optional[int] = None
    converted: Optional[int] = None
    closing: Optional[int] = None
    remarks: Optional[str] = None


class BlueSkyEntryResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    month: str
    sort_order: int
    opening: int
    additional: Optional[int]
    converted: int
    closing: int
    remarks: str
    created_at: datetime
    updated_at: datetime


class BlueSkyListResponse(BaseModel):
    data: list[BlueSkyEntryResponse]
    totals: dict
