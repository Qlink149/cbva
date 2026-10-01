import pytest
from bson import ObjectId
from starlette.requests import Request

from app.core import database
from app.core.limiter import client_ip, login_email_limiter
from tests.conftest import auth_header


async def _login(client, email="leader@test.com", password="password123", ip="203.0.113.1"):
    return await client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers={"CF-Connecting-IP": ip},
    )


async def _make_admin():
    admin_id = ObjectId()
    await database.db.users.insert_one({
        "_id": admin_id, "full_name": "Adm", "email": "adm@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
    })
    return admin_id


@pytest.mark.asyncio
async def test_password_change_revokes_refresh_tokens(client, seed_users):
    login_email_limiter.reset()
    res = await _login(client, ip="203.0.113.10")
    assert res.status_code == 200
    refresh = res.json()["refresh_token"]
    user = await database.db.users.find_one({"email": "leader@test.com"})
    assert user["refresh_token_hashes"]

    admin_id = await _make_admin()
    res = await client.put(
        f"/api/admin/users/{user['_id']}",
        json={"password": "a-brand-new-password"},
        headers=auth_header(admin_id, "admin", None),
    )
    assert res.status_code == 200
    user = await database.db.users.find_one({"_id": user["_id"]})
    assert user["refresh_token_hashes"] == []
    res = await client.post("/api/auth/refresh", json={"refresh_token": refresh}, headers={"CF-Connecting-IP": "203.0.113.11"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_deactivation_revokes_refresh_tokens(client, seed_users):
    login_email_limiter.reset()
    res = await _login(client, ip="203.0.113.20")
    assert res.status_code == 200
    user = await database.db.users.find_one({"email": "leader@test.com"})
    admin_id = await _make_admin()
    res = await client.delete(f"/api/admin/users/{user['_id']}", headers=auth_header(admin_id, "admin", None))
    assert res.status_code == 204
    user = await database.db.users.find_one({"_id": user["_id"]})
    assert user["refresh_token_hashes"] == [] and user["is_active"] is False


@pytest.mark.asyncio
async def test_per_email_login_limit(client, seed_users):
    login_email_limiter.reset()
    codes = []
    for i in range(12):
        # distinct client IPs so only the per-email limiter (not slowapi's per-IP 5/min) can trip
        res = await _login(client, password="wrong", ip=f"198.51.100.{i + 1}")
        codes.append(res.status_code)
    assert codes[:10] == [401] * 10
    assert codes[10:] == [429, 429]
    login_email_limiter.reset()


def test_cf_connecting_ip_is_rate_limit_key():
    scope = {"type": "http", "headers": [(b"cf-connecting-ip", b"198.51.100.7")], "client": ("10.0.0.5", 1234)}
    assert client_ip(Request(scope)) == "198.51.100.7"
    scope["headers"] = []
    assert client_ip(Request(scope)) == "10.0.0.5"
