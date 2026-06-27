import pytest
from datetime import datetime, timezone
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_engagement_crud_and_totals(client, seed_users):
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")

    create_res = await client.post(
        "/api/engagements/",
        json={
            "leader_id": "manan",
            "fiscal_year": "2526",
            "name": "Test Client",
            "green": 100000,
            "amber": 50000,
            "blue_sky": 0,
            "collected": 25000,
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    eng = create_res.json()
    assert eng["total"] == 150000
    assert eng["balance"] == 125000

    list_res = await client.get(
        "/api/engagements/",
        params={"leader_id": "manan", "fiscal_year": "2526"},
        headers=headers,
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    eng_id = eng["id"]
    update_res = await client.put(
        f"/api/engagements/{eng_id}",
        json={"green": 200000},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["total"] == 250000

    del_res = await client.delete(f"/api/engagements/{eng_id}", headers=headers)
    assert del_res.status_code == 204
