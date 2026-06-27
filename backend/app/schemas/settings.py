from pydantic import BaseModel
from typing import List


class PublicSettings(BaseModel):
    app_name: str = "CBVA Business Plan"
    active_fiscal_years: List[str] = ["2526", "2627"]
    maintenance_mode: bool = False


class AppSettingsResponse(BaseModel):
    id: str = "global"
    public_settings: PublicSettings
