"""Three-layer KRA resolve and clone (independent copies)."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from bson import ObjectId

from app.core import database
from app.core.security import hash_password
from tests.conftest import auth_header

FY = "2627"


@pytest_asyncio.fixture
async def resolve_setup(client, seed_users):
    now = datetime.now(timezone.utc)
    await database.db.kpi_definitions.delete_many({})
    await database.db.kra_weight_config.delete_many({})
    await database.db.leadership_competencies.delete_many({})
    await database.db.kra_categories.delete_many({})
    await database.db.kra_categories.insert_one(
        {"_id": "client_delivery", "name": "Client Delivery", "sort_order": 1, "created_at": now, "updated_at": now}
    )
    await database.db.kpi_definitions.insert_one(
        {
            "layer": "all_time",
            "fiscal_year": None,
            "leader_id": None,
            "category_id": "client_delivery",
            "kpi_name": "All-time KPI",
            "sub_weight": 0.3,
            "rating_band_text": "",
            "target_measurement_text": "",
            "frequency_source": "",
            "sort_order": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    await database.db.kra_weight_config.insert_one(
        {
            "layer": "all_time",
            "fiscal_year": None,
            "leader_id": None,
            "category_id": "client_delivery",
            "weight": 1.0,
            "created_at": now,
            "updated_at": now,
        }
    )
    await database.db.leadership_competencies.insert_one(
        {
            "_id": "client_centricity",
            "key": "client_centricity",
            "layer": "all_time",
            "name": "Client Centricity",
            "criteria_text": "all-time criteria",
            "weight": 0.05,
            "sort_order": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    admin = {
        "_id": ObjectId(),
        "full_name": "Resolve Admin",
        "email": "admin-resolve@test.com",
        "password_hash": hash_password("password123"),
        "designation": "Partner",
        "role": "admin",
        "leader_id": "manan",
        "is_active": True,
        "created_at": now,
        "refresh_token_hashes": [],
    }
    await database.db.users.insert_one(admin)
    yield {"admin": admin, **seed_users}


def _admin(seed):
    u = seed["admin"]
    return auth_header(u["_id"], "admin", "manan")


def _user(seed):
    u = seed["user"]
    return auth_header(u["_id"], "user", "manan")


@pytest.mark.asyncio
async def test_resolve_falls_back_to_all_time(client, resolve_setup):
    headers = _user(resolve_setup)
    res = await client.get(
        "/api/kra/resolved",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["kpi_layer"] == "all_time"
    assert body["kpis"][0]["kpi_name"] == "All-time KPI"
    assert body["has_fy_copy"] is False
    assert body["has_leader_copy"] is False


@pytest.mark.asyncio
async def test_copy_fy_then_edit_all_time_leaves_fy(client, resolve_setup):
    headers = _admin(resolve_setup)
    copy = await client.post(
        "/api/kra/copy",
        json={"target_layer": "fy", "fiscal_year": FY},
        headers=headers,
    )
    assert copy.status_code == 201, copy.text
    kpis = await client.get("/api/kra/kpis", params={"layer": "fy", "fiscal_year": FY}, headers=headers)
    fy_id = kpis.json()["data"][0]["id"]
    await client.put(
        f"/api/kra/kpis/{fy_id}",
        json={"kpi_name": "FY KPI copy"},
        headers=headers,
    )
    all_time = await client.get("/api/kra/kpis", params={"layer": "all_time"}, headers=headers)
    all_id = all_time.json()["data"][0]["id"]
    await client.put(
        f"/api/kra/kpis/{all_id}",
        json={"kpi_name": "All-time changed"},
        headers=headers,
    )
    fy_again = await client.get("/api/kra/kpis", params={"layer": "fy", "fiscal_year": FY}, headers=headers)
    assert fy_again.json()["data"][0]["kpi_name"] == "FY KPI copy"
    resolved = await client.get(
        "/api/kra/resolved",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert resolved.json()["kpi_layer"] == "fy"
    assert resolved.json()["kpis"][0]["kpi_name"] == "FY KPI copy"


@pytest.mark.asyncio
async def test_leader_copy_then_remove_falls_back(client, resolve_setup):
    headers = _admin(resolve_setup)
    await client.post("/api/kra/copy", json={"target_layer": "fy", "fiscal_year": FY}, headers=headers)
    copy = await client.post(
        "/api/kra/copy",
        json={"target_layer": "leader", "fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert copy.status_code == 201, copy.text
    kpis = await client.get(
        "/api/kra/kpis",
        params={"layer": "leader", "fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    lid = kpis.json()["data"][0]["id"]
    await client.put(f"/api/kra/kpis/{lid}", json={"kpi_name": "Leader only"}, headers=headers)
    resolved = await client.get(
        "/api/kra/resolved",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert resolved.json()["kpi_layer"] == "leader"
    assert resolved.json()["kpis"][0]["kpi_name"] == "Leader only"
    gone = await client.delete(
        "/api/kra/copy",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert gone.status_code == 200, gone.text
    after = await client.get(
        "/api/kra/resolved",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert after.json()["kpi_layer"] == "fy"
    assert after.json()["kpis"][0]["kpi_name"] != "Leader only"


@pytest.mark.asyncio
async def test_scorecard_uses_resolved_kpi_ids(client, resolve_setup):
    headers = _admin(resolve_setup)
    res = await client.get(
        "/api/appraisals/scorecard",
        params={"leader_id": "manan", "fiscal_year": FY, "period": "yearend"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["resolved_from"]["kpis"] == "all_time"
    assert body["categories"][0]["kpis"][0]["kpi_name"] == "All-time KPI"
    assert body["combined_score"] is None
