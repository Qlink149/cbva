from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.schemas.provenance import DataProvenance


class NewClientCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    name: str
    type_of_work: str = ""
    month: str = ""
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class NewClientResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    name: str
    type_of_work: str
    month: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ClientMeetingCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    client_name: str
    meeting_frequency: str = ""
    dates_till_period: str = ""
    next_period: str = ""
    responsible_person: str = ""
    activity: str = ""
    notes: str = ""
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class ClientMeetingResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    client_name: str
    meeting_frequency: str
    dates_till_period: str
    next_period: str
    responsible_person: str
    activity: str
    notes: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ResourceAllocationCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    client_name: str
    review: str = ""
    execution: str = ""
    supported_by: str = ""
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class ResourceAllocationResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    client_name: str
    review: str
    execution: str
    supported_by: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CrossSellEntryCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    ecosystem_contact: str = ""
    client_name: str
    assignment: str = ""
    fee_rs: Optional[int] = None
    remarks: str = ""
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class CrossSellEntryResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    ecosystem_contact: str
    client_name: str
    assignment: str
    fee_rs: Optional[int]
    remarks: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class BudgetChangeLogCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    client_name: str
    prior_green: Optional[int] = None
    prior_amber: Optional[int] = None
    change_amount: Optional[int] = None
    reason: str = ""
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class BudgetChangeLogResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    client_name: str
    prior_green: Optional[int]
    prior_amber: Optional[int]
    change_amount: Optional[int]
    reason: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CollectionTransactionCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    transaction_date: Optional[str] = None
    year_label: str = ""
    month_label: str = ""
    party_name: str
    group_name: str = ""
    amount: Optional[int] = None
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class CollectionTransactionResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    transaction_date: Optional[str]
    year_label: str
    month_label: str
    party_name: str
    group_name: str
    amount: Optional[int]
    sort_order: int
    created_at: datetime
    updated_at: datetime


class TeamAllocationCreate(BaseModel):
    leader_id: str
    fiscal_year: str
    member_name: str
    position: str = ""
    client_delivery_pct: Optional[float] = None
    business_development_pct: Optional[float] = None
    practice_development_pct: Optional[float] = None
    practice_management_pct: Optional[float] = None
    balance_pct: Optional[float] = None
    as_of_date: Optional[str] = None
    sort_order: int = 0
    source: Optional[DataProvenance] = None


class TeamAllocationResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    member_name: str
    position: str
    client_delivery_pct: Optional[float]
    business_development_pct: Optional[float]
    practice_development_pct: Optional[float]
    practice_management_pct: Optional[float]
    balance_pct: Optional[float]
    as_of_date: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime
