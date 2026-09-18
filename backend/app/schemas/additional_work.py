from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AdditionalWorkCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    engagement_id: Optional[str] = None
    client_name: str = Field(..., min_length=1)
    month_key: str = Field(..., min_length=2, max_length=2)
    amount: int = Field(0, ge=0)
    notes: str = ""


class AdditionalWorkUpdate(BaseModel):
    engagement_id: Optional[str] = None
    client_name: Optional[str] = None
    month_key: Optional[str] = Field(None, min_length=2, max_length=2)
    amount: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class AdditionalWorkResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    engagement_id: Optional[str] = None
    client_name: str
    month_key: str
    amount: int
    notes: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
