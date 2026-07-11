from pydantic import BaseModel
from datetime import datetime


class HeadcountPlanUpsert(BaseModel):
    leader_id: str
    designation: str
    board_approved: int = 0


class HeadcountPlanResponse(BaseModel):
    id: str
    leader_id: str
    designation: str
    board_approved: int
    created_at: datetime
    updated_at: datetime
