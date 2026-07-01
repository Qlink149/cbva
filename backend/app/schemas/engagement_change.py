from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EngagementChangeResponse(BaseModel):
    id: str
    engagement_id: str
    leader_id: str
    fiscal_year: str
    field: str
    old_value: Optional[int]
    new_value: Optional[int]
    changed_by: str
    changed_by_name: str
    changed_at: datetime
