"""Every route answers the same with and without a trailing slash, without any redirect.

Behind Caddy, FastAPI's 307 slash redirect pointed at http:// and the browser blocked it (leaders, baselines and
21 other frontend calls never loaded). redirect_slashes=False + TrailingSlashNormalizerMiddleware serve both
spellings directly.
"""
import re
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core import database
from app.core.limiter import login_email_limiter
from app.main import app
from tests.conftest import auth_header

REDIRECTS = {301, 302, 303, 307, 308}
DUMMY_ID = "64b0c0ffee0000000000c0de"


def _all_routes():
    """(path, method) for every route, including those inside included routers (FastAPI 0.13x keeps them lazy)."""
    def walk(routes):
        for r in routes:
            if hasattr(r, "effective_route_contexts"):
                yield from r.effective_route_contexts()
            elif getattr(r, "methods", None):
                yield r
    out = set()
    for r in walk(app.routes):
        for m in r.methods:
            if m not in ("HEAD", "OPTIONS"):
                out.add((r.path, m))
    return sorted(out)


ROUTES = _all_routes()


def test_route_inventory_is_complete():
    paths = {p for p, _ in ROUTES}
    # sanity: the routes from the prod bug report and both spellings' owners are present
    for p in ("/api/leaders/", "/api/baselines/", "/api/engagements/", "/api/auth/login", "/health"):
        assert p in paths, p
    assert len(ROUTES) > 100


def _toggle(path: str) -> str:
    return path[:-1] if path.endswith("/") else path + "/"


@pytest.fixture
async def admin_headers(client):
    admin_id = ObjectId()
    await database.db.users.insert_one({
        "_id": admin_id, "full_name": "Slash Admin", "email": "slash-admin@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
        "created_at": datetime.now(timezone.utc),
    })
    return auth_header(admin_id, "admin", None)


@pytest.mark.asyncio
async def test_every_route_same_status_with_and_without_trailing_slash(client, admin_headers):
    login_email_limiter.reset()
    mismatches, redirects, server_errors = [], [], set()
    # raise_app_exceptions=False: a handler crash is compared as a 500 instead of aborting the sweep
    sweep = AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test")
    for i, (path, method) in enumerate(ROUTES):
        concrete = re.sub(r"\{[^}]+\}", DUMMY_ID, path)
        # a distinct client IP per route keeps the per-IP login limit out of the comparison
        headers = {**admin_headers, "X-Real-IP": f"198.18.{i // 250}.{i % 250 + 1}"}
        body = {} if method in ("POST", "PUT", "PATCH") else None
        results = []
        for p in (concrete, _toggle(concrete)):
            res = await sweep.request(method, p, headers=headers, json=body)
            results.append(res)
            if res.status_code >= 500:
                server_errors.add(f"{method} {path} -> {res.status_code}")
            if res.status_code in REDIRECTS or "location" in res.headers:
                redirects.append(f"{method} {p} -> {res.status_code} location={res.headers.get('location')}")
        if results[0].status_code != results[1].status_code:
            mismatches.append(f"{method} {path}: {results[0].status_code} vs {results[1].status_code} (toggled slash)")
    await sweep.aclose()
    login_email_limiter.reset()
    if server_errors:   # pre-existing handler bugs with an empty body; reported, not part of this check
        print("server errors (same on both spellings):", sorted(server_errors))
    assert not redirects, redirects
    assert not mismatches, mismatches


@pytest.mark.asyncio
async def test_leaders_and_baselines_without_slash_return_data(client, admin_headers):
    """The two endpoints from the prod report."""
    await database.db.leaders.insert_one({"_id": "slashleader", "name": "Slash", "practice": "Tax", "is_active": True})
    for path in ("/api/leaders", "/api/leaders/", "/api/baselines", "/api/baselines/"):
        res = await client.get(path, headers=admin_headers)
        assert res.status_code == 200, (path, res.status_code, res.text[:200])
        assert "location" not in res.headers
    a = (await client.get("/api/leaders", headers=admin_headers)).json()
    b = (await client.get("/api/leaders/", headers=admin_headers)).json()
    assert a == b and any(x.get("id") == "slashleader" for x in a)


@pytest.mark.asyncio
async def test_post_without_slash_keeps_body_and_auth(client, seed_users):
    """No redirect hop: the POST body and Authorization header reach the handler unchanged."""
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")
    res = await client.post("/api/tasks", headers=headers, json={"leader_id": "manan", "title": "no-slash task"})
    assert res.status_code == 201, res.text[:300]
    assert res.json()["title"] == "no-slash task"
    assert await database.db.tasks.find_one({"_id": ObjectId(res.json()["id"]), "title": "no-slash task"})
    # and without credentials the same path is refused, i.e. auth is really evaluated (not bypassed)
    assert (await client.post("/api/tasks", json={"leader_id": "manan", "title": "x"})).status_code in (401, 403)


@pytest.mark.asyncio
async def test_unknown_paths_still_404_both_ways(client):
    for p in ("/api/does-not-exist", "/api/does-not-exist/"):
        res = await client.get(p)
        assert res.status_code == 404 and "location" not in res.headers
