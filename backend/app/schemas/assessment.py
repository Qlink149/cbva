from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime

from app.schemas.provenance import DataProvenance


AssessmentRecordType = Literal["cit_a", "assessment", "nfac", "charge", "other"]


class AssessmentCreate(BaseModel):
    leader_id: str
    fiscal_year: Optional[str] = None
    record_type: AssessmentRecordType = "cit_a"
    group: str = ""
    assessee_name: str
    ay: str = ""
    pan: str = ""
    charge_or_nfac: str = ""
    ao_name: str = ""
    addl_comm_name: str = ""
    cit_name: str = ""
    time_barring: str = ""
    status: str = ""
    remarks: str = ""
    sort_order: int = 0
    is_shared_template: bool = False
    content_hash: str = ""
    source: Optional[DataProvenance] = None


class AssessmentUpdate(BaseModel):
    group: Optional[str] = None
    assessee_name: Optional[str] = None
    ay: Optional[str] = None
    pan: Optional[str] = None
    charge_or_nfac: Optional[str] = None
    ao_name: Optional[str] = None
    addl_comm_name: Optional[str] = None
    cit_name: Optional[str] = None
    time_barring: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    sort_order: Optional[int] = None
    is_shared_template: Optional[bool] = None


class AssessmentResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: Optional[str]
    record_type: str
    group: str
    assessee_name: str
    ay: str
    pan: str
    charge_or_nfac: str
    ao_name: str
    addl_comm_name: str
    cit_name: str
    time_barring: str
    status: str
    remarks: str
    sort_order: int
    is_shared_template: bool
    content_hash: str
    created_at: datetime
    updated_at: datetime
