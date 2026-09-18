from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import date, datetime


ACTION_STATUSES = ("Pending", "In Progress", "Completed", "Abandoned")
# Legacy "Done" accepted on read/patch and normalized to Completed
ActionStatus = Literal["Pending", "In Progress", "Completed", "Abandoned", "Done"]


class EngagementActionCreate(BaseModel):
    engagement_id: str
    leader_id: str
    fiscal_year: str
    engagement_num: Optional[int] = None
    description: str = Field(..., min_length=1)
    deadline: Optional[date] = None
    remarks: Optional[str] = Field(default="", max_length=500)

    @field_validator("deadline", mode="before")
    @classmethod
    def empty_deadline_to_none(cls, v):
        if v is None or v == "":
            return None
        return v

    @field_validator("remarks", mode="before")
    @classmethod
    def coerce_remarks(cls, v):
        if v is None:
            return ""
        return str(v).strip()[:500]


class EngagementActionUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1)
    deadline: Optional[date] = None
    remarks: Optional[str] = Field(default=None, max_length=500)
    status: Optional[ActionStatus] = None

    @field_validator("deadline", mode="before")
    @classmethod
    def empty_deadline_to_none(cls, v):
        if v is None or v == "":
            return None
        return v


class EngagementActionStatusPatch(BaseModel):
    status: ActionStatus

    @field_validator("status", mode="before")
    @classmethod
    def normalize_done(cls, v):
        if v == "Done":
            return "Completed"
        return v


class EngagementActionResponse(BaseModel):
    id: str
    engagement_id: str
    leader_id: str
    fiscal_year: str
    engagement_num: int
    client_name: str = ""
    description: str
    deadline: Optional[date]
    remarks: str = ""
    status: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime
