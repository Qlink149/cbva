from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies.auth import require_roles
from app.services.consolidated_service import get_consolidated_summary
from app.services.fy_calendar import parse_fy_slug

router = APIRouter()


@router.get("/")
async def consolidated_summary(
    fiscal_year: str = Query(..., description="Report fiscal year slug, e.g. 2627"),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    if parse_fy_slug(fiscal_year) is None:
        raise HTTPException(status_code=422, detail="fiscal_year must be a 4-digit slug, e.g. 2627")
    from app.services.consolidated_service import ensure_imported_matrix as _ensure
    rows = await _ensure(fiscal_year, user=current_user)
    if not rows:
        # Source xlsx is not shipped in the container image: the summary must be seeded in Mongo
        # (collection `consolidated_summaries`, one doc per report_fy) before this endpoint works.
        raise HTTPException(
            status_code=503,
            detail=(
                f"Consolidated summary for FY {fiscal_year} is not seeded: no consolidated_summaries "
                "document and no source xlsx found on this server."
            ),
        )
    payload = await get_consolidated_summary(fiscal_year)
    return payload
