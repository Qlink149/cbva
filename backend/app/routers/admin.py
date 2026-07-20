from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.settings import PublicSettings, AppSettingsResponse
from app.schemas.financial_year import FinancialYearCreate, FinancialYearUpdate
from app.services.fiscal_year import serialize_financial_year
from app.core.security import hash_password
from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import require_roles
from app.services import audit_service

router = APIRouter()


def _fy_display_label(fiscal_year: str) -> str:
    if len(fiscal_year) == 4 and fiscal_year.isdigit():
        return f"20{fiscal_year[:2]}-{fiscal_year[2:]}"
    return fiscal_year


def _serialize_plan_snapshot(doc: dict | None, snapshot_type: str) -> dict | None:
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "leader_id": doc["leader_id"],
        "fiscal_year": doc["fiscal_year"],
        "label": doc["label"],
        "snapshot_type": doc.get("snapshot_type", snapshot_type),
        "green": doc.get("green", 0),
        "amber": doc.get("amber") or 0,
        "blue_sky": doc.get("blue_sky") or 0,
        "total": doc.get("total", 0),
        "source": doc.get("source"),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


class PlanAmounts(BaseModel):
    green: int = Field(0, ge=0)
    amber: int = Field(0, ge=0)
    blue_sky: int = Field(0, ge=0)


class AdminPlansUpsert(BaseModel):
    leader_id: str
    fiscal_year: str
    initial: Optional[PlanAmounts] = None
    board: Optional[PlanAmounts] = None


# ─── Users ────────────────────────────────────────────────────────────────────

def _serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "full_name": doc["full_name"],
        "email": doc["email"],
        "designation": doc.get("designation", ""),
        "role": doc["role"],
        "leader_id": doc.get("leader_id"),
        "is_active": doc.get("is_active", True),
        "created_at": serialize_datetime(doc["created_at"]),
        "last_login": serialize_datetime(doc.get("last_login")),
    }


@router.get("/users", response_model=dict)
async def list_users(current_user: dict = Depends(require_roles("admin"))):
    docs = await database.db.users.find({}).to_list(length=200)
    return {"data": [_serialize_user(d) for d in docs]}


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(body: UserCreate, current_user: dict = Depends(require_roles("admin"))):
    if await database.db.users.find_one({"email": body.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": body.full_name,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "designation": body.designation,
        "role": body.role,
        "leader_id": body.leader_id,
        "is_active": True,
        "created_at": now,
        "last_login": None,
    }
    result = await database.db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "user", doc, current_user,
        label=body.full_name,
    )
    return _serialize_user(doc)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, body: UserUpdate, current_user: dict = Depends(require_roles("admin"))):
    existing = await database.db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None and k != "password"}
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.users.find_one_and_update(
        {"_id": ObjectId(user_id)}, {"$set": updates}, return_document=True
    )
    audit_updates = {k: v for k, v in updates.items() if k != "password_hash"}
    derived: list[dict] = []
    action = "updated"
    if body.password:
        derived.append({"field": "password", "label": "Password", "old": "•••", "new": "•••"})
        if len(audit_updates) == 1 and "updated_at" in audit_updates:
            action = "password_changed"
    await audit_service.log_update(
        "user", existing, audit_updates, current_user,
        label=existing["full_name"],
        derived=derived,
        action=action,
    )
    return _serialize_user(result)


@router.delete("/users/{user_id}", status_code=204)
async def deactivate_user(user_id: str, current_user: dict = Depends(require_roles("admin"))):
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    existing = await database.db.users.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    await database.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    await audit_service.log_delete(
        "user", existing, current_user,
        label=existing["full_name"],
        action="archived",
    )
    return None


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=AppSettingsResponse)
async def get_settings(current_user: dict = Depends(require_roles("admin"))):
    doc = await database.db.app_settings.find_one({"_id": "global"})
    if not doc:
        return AppSettingsResponse(public_settings=PublicSettings())
    return AppSettingsResponse(public_settings=PublicSettings(**doc.get("public_settings", {})))


