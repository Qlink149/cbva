from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FinancialYearResponse(BaseModel):
    id: str
    slug: str
    label: str
    is_current: bool = False
    is_active: bool = True
    is_editable: bool = True
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FinancialYearUpdate(BaseModel):
    label: Optional[str] = None
    is_current: Optional[bool] = None
    is_active: Optional[bool] = None
    is_editable: Optional[bool] = None
    sort_order: Optional[int] = None


class FinancialYearCreate(BaseModel):
    slug: str
    label: str
    is_current: bool = False
    is_active: bool = True
    is_editable: Optional[bool] = None
    sort_order: int = 0
