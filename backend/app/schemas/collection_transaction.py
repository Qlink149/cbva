from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CollectionTransactionCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    engagement_id: str
    month: str          # two-digit month key, e.g. "04" = April
    client_name: str
    amount_billed: int = Field(0, ge=0)
    amount_collected: int = Field(..., ge=0)


class CollectionTransactionResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    engagement_id: str
    month: str
    client_name: str
    amount_billed: int
    amount_collected: int
    created_at: datetime
    updated_at: datetime