@router.put("/settings", response_model=AppSettingsResponse)
async def update_settings(body: PublicSettings, current_user: dict = Depends(require_roles("admin"))):
    settings_dict = body.model_dump()
    existing = await database.db.app_settings.find_one({"_id": "global"})
    await database.db.app_settings.update_one(
        {"_id": "global"},
        {"$set": {"public_settings": settings_dict, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await audit_service.log_update(
        "settings",
        existing or {},
        {"public_settings": settings_dict},
        current_user,
        label="App Settings",
    )
    return AppSettingsResponse(public_settings=body)


# ─── Clients (master list) ────────────────────────────────────────────────────

@router.get("/clients")
async def list_clients(current_user: dict = Depends(require_roles("admin", "management"))):
    docs = await database.db.clients.find({}).to_list(length=1000)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"data": docs}


@router.post("/clients", status_code=201)
async def create_client(body: dict, current_user: dict = Depends(require_roles("admin"))):
    now = datetime.now(timezone.utc)
    body["created_at"] = now
    result = await database.db.clients.insert_one(body)
    body["_id"] = result.inserted_id
    await audit_service.log_create(
        "client", body, current_user,
        label=body.get("name", "Client"),
    )
    body["id"] = str(result.inserted_id)
    return body


# ─── Engagement Types ─────────────────────────────────────────────────────────

@router.get("/engagement-types")
async def list_engagement_types(current_user: dict = Depends(require_roles("admin", "management"))):
    docs = await database.db.engagement_types.find({"is_active": True}).to_list(length=100)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"data": docs}


@router.post("/engagement-types", status_code=201)
async def create_engagement_type(body: dict, current_user: dict = Depends(require_roles("admin"))):
    body.setdefault("is_active", True)
    result = await database.db.engagement_types.insert_one(body)
    body["_id"] = result.inserted_id
    await audit_service.log_create(
        "engagement_type", body, current_user,
        label=body.get("name", "Engagement Type"),
    )
    body["id"] = str(result.inserted_id)
    return body


# ─── Financial Years ──────────────────────────────────────────────────────────

@router.get("/financial-years")
async def list_financial_years_admin(current_user: dict = Depends(require_roles("admin", "management"))):
    docs = await database.db.financial_years.find({}).sort([("sort_order", 1), ("slug", 1)]).to_list(length=20)
    return {"data": [serialize_financial_year(d) for d in docs]}


@router.post("/financial-years", status_code=201)
async def create_financial_year(body: FinancialYearCreate, current_user: dict = Depends(require_roles("admin"))):
    if await database.db.financial_years.find_one({"slug": body.slug}):
        raise HTTPException(status_code=409, detail="Fiscal year slug already exists")
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    if doc.get("is_editable") is None:
        doc["is_editable"] = bool(doc.get("is_current"))
    doc["created_at"] = now
    doc["updated_at"] = now
    if doc.get("is_current"):
        await database.db.financial_years.update_many({}, {"$set": {"is_current": False}})
        await audit_service.log_event(
            entity_type="financial_year",
            entity_id="all",
            entity_label=body.slug,
            action="updated",
            user=current_user,
            changes=[{"field": "is_current", "label": "Is Current", "old": True, "new": False, "note": f"Unset by new FY {body.slug}"}],
        )
    result = await database.db.financial_years.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "financial_year", doc, current_user,
        label=body.slug,
    )
    return serialize_financial_year(doc)


