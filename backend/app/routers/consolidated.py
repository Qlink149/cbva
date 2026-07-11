from fastapi import APIRouter, Depends, Query
from app.dependencies.auth import require_roles
from app.services.consolidated_service import get_consolidated_summary

router = APIRouter()


@router.get("/")
async def consolidated_summary(
    fiscal_year: str = Query(..., description="Report fiscal year slug, e.g. 2627"),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    payload = await get_consolidated_summary(fiscal_year)
    return payload
