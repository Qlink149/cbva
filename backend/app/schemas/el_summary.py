from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ELSummaryUpdate(BaseModel):
    el_signed: Optional[int] = None
    el_not_signed: Optional[int] = None
    received_till_apr: Optional[int] = None
    received_till_apr_2026: Optional[int] = None
    received_till_may: Optional[int] = None
    received_till_jun9: Optional[int] = None
    to_receive_may: Optional[int] = None
    to_receive_june: Optional[int] = None
    to_receive_july: Optional[int] = None
    total_till_june: Optional[int] = None
    pct_collected: Optional[float] = None
    amber_el_signed: Optional[int] = None
    amber_el_not_signed: Optional[int] = None
    amber_received: Optional[int] = None


class ELSummaryResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    el_signed: Optional[int] = None
    el_not_signed: Optional[int] = None
    received_till_apr: Optional[int] = None
    received_till_apr_2026: Optional[int] = None
    received_till_may: Optional[int] = None
    received_till_jun9: Optional[int] = None
    to_receive_may: Optional[int] = None
    to_receive_june: Optional[int] = None
    to_receive_july: Optional[int] = None
    total_till_june: Optional[int] = None
    pct_collected: Optional[float] = None
    amber_el_signed: Optional[int] = None
    amber_el_not_signed: Optional[int] = None
    amber_received: Optional[int] = None
    updated_at: Optional[datetime] = None
