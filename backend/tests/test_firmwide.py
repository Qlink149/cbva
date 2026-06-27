import pytest
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_firmwide_forbidden_for_user(client, seed_users):
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")
    res = await client.get("/api/firmwide/summary", params={"fiscal_year": "2526"}, headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_firmwide_allowed_for_management(client, seed_users):
    mgmt = seed_users["mgmt"]
    headers = auth_header(mgmt["_id"], "management", "varun")
    res = await client.get("/api/firmwide/summary", params={"fiscal_year": "2526"}, headers=headers)
    assert res.status_code == 200
