from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AuditChangeItem(BaseModel):
    field: str = ""
    label: str = ""
    old: Any = None
    new: Any = None
    derived: Optional[bool] = None
    note: Optional[str] = None


class AuditEntryResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    entity_label: str
    action: str
    changes: list[AuditChangeItem]
    snapshot: Optional[dict] = None
    actor_id: str
    actor_name: str
    actor_role: str
    leader_id: Optional[str] = None
    fiscal_year: Optional[str] = None
    source: str
    triggered_by: Optional[str] = None
    request_id: Optional[str] = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    data: list[AuditEntryResponse]
    total: int
    skip: int
    limit: int
