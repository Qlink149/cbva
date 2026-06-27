from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    designation: str = ""
    role: Literal["admin", "management", "user"] = "user"
    leader_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[Literal["admin", "management", "user"]] = None
    leader_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    designation: str
    role: str
    leader_id: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
