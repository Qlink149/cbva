from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime


class AdditionalWorkCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    engagement_id: Optional[str] = None
    client_name: str = Field(..., min_length=1)
    month_key: Optional[str] = Field(None, min_length=2, max_length=2)
    logged_month: Optional[str] = Field(None, min_length=2, max_length=2)
    nature_of_work: str = Field(..., min_length=1)
    entry_type: Literal["additional_work", "new_client"] = "additional_work"
    source_tab: str = ""
    amount: int = Field(0, ge=0)
    notes: str = ""

    @model_validator(mode="after")
    def sync_month_keys(self):
        if self.logged_month and not self.month_key:
            self.month_key = self.logged_month
        if self.month_key and not self.logged_month:
            self.logged_month = self.month_key
        if not self.month_key:
            raise ValueError("logged_month or month_key is required")
        return self


class AdditionalWorkUpdate(BaseModel):
    engagement_id: Optional[str] = None
    client_name: Optional[str] = None
    month_key: Optional[str] = Field(None, min_length=2, max_length=2)
    logged_month: Optional[str] = Field(None, min_length=2, max_length=2)
    nature_of_work: Optional[str] = None
    amount: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class AdditionalWorkResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    engagement_id: Optional[str] = None
    client_name: str
    month_key: str
    logged_month: str
    nature_of_work: str = ""
    entry_type: str = "additional_work"
    source_tab: str = ""
    amount: int
    notes: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
