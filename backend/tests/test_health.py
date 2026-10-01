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
