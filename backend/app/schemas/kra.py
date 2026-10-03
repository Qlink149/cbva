from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


ROUND_TYPES = ("self_midyear", "mgmt_midyear", "self_yearend", "mgmt_yearend")
ROUND_STATES = ("open", "submitted", "locked")
RoundType = Literal["self_midyear", "mgmt_midyear", "self_yearend", "mgmt_yearend"]
RoundState = Literal["open", "submitted", "locked"]
PeriodType = Literal["midyear", "yearend"]


class KraCategoryResponse(BaseModel):
    id: str
    name: str
    sort_order: int


class KraWeightUpsert(BaseModel):
    layer: Literal["all_time", "fy", "leader"] = "fy"
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    weights: dict[str, float]


class KraWeightRowResponse(BaseModel):
    id: str
    layer: str
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    category_id: str
    weight: float
    created_at: datetime
    updated_at: datetime


class KpiDefinitionCreate(BaseModel):
    layer: Literal["all_time", "fy", "leader"] = "fy"
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    category_id: str
    kpi_name: str
    sub_weight: float = Field(ge=0, le=1)
    rating_band_text: str = ""
    target_measurement_text: str = ""
    frequency_source: str = ""
    sort_order: int = 0


class KpiDefinitionUpdate(BaseModel):
    category_id: Optional[str] = None
    kpi_name: Optional[str] = None
    sub_weight: Optional[float] = Field(default=None, ge=0, le=1)
    rating_band_text: Optional[str] = None
    target_measurement_text: Optional[str] = None
    frequency_source: Optional[str] = None
    sort_order: Optional[int] = None


class KpiDefinitionResponse(BaseModel):
    id: str
    layer: str
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    category_id: str
    kpi_name: str
    sub_weight: float
    rating_band_text: str
    target_measurement_text: str
    frequency_source: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CompetencyCreate(BaseModel):
    layer: Literal["all_time", "fy", "leader"] = "all_time"
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    key: str
    name: str
    criteria_text: Optional[str] = None
    weight: float = Field(ge=0, le=1)
    sort_order: int = 0


class CompetencyUpdate(BaseModel):
    name: Optional[str] = None
    criteria_text: Optional[str] = None
    weight: Optional[float] = Field(default=None, ge=0, le=1)
    sort_order: Optional[int] = None


class CompetencyResponse(BaseModel):
    id: str
    key: str
    layer: str
    fiscal_year: Optional[str] = None
    leader_id: Optional[str] = None
    name: str
    criteria_text: Optional[str] = None
    weight: float
    sort_order: int
    created_at: datetime
    updated_at: datetime


class KpiRatingInput(BaseModel):
    kpi_definition_id: str
    rating: Optional[float] = Field(default=None, ge=1, le=5)
    comment: str = ""


class CompetencyRatingInput(BaseModel):
    competency_id: str
    rating: Optional[float] = Field(default=None, ge=1, le=5)


class LayerCopyRequest(BaseModel):
    target_layer: Literal["fy", "leader"]
    fiscal_year: str
    leader_id: Optional[str] = None


class RoundRatingsUpsert(BaseModel):
    kpi_ratings: list[KpiRatingInput] = []
    competency_ratings: list[CompetencyRatingInput] = []
