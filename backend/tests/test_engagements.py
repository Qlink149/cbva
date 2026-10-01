import pytest
from app.services.fiscal_year import calendar_fy_slug
from datetime import datetime, timezone
from tests.conftest import auth_header, seed_editable_fy


@pytest.mark.asyncio
async def test_engagement_crud_and_totals(client, seed_users):
    FY = calendar_fy_slug()  # current FY: earlier FYs are month-locked for non-admins
    await seed_editable_fy(FY)
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")

    create_res = await client.post(
        "/api/engagements/",
        json={
            "leader_id": "manan",
            "fiscal_year": FY,
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
        params={"leader_id": "manan", "fiscal_year": FY},
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
