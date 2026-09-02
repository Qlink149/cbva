from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import get_current_user, require_roles
from app.schemas.kra import (
    CompetencyCreate,
    CompetencyUpdate,
    KpiDefinitionCreate,
    KpiDefinitionUpdate,
    KraWeightUpsert,
    LayerCopyRequest,
)
from app.services import audit_service
from app.services.kra_resolve import (
    clone_layer,
    delete_layer,
    fetch_competencies,
    fetch_kpis,
    fetch_weights,
    layer_filter,
    layer_has_copy,
    resolve_competencies,
    resolve_kpis,
    resolve_weights,
)

router = APIRouter()


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def _layer_args(layer: str, fiscal_year: str | None, leader_id: str | None) -> None:
    if layer == "fy" and not fiscal_year:
        raise HTTPException(status_code=400, detail="fiscal_year required for FY layer")
    if layer == "leader" and (not fiscal_year or not leader_id):
        raise HTTPException(status_code=400, detail="fiscal_year and leader_id required for leader layer")


def _serialize_weight(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "layer": doc.get("layer") or "fy",
        "fiscal_year": doc.get("fiscal_year"),
        "leader_id": doc.get("leader_id"),
        "category_id": doc["category_id"],
        "weight": doc["weight"],
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


def _serialize_kpi(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "layer": doc.get("layer") or "fy",
        "fiscal_year": doc.get("fiscal_year"),
        "leader_id": doc.get("leader_id"),
        "category_id": doc["category_id"],
        "kpi_name": doc["kpi_name"],
        "sub_weight": doc["sub_weight"],
        "rating_band_text": doc.get("rating_band_text") or "",
        "target_measurement_text": doc.get("target_measurement_text") or "",
        "frequency_source": doc.get("frequency_source") or "",
        "sort_order": doc.get("sort_order", 0),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


def _serialize_competency(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "key": doc.get("key") or str(doc["_id"]),
        "layer": doc.get("layer") or "all_time",
        "fiscal_year": doc.get("fiscal_year"),
        "leader_id": doc.get("leader_id"),
        "name": doc["name"],
        "criteria_text": doc.get("criteria_text"),
        "weight": doc.get("weight", 0),
        "sort_order": doc.get("sort_order", 0),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


def _serialize_category(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "sort_order": doc.get("sort_order", 0),
    }


async def _find_comp(competency_id: str) -> dict | None:
    doc = await database.db.leadership_competencies.find_one({"_id": competency_id})
    if doc:
        return doc
    try:
        return await database.db.leadership_competencies.find_one({"_id": ObjectId(competency_id)})
    except Exception:
        return None


@router.get("/categories")
async def list_categories(current_user: dict = Depends(get_current_user)):
    docs = await database.db.kra_categories.find({}).sort("sort_order", 1).to_list(length=20)
    return {"data": [_serialize_category(d) for d in docs]}


@router.get("/resolved")
async def get_resolved(
    fiscal_year: str = Query(...),
    leader_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    kpi_layer, kpis = await resolve_kpis(fiscal_year, leader_id)
    weight_layer, weights = await resolve_weights(fiscal_year, leader_id)
    comp_layer, comps = await resolve_competencies(fiscal_year, leader_id)
    return {
        "kpi_layer": kpi_layer,
        "weight_layer": weight_layer,
        "competency_layer": comp_layer,
        "kpis": [_serialize_kpi(d) for d in kpis],
        "weights": weights,
        "competencies": [_serialize_competency(d) for d in comps],
        "has_fy_copy": await layer_has_copy("fy", fiscal_year, None),
        "has_leader_copy": bool(leader_id) and await layer_has_copy("leader", fiscal_year, leader_id),
    }


@router.post("/copy", status_code=201)
async def copy_layer(
    body: LayerCopyRequest,
    current_user: dict = Depends(require_roles("admin")),
):
    if body.target_layer == "leader" and not body.leader_id:
        raise HTTPException(status_code=400, detail="leader_id required")
    lid = body.leader_id if body.target_layer == "leader" else None
    if await layer_has_copy(body.target_layer, body.fiscal_year, lid):
        raise HTTPException(status_code=409, detail="A copy already exists for this layer")
    result = await clone_layer(body.target_layer, body.fiscal_year, lid)
    await audit_service.log_event(
        entity_type="kra_layer",
        entity_id=f"{body.target_layer}:{body.fiscal_year}:{lid or ''}",
        entity_label=f"KRA copy → {body.target_layer}",
        action="created",
        user=current_user,
        leader_id=lid,
        fiscal_year=body.fiscal_year,
    )
    return result


@router.delete("/copy", status_code=200)
async def remove_leader_copy(
    fiscal_year: str = Query(...),
    leader_id: str = Query(...),
    current_user: dict = Depends(require_roles("admin")),
):
    if not await layer_has_copy("leader", fiscal_year, leader_id):
        raise HTTPException(status_code=404, detail="No leader copy to remove")
    result = await delete_layer("leader", fiscal_year, leader_id)
    await audit_service.log_event(
        entity_type="kra_layer",
        entity_id=f"leader:{fiscal_year}:{leader_id}",
        entity_label=f"KRA remove leader copy — {leader_id}",
        action="deleted",
        user=current_user,
        leader_id=leader_id,
        fiscal_year=fiscal_year,
    )
    return result


@router.get("/competencies")
async def list_competencies(
    layer: str = Query("all_time"),
    fiscal_year: str | None = Query(None),
    leader_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    _layer_args(layer, fiscal_year, leader_id)
    docs = await fetch_competencies(layer, fiscal_year, leader_id)
    return {"data": [_serialize_competency(d) for d in docs], "exists": bool(docs)}


@router.post("/competencies", status_code=201)
async def create_competency(
    body: CompetencyCreate,
    current_user: dict = Depends(require_roles("admin")),
):
    _layer_args(body.layer, body.fiscal_year, body.leader_id)
    now = datetime.now(timezone.utc)
    dest = {
        "layer": body.layer,
        "fiscal_year": None if body.layer == "all_time" else body.fiscal_year,
        "leader_id": body.leader_id if body.layer == "leader" else None,
        "key": body.key,
        "name": body.name,
        "criteria_text": body.criteria_text,
        "weight": body.weight,
        "sort_order": body.sort_order,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.leadership_competencies.insert_one(dest)
    dest["_id"] = result.inserted_id
    await audit_service.log_create(
        "leadership_competency", dest, current_user, label=f"Competency — {body.name}",
        leader_id=dest["leader_id"], fiscal_year=dest["fiscal_year"],
    )
    return _serialize_competency(dest)


@router.put("/competencies/{competency_id}")
async def update_competency(
    competency_id: str,
    body: CompetencyUpdate,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = await _find_comp(competency_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Competency not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.leadership_competencies.find_one_and_update(
        {"_id": existing["_id"]}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "leadership_competency", existing, updates, current_user,
        label=f"Competency — {existing.get('name')}",
    )
    return _serialize_competency(result)


@router.delete("/competencies/{competency_id}", status_code=204)
async def delete_competency(
    competency_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = await _find_comp(competency_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Competency not found")
    rated = await database.db.competency_ratings.count_documents({"competency_id": str(existing["_id"])})
    if rated:
        raise HTTPException(status_code=409, detail="This competency has ratings and cannot be deleted.")
    await database.db.leadership_competencies.delete_one({"_id": existing["_id"]})
    await audit_service.log_delete(
        "leadership_competency", existing, current_user,
        label=f"Competency — {existing.get('name')}",
    )


@router.get("/kpis")
async def list_kpis(
    layer: str = Query("fy"),
    fiscal_year: str | None = Query(None),
    leader_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    _layer_args(layer, fiscal_year, leader_id)
    docs = await fetch_kpis(layer, fiscal_year, leader_id)
    return {"data": [_serialize_kpi(d) for d in docs], "exists": bool(docs)}


@router.post("/kpis", status_code=201)
async def create_kpi(
    body: KpiDefinitionCreate,
    current_user: dict = Depends(require_roles("admin")),
):
    _layer_args(body.layer, body.fiscal_year, body.leader_id)
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(),
        "fiscal_year": None if body.layer == "all_time" else body.fiscal_year,
        "leader_id": body.leader_id if body.layer == "leader" else None,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.db.kpi_definitions.insert_one(doc)
    doc["_id"] = result.inserted_id
    await audit_service.log_create(
        "kpi_definition", doc, current_user,
        label=f"KPI — {body.kpi_name}",
        fiscal_year=doc.get("fiscal_year"),
        leader_id=doc.get("leader_id"),
    )
    return _serialize_kpi(doc)


@router.put("/kpis/{kpi_id}")
async def update_kpi(
    kpi_id: str,
    body: KpiDefinitionUpdate,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = await database.db.kpi_definitions.find_one({"_id": _oid(kpi_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="KPI definition not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await database.db.kpi_definitions.find_one_and_update(
        {"_id": _oid(kpi_id)}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "kpi_definition", existing, updates, current_user,
        label=f"KPI — {existing.get('kpi_name')}",
        fiscal_year=existing.get("fiscal_year"),
        leader_id=existing.get("leader_id"),
    )
    return _serialize_kpi(result)


@router.delete("/kpis/{kpi_id}", status_code=204)
async def delete_kpi(
    kpi_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = await database.db.kpi_definitions.find_one({"_id": _oid(kpi_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="KPI definition not found")
    rated = await database.db.kpi_ratings.count_documents({"kpi_definition_id": kpi_id})
    if rated:
        raise HTTPException(
            status_code=409,
            detail="This KPI has ratings and cannot be deleted.",
        )
    await database.db.kpi_definitions.delete_one({"_id": _oid(kpi_id)})
    await audit_service.log_delete(
        "kpi_definition", existing, current_user,
        label=f"KPI — {existing.get('kpi_name')}",
        fiscal_year=existing.get("fiscal_year"),
        leader_id=existing.get("leader_id"),
    )


@router.get("/weights")
async def list_weights(
    layer: str = Query("fy"),
    fiscal_year: str | None = Query(None),
    leader_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    _layer_args(layer, fiscal_year, leader_id)
    docs = await fetch_weights(layer, fiscal_year, leader_id)
    by_cat = {d["category_id"]: d["weight"] for d in docs}
    return {
        "data": [_serialize_weight(d) for d in docs],
        "weights": by_cat,
        "exists": bool(docs),
    }


@router.put("/weights")
async def upsert_weights(
    body: KraWeightUpsert,
    current_user: dict = Depends(require_roles("admin")),
):
    _layer_args(body.layer, body.fiscal_year, body.leader_id)
    now = datetime.now(timezone.utc)
    fy = None if body.layer == "all_time" else body.fiscal_year
    lid = body.leader_id if body.layer == "leader" else None
    saved = []
    for category_id, weight in body.weights.items():
        q = {**layer_filter(body.layer, fy, lid), "category_id": category_id}
        existing = await database.db.kra_weight_config.find_one(q)
        if existing:
            updates = {"weight": weight, "updated_at": now}
            result = await database.db.kra_weight_config.find_one_and_update(
                {"_id": existing["_id"]}, {"$set": updates}, return_document=True
            )
            await audit_service.log_update(
                "kra_weight_config", existing, updates, current_user,
                label=f"KRA weight — {body.layer} {fy or 'all_time'} {lid or ''} {category_id}",
                leader_id=lid,
                fiscal_year=fy,
            )
            saved.append(result)
        else:
            doc = {
                "layer": body.layer,
                "fiscal_year": fy,
                "leader_id": lid,
                "category_id": category_id,
                "weight": weight,
                "created_at": now,
                "updated_at": now,
            }
            result = await database.db.kra_weight_config.insert_one(doc)
            doc["_id"] = result.inserted_id
            await audit_service.log_create(
                "kra_weight_config", doc, current_user,
                label=f"KRA weight — {body.layer} {category_id}",
                leader_id=lid,
                fiscal_year=fy,
            )
            saved.append(doc)
    return {"data": [_serialize_weight(d) for d in saved]}
