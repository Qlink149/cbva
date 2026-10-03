from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime

from app.schemas.provenance import DataProvenance

SnapshotType = Literal["fy_actual", "initial", "board", "monthly"]


class PipelineSnapshotCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    label: str
    sort_order: int = 0
    green: int = 0
    amber: Optional[int] = None
    blue_sky: Optional[int] = None
    total: int = 0
    snapshot_type: SnapshotType = "monthly"
    as_of_date: Optional[date] = None
    source: Optional[DataProvenance] = None


class PipelineSnapshotUpdate(BaseModel):
    label: Optional[str] = None
    green: Optional[int] = None
    amber: Optional[int] = None
    blue_sky: Optional[int] = None
    total: Optional[int] = None
    snapshot_type: Optional[SnapshotType] = None
    as_of_date: Optional[date] = None


class PipelineSnapshotResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    label: str
    sort_order: int
    green: int
    amber: Optional[int]
    blue_sky: Optional[int]
    total: int
    snapshot_type: Optional[str] = None
    as_of_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class FyActualUpsert(BaseModel):
    """Manual prior-year actual total for Monthly Plan Evolution (not from consolidated)."""
    leader_id: str
    fiscal_year: str
    total: int = 0
    green: Optional[int] = None
    amber: Optional[int] = None
    blue_sky: Optional[int] = None
