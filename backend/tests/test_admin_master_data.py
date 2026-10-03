"""POST /api/admin/clients and /api/admin/engagement-types: typed bodies, JSON-safe responses.

Both handlers used to take a raw dict and return it with the Mongo ObjectId still inside, so every create
answered 500 (after inserting the document) and an empty or arbitrary body was stored as-is.
"""
from datetime import datetime, timezone

import pytest
from bson import ObjectId

from app.core import database
from tests.conftest import auth_header


_ADMIN_ID = ObjectId()


@pytest.fixture(autouse=True)
async def _seed_admin(client):
    await database.db.users.insert_one({
        "_id": _ADMIN_ID, "full_name": "Master Data Admin", "email": "md-admin@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
        "created_at": datetime.now(timezone.utc),
    })


def _admin(_seed_users=None):
    return auth_header(_ADMIN_ID, "admin", None)


@pytest.mark.asyncio
async def test_create_client_returns_201_and_json(client, seed_users):
    res = await client.post("/api/admin/clients", headers=_admin(seed_users),
                            json={"name": "  Acme Ltd ", "type": "Corporate", "status": "Active"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Acme Ltd" and body["type"] == "Corporate" and "_id" not in body
    doc = await database.db.clients.find_one({"_id": ObjectId(body["id"])})
    assert doc["name"] == "Acme Ltd"
    listed = (await client.get("/api/admin/clients", headers=_admin(seed_users))).json()["data"]
    assert any(c["id"] == body["id"] for c in listed)


@pytest.mark.asyncio
async def test_create_engagement_type_returns_201_and_json(client, seed_users):
    res = await client.post("/api/admin/engagement-types", headers=_admin(seed_users), json={"name": "Audit", "is_active": True})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body == {"name": "Audit", "is_active": True, "id": body["id"]}
    assert await database.db.engagement_types.find_one({"_id": ObjectId(body["id"])})


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/admin/clients", "/api/admin/engagement-types"])
@pytest.mark.parametrize("payload", [{}, {"name": ""}, {"name": "   "}, {"name": None}, {"name": "x" * 201}, [], "text"])
async def test_invalid_bodies_are_422_and_store_nothing(client, seed_users, path, payload):
    coll = database.db.clients if "clients" in path else database.db.engagement_types
    before = await coll.count_documents({})
    res = await client.post(path, headers=_admin(seed_users), json=payload)
    assert res.status_code == 422, (payload, res.status_code, res.text[:200])
    assert await coll.count_documents({}) == before


@pytest.mark.asyncio
async def test_unknown_fields_are_not_stored(client, seed_users):
    res = await client.post("/api/admin/clients", headers=_admin(seed_users),
                            json={"name": "Beta", "_id": "attacker-chosen", "is_admin": True})
    assert res.status_code == 201, res.text
    doc = await database.db.clients.find_one({"_id": ObjectId(res.json()["id"])})
    assert "is_admin" not in doc and doc["_id"] != "attacker-chosen"


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/admin/clients", "/api/admin/engagement-types"])
async def test_non_admin_cannot_create(client, seed_users, path):
    u = seed_users["user"]
    res = await client.post(path, headers=auth_header(u["_id"], "user", "manan"), json={"name": "X"})
    assert res.status_code == 403