@router.put("/financial-years/{fy_id}")
async def update_financial_year(
    fy_id: str,
    body: FinancialYearUpdate,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = await database.db.financial_years.find_one({"_id": ObjectId(fy_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Financial year not found")
    # exclude_unset so boolean False for is_editable is preserved
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return serialize_financial_year(existing)
    updates["updated_at"] = datetime.now(timezone.utc)
    if updates.get("is_current"):
        if "is_editable" not in updates:
            updates["is_editable"] = True
        await database.db.financial_years.update_many(
            {"_id": {"$ne": ObjectId(fy_id)}},
            {"$set": {"is_current": False, "updated_at": updates["updated_at"]}},
        )
        await audit_service.log_event(
            entity_type="financial_year",
            entity_id="all",
            entity_label=existing["slug"],
            action="updated",
            user=current_user,
            changes=[{"field": "is_current", "label": "Is Current", "old": True, "new": False, "note": f"Unset by setting {existing['slug']} as current"}],
        )
    result = await database.db.financial_years.find_one_and_update(
        {"_id": ObjectId(fy_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "financial_year", existing, updates, current_user,
        label=existing["slug"],
    )
    return serialize_financial_year(result)


# ─── Initial / Board Plans ─────────────────────────────────────────────────────

async def _upsert_manual_plan(
    *,
    leader_id: str,
    fiscal_year: str,
    snapshot_type: str,
    label: str,
    sort_order: int,
    amounts: PlanAmounts,
    user: dict,
) -> dict:
    now = datetime.now(timezone.utc)
    green = amounts.green
    amber = amounts.amber
    blue_sky = amounts.blue_sky
    total = green + amber + blue_sky

    existing = await database.db.pipeline_snapshots.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": snapshot_type}
    )
    updates = {
        "leader_id": leader_id,
        "fiscal_year": fiscal_year,
        "label": label,
        "sort_order": sort_order,
        "green": green,
        "amber": amber,
        "blue_sky": blue_sky,
        "total": total,
        "snapshot_type": snapshot_type,
        "source": "manual",
        "updated_at": now,
    }
    result = await database.db.pipeline_snapshots.find_one_and_update(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": snapshot_type},
        {"$set": updates, "$setOnInsert": {"created_at": now, "as_of_date": None}},
        upsert=True,
        return_document=True,
    )
    if existing:
        await audit_service.log_update(
            "pipeline_snapshot", existing, updates, user,
            label=label,
            leader_id=leader_id,
            fiscal_year=fiscal_year,
        )
    else:
        await audit_service.log_create(
            "pipeline_snapshot", result, user,
            label=label,
            leader_id=leader_id,
            fiscal_year=fiscal_year,
        )
    return _serialize_plan_snapshot(result, snapshot_type)


@router.get("/plans")
async def get_admin_plans(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(require_roles("admin")),
):
    initial = await database.db.pipeline_snapshots.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": "initial"}
    )
    board = await database.db.pipeline_snapshots.find_one(
        {"leader_id": leader_id, "fiscal_year": fiscal_year, "snapshot_type": "board"}
    )
    return {
        "leader_id": leader_id,
        "fiscal_year": fiscal_year,
        "initial": _serialize_plan_snapshot(initial, "initial"),
        "board": _serialize_plan_snapshot(board, "board"),
    }


@router.put("/plans")
async def upsert_admin_plans(
    body: AdminPlansUpsert,
    current_user: dict = Depends(require_roles("admin")),
):
    if not body.initial and not body.board:
        raise HTTPException(status_code=400, detail="Provide initial and/or board plan amounts")

    leader = await database.db.leaders.find_one({"_id": body.leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")

    fy_label = _fy_display_label(body.fiscal_year)
    result = {
        "leader_id": body.leader_id,
        "fiscal_year": body.fiscal_year,
        "initial": None,
        "board": None,
    }

    if body.initial is not None:
        result["initial"] = await _upsert_manual_plan(
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
            snapshot_type="initial",
            label=f"Initial Plan ({fy_label})",
            sort_order=0,
            amounts=body.initial,
            user=current_user,
        )
    else:
        existing = await database.db.pipeline_snapshots.find_one(
            {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year, "snapshot_type": "initial"}
        )
        result["initial"] = _serialize_plan_snapshot(existing, "initial")

    if body.board is not None:
        result["board"] = await _upsert_manual_plan(
            leader_id=body.leader_id,
            fiscal_year=body.fiscal_year,
            snapshot_type="board",
            label=f"Board Plan ({fy_label})",
            sort_order=1,
            amounts=body.board,
            user=current_user,
        )
    else:
        existing = await database.db.pipeline_snapshots.find_one(
            {"leader_id": body.leader_id, "fiscal_year": body.fiscal_year, "snapshot_type": "board"}
        )
        result["board"] = _serialize_plan_snapshot(existing, "board")

    return result
