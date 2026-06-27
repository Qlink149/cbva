import pytest


@pytest.mark.asyncio
async def test_login_success(client, seed_users):
    res = await client.post("/api/auth/login", json={"email": "leader@test.com", "password": "password123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "leader@test.com"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client, seed_users):
    res = await client.post("/api/auth/login", json={"email": "leader@test.com", "password": "wrong"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    res = await client.get("/api/auth/me")
    assert res.status_code == 403 or res.status_code == 401
