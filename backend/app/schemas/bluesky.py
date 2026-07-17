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
    id: Optional[str] = None
    leader_id: str
    fiscal_year: str
    month: str
    month_key: Optional[str] = None
    sort_order: int
    opening: Optional[int] = None
    additional: Optional[int] = None
    converted: Optional[int] = None
    closing: Optional[int] = None
    remarks: str = ""
    has_data: bool = True
    is_current_month: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BlueSkyListResponse(BaseModel):
    data: list[BlueSkyEntryResponse]
    totals: dict
