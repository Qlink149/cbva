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
