import pytest
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_user_cannot_read_other_leader(client, seed_users):
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")
    res = await client.get(
        "/api/engagements/",
        params={"leader_id": "varun", "fiscal_year": "2526"},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_management_cannot_write_other_leader(client, seed_users):
    mgmt = seed_users["mgmt"]
    headers = auth_header(mgmt["_id"], "management", "varun")
    res = await client.post(
        "/api/engagements/",
        json={
            "leader_id": "manan",
            "fiscal_year": "2526",
            "name": "Blocked Client",
            "green": 1000,
        },
        headers=headers,
    )
    assert res.status_code == 403
