from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CollectionPlanSet(BaseModel):
    """Upsert the planned (target) amount for a single month."""
    leader_id: str
    fiscal_year: str
    month_key: str      # "04" = April
    planned: int = 0
    remarks: Optional[str] = None


class CollectionEntryUpdate(BaseModel):
    """Update planned, collected, and/or remarks on an existing collection_entries row."""
    planned: Optional[int] = None
    collected: Optional[int] = None
    remarks: Optional[str] = None


class CollectionTransactionItem(BaseModel):
    id: str
    engagement_id: str
    client_name: str
    amount_billed: int
    amount_collected: int
    created_at: datetime


class MonthCollectionResponse(BaseModel):
    month_key: str
    month_label: str    # e.g. "April 2025"
    sort_order: int
    planned: int
    actual: int
    variance: int
    remarks: str = ""
    entry_id: Optional[str] = None
    transactions: list[CollectionTransactionItem] = []


class CollectionListResponse(BaseModel):
    data: list[MonthCollectionResponse]
    total_collected: int
