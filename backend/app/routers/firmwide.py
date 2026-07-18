from fastapi import APIRouter, Depends, Query
from app.services import firmwide_service
from app.dependencies.auth import require_roles
from app.dependencies.pagination import pagination_params
from bson import ObjectId

router = APIRouter()


def _str_ids(docs: list) -> list:
    result = []
    for d in docs:
        d["id"] = str(d.pop("_id", ""))
        result.append(d)
    return result


@router.get("/summary")
async def firmwide_summary(
    fiscal_year: str = Query(...),
    month: str | None = Query(None),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    rows = await firmwide_service.get_firmwide_summary(fiscal_year, month=month)
    for r in rows:
        r["leader_id"] = r.pop("_id")
    return {"data": rows, "fiscal_year": fiscal_year, "month": month}


@router.get("/leaders")
async def firmwide_leaders(
    fiscal_year: str = Query(...),
    month: str | None = Query(None),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    from app.core import database
    leaders = await database.db.leaders.find({"is_active": True}).to_list(length=50)
    summary_rows = await firmwide_service.get_firmwide_summary(fiscal_year, month=month)
    summary_map = {r["_id"]: r for r in summary_rows}
    result = []
    for ldr in leaders:
        stats = summary_map.get(ldr["_id"], {})
        result.append({
            "id": ldr["_id"],
            "name": ldr["name"],
            "practice": ldr.get("practice", ""),
            "total_green": stats.get("total_green", 0),
            "total_amber": stats.get("total_amber", 0),
            "total_blue_sky": stats.get("total_blue_sky", 0),
            "total_pipeline": stats.get("total_pipeline", 0),
            "total_collected": stats.get("total_collected", 0),
            "engagement_count": stats.get("engagement_count", 0),
            "el_signed_count": stats.get("el_signed_count", 0),
        })
    return {"data": result, "fiscal_year": fiscal_year, "month": month or None}


@router.get("/clients")
async def firmwide_clients(
    fiscal_year: str = Query(...),
    pagination: dict = Depends(pagination_params),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    docs, total = await firmwide_service.get_firmwide_clients(
        fiscal_year, skip=pagination["skip"], limit=pagination["limit"]
    )
    return {"data": _str_ids(docs), "total": total, "skip": pagination["skip"], "limit": pagination["limit"]}


@router.get("/team")
async def firmwide_team(
    fiscal_year: str = Query(None),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    docs = await firmwide_service.get_firmwide_team(fiscal_year)
    return {"data": _str_ids(docs)}


@router.get("/dashboard-aggregate")
async def firmwide_dashboard_aggregate(
    fiscal_year: str = Query(...),
    current_user: dict = Depends(require_roles("admin", "management")),
):
    data = await firmwide_service.get_firmwide_dashboard_aggregate(fiscal_year)
    return {"fiscal_year": fiscal_year, **data}
