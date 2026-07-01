from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, datetime


class EngagementActionCreate(BaseModel):
    engagement_id: str
    leader_id: str
    fiscal_year: str
    engagement_num: int
    description: str = Field(..., min_length=1)
    deadline: Optional[date] = None


class EngagementActionStatusPatch(BaseModel):
    status: Literal["Pending", "In Progress", "Done"]


class EngagementActionResponse(BaseModel):
    id: str
    engagement_id: str
    leader_id: str
    fiscal_year: str
    engagement_num: int
    description: str
    deadline: Optional[date]
    status: str
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime
