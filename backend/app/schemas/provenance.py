from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DataProvenance(BaseModel):
    """Tracks Excel origin for extracted records (stored as _source in JSON / Mongo)."""

    file: str
    sheet: str
    row: int
    header_row: Optional[int] = None
    extracted_at: Optional[datetime] = None
    extractor_version: str = "1.0.0"
