from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime


class HiringRequirementCreate(BaseModel):
    leader_id: str
    role_title: str
    level: Literal["Analyst", "Associate", "Manager", "Senior Manager", "Director", "Partner", "Other"] = "Analyst"
    expected_joining_date: Optional[date] = None
    status: Literal["Open", "In Progress", "Filled", "On Hold"] = "Open"
    expected_cost: int = 0
    remarks: str = ""


class HiringRequirementUpdate(BaseModel):
    role_title: Optional[str] = None
    level: Optional[Literal["Analyst", "Associate", "Manager", "Senior Manager", "Director", "Partner", "Other"]] = None
    expected_joining_date: Optional[date] = None
    status: Optional[Literal["Open", "In Progress", "Filled", "On Hold"]] = None
    expected_cost: Optional[int] = None
    remarks: Optional[str] = None


class HiringRequirementResponse(BaseModel):
    id: str
    leader_id: str
    role_title: str
    level: str
    expected_joining_date: Optional[date]
    status: str
    expected_cost: int
    remarks: str
    created_at: datetime
    updated_at: datetime
