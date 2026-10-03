"""Malformed input is a 4xx on every route, never a 500.

Found by the deployed E2E run: a path id that is not an ObjectId (bson InvalidId) crashed ~27 handlers, and a
non-numeric fiscal_year crashed bluesky, collections and the firmwide dashboard aggregate.
"""
import re
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core import database
from app.main import app
from tests.conftest import auth_header
from tests.test_trailing_slash import ROUTES

WRITE = {"POST", "PUT", "PATCH"}
SKIP = {("POST", "/api/auth/login"), ("POST", "/api/auth/refresh"), ("POST", "/api/auth/logout")}


@pytest.fixture
async def admin_headers(client):
    admin_id = ObjectId()
    await database.db.users.insert_one({
        "_id": admin_id, "full_name": "Bad Input Admin", "email": "bad-input-admin@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
        "created_at": datetime.now(timezone.utc),
    })
    return auth_header(admin_id, "admin", None)


def _sweep_client():
    return AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_id", ["not-an-object-id", "$where", "123"])
async def test_malformed_path_ids_are_4xx(client, admin_headers, bad_id):
    errors = []
    async with _sweep_client() as sweep:
        for path, method in ROUTES:
            if "{" not in path or (method, path) in SKIP:
                continue
            concrete = re.sub(r"\{[^}]+\}", bad_id, path)
            res = await sweep.request(method, concrete, headers=admin_headers,
                                      params={"leader_id": "manan", "fiscal_year": "2627"},
                                      json={} if method in WRITE else None)
            if res.status_code >= 500:
                errors.append(f"{method} {path} -> {res.status_code}")
    assert not errors, errors


@pytest.mark.asyncio
@pytest.mark.parametrize("fy", ["abcd", "26-7", "x", "2627x"])
async def test_malformed_fiscal_year_is_never_5xx(client, admin_headers, fy):
    errors = []
    async with _sweep_client() as sweep:
        for path, method in ROUTES:
            if method != "GET" or "{" in path:
                continue
            res = await sweep.get(path, headers=admin_headers, params={"leader_id": "manan", "fiscal_year": fy})
            if res.status_code >= 500:
                errors.append(f"GET {path} -> {res.status_code} {res.text[:80]}")
    assert not errors, errors


@pytest.mark.asyncio
async def test_invalid_id_answer_shape(client, admin_headers):
    res = await client.put("/api/tasks/not-an-object-id", headers=admin_headers, json={"title": "x"})
    assert res.status_code == 422 and res.json() == {"detail": "Invalid id"}


@pytest.mark.asyncio
async def test_duplicate_baseline_is_409_not_500(client, admin_headers):
    from tests.conftest import seed_editable_fy
    await seed_editable_fy("2627")
    await database.db.baseline_plans.create_index([("leader_id", 1), ("financial_year_id", 1)], unique=True)
    body = {"leader_id": "manan", "financial_year_id": "2627", "baseline_total": 1}
    first = await client.post("/api/baselines/", headers=admin_headers, json=body)
    assert first.status_code == 201, first.text
    second = await client.post("/api/baselines/", headers=admin_headers, json=body)
    assert second.status_code == 409, second.text
    assert await database.db.baseline_plans.count_documents({"leader_id": "manan"}) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/appraisals/rounds", "/api/appraisals/scorecard"])
@pytest.mark.parametrize("leader_id,fy,expected", [("no-such-leader", "2627", 404), ("manan", "abcd", 422)])
async def test_appraisal_gets_never_create_rounds_for_unknown_leader_or_bad_fy(
        client, admin_headers, seed_users, path, leader_id, fy, expected):
    res = await client.get(path, headers=admin_headers, params={"leader_id": leader_id, "fiscal_year": fy})
    assert res.status_code == expected, res.text
    assert await database.db.appraisal_rounds.count_documents({}) == 0
    ok = await client.get(path, headers=admin_headers, params={"leader_id": "manan", "fiscal_year": "2627"})
    assert ok.status_code == 200 and await database.db.appraisal_rounds.count_documents({"leader_id": "manan"}) == 4


@pytest.mark.asyncio
async def test_one_malformed_audit_entry_does_not_break_the_audit_list(client, admin_headers):
    """Seen on cbva_verify: entries with leader_id=123 (int) made every /api/audit-log page answer 500."""
    await database.db.audit_log.insert_one({
        "entity_type": "client", "entity_id": "x", "entity_label": 42, "action": "created", "changes": [],
        "actor_id": "a", "actor_name": "A", "actor_role": "admin", "leader_id": 123, "fiscal_year": 2627,
        "source": "ui", "created_at": datetime.now(timezone.utc),
    })
    res = await client.get("/api/audit-log/", headers=admin_headers)
    assert res.status_code == 200, res.text
    entry = res.json()["data"][0]
    assert entry["leader_id"] == "123" and entry["fiscal_year"] == "2627" and entry["entity_label"] == "42"
