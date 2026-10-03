from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import database
from app.core.serialization import serialize_datetime
from app.dependencies.auth import enforce_leader_scope, get_current_user
from app.routers.kra import _serialize_competency, _serialize_kpi
from app.schemas.kra import ROUND_TYPES, RoundRatingsUpsert
from app.services import audit_service
from app.services.appraisal_rollup import (
    category_avg,
    category_weighted_avg,
    compute_combined_score,
    overall_weighted_avg,
)
from app.services.fiscal_year import assert_fy_editable
from app.services.kra_resolve import resolve_competencies, resolve_kpis, resolve_weights

router = APIRouter()

PERIOD_ROUNDS = {
    "midyear": ("self_midyear", "mgmt_midyear"),
    "yearend": ("self_yearend", "mgmt_yearend"),
}


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def _serialize_round(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "fiscal_year": doc["fiscal_year"],
        "leader_id": doc["leader_id"],
        "round_type": doc["round_type"],
        "state": doc.get("state", "open"),
        "submitted_at": serialize_datetime(doc.get("submitted_at")),
        "submitted_by": doc.get("submitted_by"),
        "created_at": serialize_datetime(doc.get("created_at")),
        "updated_at": serialize_datetime(doc.get("updated_at")),
    }


def can_write_round(user: dict, round_doc: dict) -> bool:
    rt = round_doc["round_type"]
    if rt.startswith("self_"):
        return user.get("role") == "user" and user.get("leader_id") == round_doc["leader_id"]
    if rt.startswith("mgmt_"):
        return user.get("role") in ("management", "admin")
    return False


def _assert_can_write(user: dict, round_doc: dict) -> None:
    if not can_write_round(user, round_doc):
        raise HTTPException(status_code=403, detail="Not allowed to rate this round")
    if round_doc.get("state") in ("submitted", "locked"):
        raise HTTPException(status_code=403, detail="This round is closed for editing")


