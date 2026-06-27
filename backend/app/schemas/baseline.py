from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BaselinePlanCreate(BaseModel):
    leader_id: str
    financial_year_id: str
    baseline_green: int = 0
    baseline_amber: int = 0
    baseline_blue_sky: int = 0
    baseline_total: int = 0
    is_locked: bool = False


class BaselinePlanUpdate(BaseModel):
    baseline_green: Optional[int] = None
    baseline_amber: Optional[int] = None
    baseline_blue_sky: Optional[int] = None
    baseline_total: Optional[int] = None
    is_locked: Optional[bool] = None


class BaselinePlanResponse(BaseModel):
    id: str
    leader_id: str
    financial_year_id: str
    baseline_green: int
    baseline_amber: int
    baseline_blue_sky: int
    baseline_total: int
    is_locked: bool
    created_at: datetime
    updated_at: datetime
