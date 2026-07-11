from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime

from app.schemas.provenance import DataProvenance

ELStatus = Literal["Signed", "Not Signed", "Waived", "NA", "DS", "—"]
ClientScope = Literal["Domestic", "International"]
RemarkMode = Literal["edit", "add"]
FiscalYear = str


class RemarkHistoryEntry(BaseModel):
    text: str
    at: datetime
    by: str


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
    monthly_plan: dict[str, int] = {}
    person_responsible: str = ""
    originator: str = ""
    assignment_type: str = ""
    client_scope: ClientScope = "Domestic"
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
    may_col: Optional[int] = None
    june_col: Optional[int] = None
    july_col: Optional[int] = None
    august_col: Optional[int] = None
    monthly_plan: Optional[dict[str, int]] = None
    person_responsible: Optional[str] = None
    originator: Optional[str] = None
    assignment_type: Optional[str] = None
    client_scope: Optional[ClientScope] = None
    remarks: Optional[str] = None


class RemarksUpdate(BaseModel):
    remarks: str
    mode: RemarkMode = "edit"


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
    monthly_plan: dict[str, int] = {}
    person_responsible: Optional[str] = None
    originator: Optional[str] = None
    assignment_type: Optional[str] = None
    client_scope: ClientScope = "Domestic"
    balance: Optional[int] = None
    remarks: str
    remarks_history: List[RemarkHistoryEntry] = []
    is_archived: bool
    created_at: datetime
    updated_at: datetime
