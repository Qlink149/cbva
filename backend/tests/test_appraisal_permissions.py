"""KRA/appraisal rater rules, weight fallback, combined-score stub, submit freeze."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from bson import ObjectId

from app.core import database
from app.core.security import hash_password
from app.services.appraisal_rollup import compute_combined_score, overall_weighted_avg
from tests.conftest import auth_header

FY = "2627"


def test_combined_score_stub_has_no_formula():
    assert compute_combined_score(3.87, 3.05) is None
    assert overall_weighted_avg(
        [{"id": "k1", "category_id": "client_delivery", "sub_weight": 0.3}],
        {"k1": 5.0},
        {"client_delivery": 1.0},
    ) == pytest.approx(5.0)


@pytest_asyncio.fixture
async def kra_setup(client, seed_users):
    now = datetime.now(timezone.utc)
    await database.db.financial_years.delete_many({"slug": FY})
    await database.db.financial_years.insert_one(
        {
            "slug": FY,
            "label": "FY 26-27",
            "is_current": True,
            "is_active": True,
            "is_editable": True,
            "sort_order": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    await database.db.kra_categories.delete_many({})
    await database.db.kra_categories.insert_many(
        [
            {"_id": "client_delivery", "name": "Client Delivery", "sort_order": 1, "created_at": now, "updated_at": now},
            {"_id": "business_development", "name": "Business Development", "sort_order": 2, "created_at": now, "updated_at": now},
        ]
    )
    await database.db.kra_weight_config.delete_many({})
    await database.db.kra_weight_config.insert_many(
        [
            {
                "layer": "fy",
                "fiscal_year": FY,
                "leader_id": None,
                "category_id": "client_delivery",
                "weight": 1.0,
                "created_at": now,
                "updated_at": now,
            },
        ]
    )
    await database.db.kpi_definitions.delete_many({})
    kpi = {
        "_id": ObjectId(),
        "layer": "fy",
        "fiscal_year": FY,
        "leader_id": None,
        "category_id": "client_delivery",
        "kpi_name": "Test KPI",
        "sub_weight": 0.30,
        "rating_band_text": "1-5",
        "target_measurement_text": "",
        "frequency_source": "",
        "sort_order": 1,
        "created_at": now,
        "updated_at": now,
    }
    await database.db.kpi_definitions.insert_one(kpi)
    await database.db.leadership_competencies.delete_many({})
    await database.db.leadership_competencies.insert_one(
        {
            "_id": "client_centricity",
            "key": "client_centricity",
            "layer": "all_time",
            "fiscal_year": None,
            "leader_id": None,
            "name": "Client Centricity",
            "criteria_text": "Test criteria",
            "weight": 0.05,
            "sort_order": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    admin_doc = {
        "_id": ObjectId(),
        "full_name": "Test Admin",
        "email": "admin-kra@test.com",
        "password_hash": hash_password("password123"),
        "designation": "Partner",
        "role": "admin",
        "leader_id": "manan",
        "is_active": True,
        "created_at": now,
        "refresh_token_hashes": [],
    }
    await database.db.users.insert_one(admin_doc)
    yield {"kpi_id": str(kpi["_id"]), "admin": admin_doc, **seed_users}


def _user(seed):
    u = seed["user"]
    return auth_header(u["_id"], "user", "manan")


def _mgmt(seed):
    u = seed["mgmt"]
    return auth_header(u["_id"], "management", "varun")


def _admin(seed):
    u = seed["admin"]
    return auth_header(u["_id"], "admin", "manan")


async def _round_id(client, headers, leader_id, round_type):
    res = await client.get(
        "/api/appraisals/rounds",
        params={"leader_id": leader_id, "fiscal_year": FY},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    match = next(r for r in res.json()["data"] if r["round_type"] == round_type)
    return match["id"]


@pytest.mark.asyncio
async def test_user_cannot_rate_mgmt_round(client, kra_setup):
    headers = _user(kra_setup)
    rid = await _round_id(client, headers, "manan", "mgmt_yearend")
    res = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 4, "comment": "x"}]},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_read_other_leader_rounds(client, kra_setup):
    headers = _user(kra_setup)
    res = await client.get(
        "/api/appraisals/rounds",
        params={"leader_id": "varun", "fiscal_year": FY},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_management_cannot_rate_self_round(client, kra_setup):
    headers = _mgmt(kra_setup)
    rid = await _round_id(client, headers, "manan", "self_yearend")
    res = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 3}]},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_management_can_rate_any_leader_mgmt_round(client, kra_setup):
    headers = _mgmt(kra_setup)
    rid = await _round_id(client, headers, "manan", "mgmt_yearend")
    res = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 3.5, "comment": "ok"}]},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["kpi_ratings"][0]["rating"] == 3.5


@pytest.mark.asyncio
async def test_admin_cannot_rate_self_round(client, kra_setup):
    headers = _admin(kra_setup)
    rid = await _round_id(client, headers, "manan", "self_yearend")
    res = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 4}]},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_rate_mgmt_round(client, kra_setup):
    headers = _admin(kra_setup)
    rid = await _round_id(client, headers, "manan", "mgmt_midyear")
    res = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 2}]},
        headers=headers,
    )
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_weight_fallback_when_no_override(client, kra_setup):
    headers = _admin(kra_setup)
    res = await client.get(
        "/api/kra/resolved",
        params={"fiscal_year": FY, "leader_id": "manan"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["weight_layer"] == "fy"
    assert body["weights"]["client_delivery"] == 1.0
    assert body["has_leader_copy"] is False


@pytest.mark.asyncio
async def test_combined_score_always_null(client, kra_setup):
    headers = _user(kra_setup)
    self_id = await _round_id(client, headers, "manan", "self_yearend")
    await client.put(
        f"/api/appraisals/rounds/{self_id}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 5}]},
        headers=headers,
    )
    res = await client.get(
        "/api/appraisals/scorecard",
        params={"leader_id": "manan", "fiscal_year": FY, "period": "yearend"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["combined_score"] is None
    assert body["combined_score_status"] == "pending_spec"
    assert body["overall"]["self_wg_avg"] == pytest.approx(5.0)


@pytest.mark.asyncio
async def test_submit_then_write_forbidden(client, kra_setup):
    headers = _user(kra_setup)
    rid = await _round_id(client, headers, "manan", "self_midyear")
    put = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 4}]},
        headers=headers,
    )
    assert put.status_code == 200, put.text
    sub = await client.post(f"/api/appraisals/rounds/{rid}/submit", headers=headers)
    assert sub.status_code == 200, sub.text
    assert sub.json()["state"] == "submitted"
    again = await client.put(
        f"/api/appraisals/rounds/{rid}/ratings",
        json={"kpi_ratings": [{"kpi_definition_id": kra_setup["kpi_id"], "rating": 1}]},
        headers=headers,
    )
    assert again.status_code == 403
