from datetime import datetime, timezone

from app.core import database

LAYERS = ("all_time", "fy", "leader")


def layer_filter(layer: str, fiscal_year: str | None = None, leader_id: str | None = None) -> dict:
    if layer == "all_time":
        return {"layer": "all_time"}
    if layer == "fy":
        return {"layer": "fy", "fiscal_year": fiscal_year}
    return {"layer": "leader", "fiscal_year": fiscal_year, "leader_id": leader_id}


async def fetch_kpis(layer: str, fiscal_year: str | None = None, leader_id: str | None = None) -> list[dict]:
    q = layer_filter(layer, fiscal_year, leader_id)
    return await database.db.kpi_definitions.find(q).sort("sort_order", 1).to_list(length=200)


async def fetch_weights(layer: str, fiscal_year: str | None = None, leader_id: str | None = None) -> list[dict]:
    q = layer_filter(layer, fiscal_year, leader_id)
    return await database.db.kra_weight_config.find(q).to_list(length=20)


async def fetch_competencies(layer: str, fiscal_year: str | None = None, leader_id: str | None = None) -> list[dict]:
    q = layer_filter(layer, fiscal_year, leader_id)
    return await database.db.leadership_competencies.find(q).sort("sort_order", 1).to_list(length=20)


async def resolve_kpis(fiscal_year: str, leader_id: str | None) -> tuple[str, list[dict]]:
    if leader_id:
        docs = await fetch_kpis("leader", fiscal_year, leader_id)
        if docs:
            return "leader", docs
    docs = await fetch_kpis("fy", fiscal_year)
    if docs:
        return "fy", docs
    return "all_time", await fetch_kpis("all_time")


async def resolve_weights(fiscal_year: str, leader_id: str | None) -> tuple[str, dict[str, float]]:
    async def as_map(layer, fy=None, lid=None):
        rows = await fetch_weights(layer, fy, lid)
        return {r["category_id"]: r["weight"] for r in rows}

    if leader_id:
        m = await as_map("leader", fiscal_year, leader_id)
        if m:
            return "leader", m
    m = await as_map("fy", fiscal_year)
    if m:
        return "fy", m
    return "all_time", await as_map("all_time")


async def resolve_competencies(fiscal_year: str, leader_id: str | None) -> tuple[str, list[dict]]:
    if leader_id:
        docs = await fetch_competencies("leader", fiscal_year, leader_id)
        if docs:
            return "leader", docs
    docs = await fetch_competencies("fy", fiscal_year)
    if docs:
        return "fy", docs
    return "all_time", await fetch_competencies("all_time")


def _target_fields(layer: str, fiscal_year: str | None, leader_id: str | None) -> dict:
    if layer == "all_time":
        return {"layer": "all_time", "fiscal_year": None, "leader_id": None}
    if layer == "fy":
        return {"layer": "fy", "fiscal_year": fiscal_year, "leader_id": None}
    return {"layer": "leader", "fiscal_year": fiscal_year, "leader_id": leader_id}


async def source_for_copy(target_layer: str, fiscal_year: str, leader_id: str | None) -> tuple[str, str | None, str | None]:
    """Parent layer to clone from. Leader prefers FY copy, else all-time."""
    if target_layer == "fy":
        return "all_time", None, None
    fy_kpis = await fetch_kpis("fy", fiscal_year)
    fy_w = await fetch_weights("fy", fiscal_year)
    fy_c = await fetch_competencies("fy", fiscal_year)
    if fy_kpis or fy_w or fy_c:
        return "fy", fiscal_year, None
    return "all_time", None, None


async def layer_has_copy(layer: str, fiscal_year: str | None, leader_id: str | None) -> bool:
    if await fetch_kpis(layer, fiscal_year, leader_id):
        return True
    if await fetch_weights(layer, fiscal_year, leader_id):
        return True
    if await fetch_competencies(layer, fiscal_year, leader_id):
        return True
    return False


async def clone_layer(
    target_layer: str,
    fiscal_year: str | None,
    leader_id: str | None,
) -> dict:
    src_layer, src_fy, src_lid = await source_for_copy(target_layer, fiscal_year or "", leader_id)
    now = datetime.now(timezone.utc)
    dest = _target_fields(target_layer, fiscal_year, leader_id)
    inserted = {"kpis": 0, "weights": 0, "competencies": 0, "source_layer": src_layer}

    kpis = await fetch_kpis(src_layer, src_fy, src_lid)
    if kpis:
        docs = []
        for k in kpis:
            docs.append({
                "layer": dest["layer"],
                "fiscal_year": dest["fiscal_year"],
                "leader_id": dest["leader_id"],
                "category_id": k["category_id"],
                "kpi_name": k["kpi_name"],
                "sub_weight": k["sub_weight"],
                "rating_band_text": k.get("rating_band_text") or "",
                "target_measurement_text": k.get("target_measurement_text") or "",
                "frequency_source": k.get("frequency_source") or "",
                "sort_order": k.get("sort_order", 0),
                "created_at": now,
                "updated_at": now,
            })
        await database.db.kpi_definitions.insert_many(docs)
        inserted["kpis"] = len(docs)

    weights = await fetch_weights(src_layer, src_fy, src_lid)
    if weights:
        docs = []
        for w in weights:
            docs.append({
                "layer": dest["layer"],
                "fiscal_year": dest["fiscal_year"],
                "leader_id": dest["leader_id"],
                "category_id": w["category_id"],
                "weight": w["weight"],
                "created_at": now,
                "updated_at": now,
            })
        await database.db.kra_weight_config.insert_many(docs)
        inserted["weights"] = len(docs)

    comps = await fetch_competencies(src_layer, src_fy, src_lid)
    if comps:
        docs = []
        for c in comps:
            docs.append({
                "layer": dest["layer"],
                "fiscal_year": dest["fiscal_year"],
                "leader_id": dest["leader_id"],
                "key": c.get("key") or str(c["_id"]),
                "name": c["name"],
                "criteria_text": c.get("criteria_text"),
                "weight": c.get("weight", 0),
                "sort_order": c.get("sort_order", 0),
                "created_at": now,
                "updated_at": now,
            })
        await database.db.leadership_competencies.insert_many(docs)
        inserted["competencies"] = len(docs)

    return inserted


async def delete_layer(layer: str, fiscal_year: str | None, leader_id: str | None) -> dict:
    q = layer_filter(layer, fiscal_year, leader_id)
    k = await database.db.kpi_definitions.delete_many(q)
    w = await database.db.kra_weight_config.delete_many(q)
    c = await database.db.leadership_competencies.delete_many(q)
    return {"kpis": k.deleted_count, "weights": w.deleted_count, "competencies": c.deleted_count}
