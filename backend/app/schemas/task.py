from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, datetime


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    assignee_name: str = ""
    client_name: str = ""
    priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
    deadline: Optional[date] = None
    notes: str = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assignee_name: Optional[str] = None
    client_name: Optional[str] = None
    priority: Optional[Literal["Low", "Medium", "High", "Urgent"]] = None
    deadline: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[Literal["Pending", "In Progress", "Done"]] = None


class TaskStatusPatch(BaseModel):
    status: Literal["Pending", "In Progress", "Done"]


class TaskResponse(BaseModel):
    id: str
    leader_id: str
    created_by_id: str
    title: str
    assignee_name: str
    client_name: str
    priority: str
    deadline: Optional[date]
    notes: str
    status: str
    created_at: datetime
    updated_at: datetime
