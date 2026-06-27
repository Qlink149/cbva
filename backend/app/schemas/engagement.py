from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

from app.schemas.provenance import DataProvenance

ELStatus = Literal["Signed", "Not Signed", "Waived", "NA", "DS", "—"]
FiscalYear = str


class EngagementCreate(BaseModel):
    leader_id: str
    fiscal_year: FiscalYear
    name: str = Field(..., min_length=1)
    model: str = "—"
    rel_partner: str = ""
    el_status: ELStatus = "—"
    green: int = Field(0, ge=0)
    amber: int = Field(0, ge=0)
    blue_sky: int = Field(0, ge=0)
    collected: int = Field(0, ge=0)
    may_col: Optional[int] = None
    june_col: Optional[int] = None
    july_col: Optional[int] = None
    august_col: Optional[int] = None
    person_responsible: str = ""
    originator: str = ""
    assignment_type: str = ""
    collections_fy2526: Optional[int] = None
    remarks: str = ""
    source: Optional[DataProvenance] = None


class EngagementUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    rel_partner: Optional[str] = None
    el_status: Optional[ELStatus] = None
    green: Optional[int] = Field(None, ge=0)
    amber: Optional[int] = Field(None, ge=0)
    blue_sky: Optional[int] = Field(None, ge=0)
    collected: Optional[int] = Field(None, ge=0)
    may_col: Optional[int] = None
    june_col: Optional[int] = None
    july_col: Optional[int] = None
    august_col: Optional[int] = None
    person_responsible: Optional[str] = None
    originator: Optional[str] = None
    assignment_type: Optional[str] = None
    collections_fy2526: Optional[int] = None
    remarks: Optional[str] = None


class RemarksUpdate(BaseModel):
    remarks: str


class EngagementResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    num: int
    name: str
    model: str
    rel_partner: str
    el_status: str
    green: int
    amber: int
    blue_sky: int
    total: int
    collected: int
    may_col: Optional[int]
    june_col: Optional[int]
    july_col: Optional[int]
    august_col: Optional[int] = None
    person_responsible: Optional[str] = None
    originator: Optional[str] = None
    assignment_type: Optional[str] = None
    collections_fy2526: Optional[int] = None
    balance: Optional[int]
    remarks: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
