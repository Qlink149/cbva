import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core import database


@pytest.mark.asyncio
async def test_liveness_does_not_need_db():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health")
    assert res.status_code == 200 and res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ready_ok_with_mongo(client):
    res = await client.get("/health/ready")
    assert res.status_code == 200
    assert res.json()["db"] == "up"


@pytest.mark.asyncio
async def test_ready_503_when_ping_fails(client, monkeypatch):
    class _Broken:
        async def command(self, *a, **k):
            raise RuntimeError("mongo down")

    monkeypatch.setattr(database, "db", _Broken())
    res = await client.get("/health/ready")
    assert res.status_code == 503
    assert res.json()["db"] == "down"


@pytest.mark.asyncio
async def test_consolidated_summary_503_when_not_seeded(client, seed_users, monkeypatch):
    from bson import ObjectId
    from app.services import consolidated_service
    from tests.conftest import auth_header

    async def _nothing(*a, **k):
        return []

    monkeypatch.setattr(consolidated_service, "ensure_imported_matrix", _nothing)
    admin_id = ObjectId()
    await database.db.users.insert_one({
        "_id": admin_id, "full_name": "Adm", "email": "adm2@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
    })
    res = await client.get("/api/consolidated-summary/?fiscal_year=2627", headers=auth_header(admin_id, "admin", None))
    assert res.status_code == 503
    assert "not seeded" in res.json()["detail"]
