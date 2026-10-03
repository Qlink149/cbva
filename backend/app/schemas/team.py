from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime


class TeamMemberCreate(BaseModel):
    leader_id: str
    full_name: str
    designation: str = ""
    email: str = ""
    annual_cost: int = 0
    joining_date: Optional[date] = None
    status: Literal["Active", "On Notice", "Inactive"] = "Active"
    notes: str = ""
    fiscal_year: str
    is_manager: bool = False
    is_leader: bool = False
    sort_order: int = 0
    reports_to_member_id: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    annual_cost: Optional[int] = None
    joining_date: Optional[date] = None
    status: Optional[Literal["Active", "On Notice", "Inactive"]] = None
    notes: Optional[str] = None
    fiscal_year: Optional[str] = None
    is_manager: Optional[bool] = None
    sort_order: Optional[int] = None
    reports_to_member_id: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: str
    leader_id: str
    full_name: str
    designation: str
    email: str
    annual_cost: int
    joining_date: Optional[date]
    status: str
    notes: str
    fiscal_year: Optional[str] = None
    is_manager: bool = False
    is_leader: bool = False
    sort_order: int = 0
    reports_to_member_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
