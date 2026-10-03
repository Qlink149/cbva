"""Smoke tests: engagement action points share one collection for create + list (A5/B3)."""
from datetime import datetime, timezone

import pytest
from app.core import database
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_engagement_action_create_and_list(client, seed_users):
    user = seed_users["user"]
    headers = auth_header(user["_id"], "user", "manan")
    now = datetime.now(timezone.utc)
    await database.db.financial_years.insert_one({
        "slug": "2627",
        "label": "FY 2026-27",
        "is_current": True,
        "is_editable": True,
        "is_active": True,
        "sort_order": 1,
        "created_at": now,
        "updated_at": now,
    })

    eng_res = await client.post(
        "/api/engagements/",
        json={
            "leader_id": "manan",
            "fiscal_year": "2627",
            "name": "Gora Corp",
            "green": 1_000_000,
            "amber": 0,
            "blue_sky": 0,
            "collected": 0,
        },
        headers=headers,
    )
    assert eng_res.status_code == 201
    eng_id = eng_res.json()["id"]

    create_res = await client.post(
        "/api/engagement-actions/",
        json={
            "engagement_id": eng_id,
            "leader_id": "manan",
            "fiscal_year": "2627",
            "description": "Follow up on EL",
            "deadline": "2026-09-16",
            "remarks": "One-line update",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    action = create_res.json()
    assert action["status"] == "Pending"
    assert action["client_name"] == "Gora Corp"
    assert action["remarks"] == "One-line update"

    list_res = await client.get(
        "/api/engagement-actions/",
        params={"leader_id": "manan", "fiscal_year": "2627"},
        headers=headers,
    )
    assert list_res.status_code == 200
    ids = [a["id"] for a in list_res.json()["data"]]
    assert action["id"] in ids

    pending_res = await client.get(
        "/api/engagement-actions/",
        params={"leader_id": "manan", "fiscal_year": "2627", "status": "Pending"},
        headers=headers,
    )
    assert pending_res.status_code == 200
    assert any(a["id"] == action["id"] for a in pending_res.json()["data"])