async def ensure_rounds(fiscal_year: str, leader_id: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    existing = await database.db.appraisal_rounds.find(
        {"fiscal_year": fiscal_year, "leader_id": leader_id}
    ).to_list(length=10)
    by_type = {d["round_type"]: d for d in existing}
    for round_type in ROUND_TYPES:
        if round_type in by_type:
            continue
        doc = {
            "fiscal_year": fiscal_year,
            "leader_id": leader_id,
            "round_type": round_type,
            "state": "open",
            "submitted_at": None,
            "submitted_by": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await database.db.appraisal_rounds.insert_one(doc)
        doc["_id"] = result.inserted_id
        by_type[round_type] = doc
    return [by_type[rt] for rt in ROUND_TYPES]


async def _ratings_for_round(round_id: ObjectId) -> tuple[dict, dict]:
    kpi_docs = await database.db.kpi_ratings.find({"round_id": str(round_id)}).to_list(length=200)
    comp_docs = await database.db.competency_ratings.find({"round_id": str(round_id)}).to_list(length=50)
    kpis = {
        d["kpi_definition_id"]: {
            "rating": d.get("rating"),
            "comment": d.get("comment") or "",
        }
        for d in kpi_docs
    }
    comps = {d["competency_id"]: {"rating": d.get("rating")} for d in comp_docs}
    return kpis, comps


@router.get("/rounds")
async def list_rounds(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_leader_scope(current_user, leader_id)
    rounds = await ensure_rounds(fiscal_year, leader_id)
    return {"data": [_serialize_round(r) for r in rounds]}


@router.get("/rounds/{round_id}")
async def get_round(round_id: str, current_user: dict = Depends(get_current_user)):
    doc = await database.db.appraisal_rounds.find_one({"_id": _oid(round_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Round not found")
    enforce_leader_scope(current_user, doc["leader_id"])
    kpi_map, comp_map = await _ratings_for_round(doc["_id"])
    payload = _serialize_round(doc)
    payload["kpi_ratings"] = [
        {"kpi_definition_id": k, "rating": v["rating"], "comment": v["comment"]}
        for k, v in kpi_map.items()
    ]
    payload["competency_ratings"] = [
        {"competency_id": k, "rating": v["rating"]} for k, v in comp_map.items()
    ]
    payload["can_write"] = can_write_round(current_user, doc) and doc.get("state") == "open"
    return payload


@router.put("/rounds/{round_id}/ratings")
async def upsert_ratings(
    round_id: str,
    body: RoundRatingsUpsert,
    current_user: dict = Depends(get_current_user),
):
    doc = await database.db.appraisal_rounds.find_one({"_id": _oid(round_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Round not found")
    _assert_can_write(current_user, doc)
    await assert_fy_editable(doc["fiscal_year"], current_user)
    now = datetime.now(timezone.utc)
    rater_id = str(current_user["_id"])
    rid = str(doc["_id"])

    for item in body.kpi_ratings:
        existing = await database.db.kpi_ratings.find_one(
            {"round_id": rid, "kpi_definition_id": item.kpi_definition_id}
        )
        fields = {
            "rating": item.rating,
            "comment": item.comment or "",
            "rater_id": rater_id,
            "updated_at": now,
        }
        if existing:
            await database.db.kpi_ratings.update_one({"_id": existing["_id"]}, {"$set": fields})
        else:
            await database.db.kpi_ratings.insert_one(
                {
                    "round_id": rid,
                    "kpi_definition_id": item.kpi_definition_id,
                    "created_at": now,
                    **fields,
                }
            )

    for item in body.competency_ratings:
        existing = await database.db.competency_ratings.find_one(
            {"round_id": rid, "competency_id": item.competency_id}
        )
        fields = {"rating": item.rating, "updated_at": now}
        if existing:
            await database.db.competency_ratings.update_one({"_id": existing["_id"]}, {"$set": fields})
        else:
            await database.db.competency_ratings.insert_one(
                {
                    "round_id": rid,
                    "competency_id": item.competency_id,
                    "created_at": now,
                    **fields,
                }
            )

    await database.db.appraisal_rounds.update_one(
        {"_id": doc["_id"]}, {"$set": {"updated_at": now}}
    )
    await audit_service.log_update(
        "appraisal_round", doc, {"ratings": "upserted"}, current_user,
        label=f"Appraisal ratings — {doc['leader_id']} {doc['round_type']}",
        leader_id=doc["leader_id"],
        fiscal_year=doc["fiscal_year"],
    )
    return await get_round(round_id, current_user)


@router.post("/rounds/{round_id}/submit")
async def submit_round(round_id: str, current_user: dict = Depends(get_current_user)):
    doc = await database.db.appraisal_rounds.find_one({"_id": _oid(round_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Round not found")
    _assert_can_write(current_user, doc)
    await assert_fy_editable(doc["fiscal_year"], current_user)
    now = datetime.now(timezone.utc)
    updates = {
        "state": "submitted",
        "submitted_at": now,
        "submitted_by": str(current_user["_id"]),
        "updated_at": now,
    }
    result = await database.db.appraisal_rounds.find_one_and_update(
        {"_id": doc["_id"]}, {"$set": updates}, return_document=True
    )
    await audit_service.log_update(
        "appraisal_round", doc, updates, current_user,
        label=f"Appraisal submit — {doc['leader_id']} {doc['round_type']}",
        leader_id=doc["leader_id"],
        fiscal_year=doc["fiscal_year"],
    )
    return _serialize_round(result)


@router.get("/scorecard")
async def get_scorecard(
    leader_id: str = Query(...),
    fiscal_year: str = Query(...),
    period: str = Query("yearend"),
    current_user: dict = Depends(get_current_user),
):
    if period not in PERIOD_ROUNDS:
        raise HTTPException(status_code=400, detail="period must be midyear or yearend")
    enforce_leader_scope(current_user, leader_id)
    rounds = await ensure_rounds(fiscal_year, leader_id)
    self_type, mgmt_type = PERIOD_ROUNDS[period]
    by_type = {r["round_type"]: r for r in rounds}
    self_round = by_type[self_type]
    mgmt_round = by_type[mgmt_type]
    self_kpis, self_comps = await _ratings_for_round(self_round["_id"])
    mgmt_kpis, mgmt_comps = await _ratings_for_round(mgmt_round["_id"])

    categories = await database.db.kra_categories.find({}).sort("sort_order", 1).to_list(length=20)
    kpi_layer, kpis = await resolve_kpis(fiscal_year, leader_id)
    comp_layer, competencies = await resolve_competencies(fiscal_year, leader_id)
    weight_layer, weights = await resolve_weights(fiscal_year, leader_id)

    kpi_payloads = []
    for kpi in kpis:
        kid = str(kpi["_id"])
        serialized = _serialize_kpi(kpi)
        serialized["self_rating"] = (self_kpis.get(kid) or {}).get("rating")
        serialized["self_comment"] = (self_kpis.get(kid) or {}).get("comment") or ""
        serialized["exco_rating"] = (mgmt_kpis.get(kid) or {}).get("rating")
        serialized["exco_comment"] = (mgmt_kpis.get(kid) or {}).get("comment") or ""
        serialized["feedforward"] = serialized["exco_comment"] or serialized["self_comment"]
        kpi_payloads.append(serialized)

    self_rating_map = {k["id"]: k["self_rating"] for k in kpi_payloads}
    exco_rating_map = {k["id"]: k["exco_rating"] for k in kpi_payloads}

    category_blocks = []
    for cat in categories:
        cid = str(cat["_id"])
        cat_kpis = [k for k in kpi_payloads if k["category_id"] == cid]
        self_ratings = [k["self_rating"] for k in cat_kpis]
        exco_ratings = [k["exco_rating"] for k in cat_kpis]
        self_items = [(k["sub_weight"], k["self_rating"]) for k in cat_kpis]
        exco_items = [(k["sub_weight"], k["exco_rating"]) for k in cat_kpis]
        category_blocks.append(
            {
                "id": cid,
                "name": cat["name"],
                "weight": weights.get(cid, 0),
                "sub_weight_total": sum(k["sub_weight"] for k in cat_kpis),
                "self_avg": category_avg(self_ratings),
                "self_wg_avg": category_weighted_avg(self_items),
                "exco_avg": category_avg(exco_ratings),
                "exco_wg_avg": category_weighted_avg(exco_items),
                "kpis": cat_kpis,
            }
        )

    self_overall = overall_weighted_avg(kpi_payloads, self_rating_map, weights)
    exco_overall = overall_weighted_avg(kpi_payloads, exco_rating_map, weights)

    competency_block = []
    for comp in competencies:
        cid = str(comp["_id"])
        row = _serialize_competency(comp)
        row["self_rating"] = (self_comps.get(cid) or {}).get("rating")
        row["exco_rating"] = (mgmt_comps.get(cid) or {}).get("rating")
        competency_block.append(row)

    return {
        "fiscal_year": fiscal_year,
        "leader_id": leader_id,
        "period": period,
        "combined_score": compute_combined_score(self_overall, exco_overall),
        "combined_score_status": "pending_spec",
        "resolved_from": {
            "kpis": kpi_layer,
            "weights": weight_layer,
            "competencies": comp_layer,
        },
        "overall": {
            "self_wg_avg": self_overall,
            "exco_wg_avg": exco_overall,
        },
        "categories": category_blocks,
        "competencies": competency_block,
        "rounds": {
            "self": _serialize_round(self_round),
            "mgmt": _serialize_round(mgmt_round),
        },
    }
