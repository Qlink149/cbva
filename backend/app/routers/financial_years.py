from fastapi import APIRouter, Depends
from app.dependencies.auth import get_current_user
from app.services.fiscal_year import list_active_financial_years

router = APIRouter()


@router.get("/")
async def get_financial_years(current_user: dict = Depends(get_current_user)):
    """Public read — all authenticated roles."""
    data = await list_active_financial_years()
    return {"data": data}
