from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

from app.schemas.provenance import DataProvenance


class ActionUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["In-Progress", "Not Started", "Closed"]] = None
    notes: Optional[str] = None
    remarks: Optional[str] = None
    due_date: Optional[str] = None
    forum: Optional[str] = None
    responsibility: Optional[str] = None
    date_raised: Optional[str] = None
    expected_completion: Optional[str] = None
    cross_ref_risks: Optional[str] = None
    cross_ref_issues: Optional[str] = None
    cross_ref_decisions: Optional[str] = None


class ActionStatusPatch(BaseModel):
    status: Literal["In-Progress", "Not Started", "Closed"]


class ActionResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    num: int
    category: str
    description: str
    status: str
    notes: str
    remarks: str
    due_date: Optional[str]
    forum: Optional[str] = None
    responsibility: Optional[str] = None
    date_raised: Optional[str] = None
    expected_completion: Optional[str] = None
    cross_ref_risks: Optional[str] = None
    cross_ref_issues: Optional[str] = None
    cross_ref_decisions: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ActionCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    category: str = ""
    description: str = ""
    status: Literal["In-Progress", "Not Started", "Closed"] = "Not Started"
    notes: str = ""
    remarks: str = ""
    due_date: Optional[str] = None
    forum: str = ""
    responsibility: str = ""
    date_raised: Optional[str] = None
    expected_completion: Optional[str] = None
    cross_ref_risks: str = ""
    cross_ref_issues: str = ""
    cross_ref_decisions: str = ""
    source: Optional[DataProvenance] = None
