from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LeaderCreate(BaseModel):
    id: str
    name: str
    practice: str = ""
    email: str = ""


class LeaderUpdate(BaseModel):
    name: Optional[str] = None
    practice: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class LeaderResponse(BaseModel):
    id: str
    name: str
    practice: str
    email: str
    is_active: bool
