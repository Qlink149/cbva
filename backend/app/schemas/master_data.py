from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class ClientCreate(BaseModel):
    """Admin client master list (AdminSettings sends name, type, status)."""
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    type: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default="Active", max_length=50)


class EngagementTypeCreate(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    is_active: bool = True
