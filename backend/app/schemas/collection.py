from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CollectionEntryUpdate(BaseModel):
    planned: Optional[int] = None
    collected: Optional[int] = None
    outstanding: Optional[int] = None
    remarks: Optional[str] = None


class CollectionEntryResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    month: str
    sort_order: int
    planned: int
    collected: int
    outstanding: Optional[int]
    variance: int
    created_at: datetime
    updated_at: datetime


class CollectionListResponse(BaseModel):
    data: list[CollectionEntryResponse]
    total_collected: int
