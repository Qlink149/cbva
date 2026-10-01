"""CORS: only the configured FRONTEND_ORIGIN may call the API from a browser."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings

ALLOWED = settings.cors_origins[0]


def _preflight_headers(origin: str, method: str = "PATCH") -> dict:
    return {
        "Origin": origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization,content-type",
    }


@pytest.mark.asyncio
async def test_preflight_allowed_origin_succeeds():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.options("/api/auth/login", headers=_preflight_headers(ALLOWED, "POST"))
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == ALLOWED
    assert "access-control-allow-credentials" not in res.headers
    methods = res.headers["access-control-allow-methods"]
    assert "PATCH" in methods and "DELETE" in methods


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", [
    "https://evil.example.com",
    "https://anything.vercel.app",
    "https://preview.cbva.pages.dev",
])
async def test_preflight_other_origin_rejected(origin):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.options("/api/auth/login", headers=_preflight_headers(origin, "POST"))
    assert res.status_code == 400
    assert "access-control-allow-origin" not in res.headers


@pytest.mark.asyncio
async def test_preflight_disallowed_header_rejected():
    headers = _preflight_headers(ALLOWED, "POST")
    headers["Access-Control-Request-Headers"] = "x-custom-evil"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.options("/api/auth/login", headers=headers)
    assert res.status_code == 400
