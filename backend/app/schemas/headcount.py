from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class HeadcountPlanUpsert(BaseModel):
    leader_id: str
    fiscal_year: str
    designation: str
    board_approved: int = 0


class HeadcountPlanResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    designation: str
    board_approved: int
    created_at: datetime
    updated_at: datetime
