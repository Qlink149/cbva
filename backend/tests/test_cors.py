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
    "https://abc123.cbva.pages.dev",
    "null",
    "https://localhost:5173",           # same host, wrong scheme
    "http://localhost:5173.evil.io",  # suffix trick
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


@pytest.mark.asyncio
async def test_preflight_patch_with_authorization_header_allowed():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.options("/api/engagements/abc/remarks", headers=_preflight_headers(ALLOWED, "PATCH"))
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == ALLOWED
    allowed_headers = res.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers and "content-type" in allowed_headers
    assert "PATCH" in res.headers["access-control-allow-methods"]


@pytest.mark.asyncio
async def test_no_credentials_header_on_actual_responses():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health", headers={"Origin": ALLOWED})
        pre = await ac.options("/health", headers=_preflight_headers(ALLOWED, "GET"))
    assert res.headers["access-control-allow-origin"] == ALLOWED
    assert "access-control-allow-credentials" not in res.headers
    assert "access-control-allow-credentials" not in pre.headers


@pytest.mark.asyncio
async def test_actual_request_from_other_origin_gets_no_acao():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers
