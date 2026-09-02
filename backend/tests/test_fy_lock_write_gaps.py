"""FY-lock on previously unguarded write paths: fy-actuals, baselines, el-summary, pipeline snapshots."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from bson import ObjectId

from app.core import database
from app.core.security import hash_password
from tests.conftest import auth_header

LOCKED_FY = "2425"
EDITABLE_FY = "2627"


@pytest_asyncio.fixture
async def seed_fys_and_admin(client, seed_users):
    now = datetime.now(timezone.utc)
    await database.db.financial_years.delete_many({"slug": {"$in": [LOCKED_FY, EDITABLE_FY]}})
    await database.db.financial_years.insert_many(
        [
            {
                "slug": LOCKED_FY,
                "label": "FY 24-25",
                "is_current": False,
                "is_active": True,
                "is_editable": False,
                "sort_order": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "slug": EDITABLE_FY,
                "label": "FY 26-27",
                "is_current": True,
                "is_active": True,
                "is_editable": True,
                "sort_order": 1,
                "created_at": now,
                "updated_at": now,
            },
        ]
    )
    admin_doc = {
        "_id": ObjectId(),
        "full_name": "Test Admin",
        "email": "admin@test.com",
        "password_hash": hash_password("password123"),
        "designation": "Partner",
        "role": "admin",
        "leader_id": "manan",
        "is_active": True,
        "created_at": now,
        "refresh_token_hashes": [],
    }
    await database.db.users.insert_one(admin_doc)
    yield {"admin": admin_doc, **seed_users}
    await database.db.pipeline_snapshots.delete_many({})
    await database.db.baseline_plans.delete_many({})
    await database.db.el_summaries.delete_many({})
    await database.db.financial_years.delete_many({"slug": {"$in": [LOCKED_FY, EDITABLE_FY]}})


def _user_headers(seed):
    user = seed["user"]
    return auth_header(user["_id"], "user", "manan")


def _admin_headers(seed):
    admin = seed["admin"]
    return auth_header(admin["_id"], "admin", "manan")


def _mgmt_headers(seed):
    mgmt = seed["mgmt"]
    return auth_header(mgmt["_id"], "management", "varun")


async def _insert_snapshot(fiscal_year: str, leader_id: str = "manan") -> str:
    now = datetime.now(timezone.utc)
    result = await database.db.pipeline_snapshots.insert_one(
        {
            "leader_id": leader_id,
            "fiscal_year": fiscal_year,
            "label": f"Test snapshot {leader_id} {fiscal_year}",
            "sort_order": 0,
            "green": 10,
            "amber": 0,
            "blue_sky": 0,
            "total": 10,
            "snapshot_type": "monthly",
            "created_at": now,
            "updated_at": now,
        }
    )
    return str(result.inserted_id)


async def _insert_el_summary(fiscal_year: str) -> str:
    now = datetime.now(timezone.utc)
    result = await database.db.el_summaries.insert_one(
        {
            "leader_id": "manan",
            "fiscal_year": fiscal_year,
            "to_receive_may": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    return str(result.inserted_id)


async def _insert_baseline(*, fiscal_year: str, is_locked: bool = False) -> str:
    now = datetime.now(timezone.utc)
    result = await database.db.baseline_plans.insert_one(
        {
            "leader_id": "manan",
            "financial_year_id": fiscal_year,
            "baseline_green": 10,
            "baseline_amber": 0,
            "baseline_blue_sky": 0,
            "baseline_total": 10,
            "is_locked": is_locked,
            "created_at": now,
            "updated_at": now,
        }
    )
    return str(result.inserted_id)


@pytest.mark.asyncio
async def test_fy_actuals_locked_rejected_for_user(client, seed_fys_and_admin):
    res = await client.put(
        "/api/pipeline/fy-actuals",
        json={"leader_id": "manan", "fiscal_year": LOCKED_FY, "green": 100},
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_fy_actuals_locked_allowed_for_admin(client, seed_fys_and_admin):
    res = await client.put(
        "/api/pipeline/fy-actuals",
        json={"leader_id": "manan", "fiscal_year": LOCKED_FY, "green": 100},
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 200
    assert res.json()["fiscal_year"] == LOCKED_FY


@pytest.mark.asyncio
async def test_baseline_post_locked_fy_rejected_for_user(client, seed_fys_and_admin):
    res = await client.post(
        "/api/baselines/",
        json={
            "leader_id": "manan",
            "financial_year_id": LOCKED_FY,
            "baseline_green": 50,
        },
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_baseline_post_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    res = await client.post(
        "/api/baselines/",
        json={
            "leader_id": "manan",
            "financial_year_id": LOCKED_FY,
            "baseline_green": 50,
        },
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_baseline_put_locked_fy_rejected_for_user(client, seed_fys_and_admin):
    baseline_id = await _insert_baseline(fiscal_year=LOCKED_FY, is_locked=False)
    res = await client.put(
        f"/api/baselines/{baseline_id}",
        json={"baseline_green": 99},
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_baseline_put_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    baseline_id = await _insert_baseline(fiscal_year=LOCKED_FY, is_locked=False)
    res = await client.put(
        f"/api/baselines/{baseline_id}",
        json={"baseline_green": 99},
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 200
    assert res.json()["baseline_green"] == 99


@pytest.mark.asyncio
async def test_baseline_is_locked_rejected_for_user_on_editable_fy(client, seed_fys_and_admin):
    baseline_id = await _insert_baseline(fiscal_year=EDITABLE_FY, is_locked=True)
    res = await client.put(
        f"/api/baselines/{baseline_id}",
        json={"baseline_green": 99},
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_baseline_is_locked_allowed_for_admin_on_editable_fy(client, seed_fys_and_admin):
    baseline_id = await _insert_baseline(fiscal_year=EDITABLE_FY, is_locked=True)
    res = await client.put(
        f"/api/baselines/{baseline_id}",
        json={"baseline_green": 99},
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 200
    assert res.json()["baseline_green"] == 99


@pytest.mark.asyncio
async def test_el_summary_put_locked_fy_rejected_for_user(client, seed_fys_and_admin):
    summary_id = await _insert_el_summary(LOCKED_FY)
    res = await client.put(
        f"/api/el-summary/{summary_id}",
        json={"to_receive_may": 5},
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_el_summary_put_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    summary_id = await _insert_el_summary(LOCKED_FY)
    res = await client.put(
        f"/api/el-summary/{summary_id}",
        json={"to_receive_may": 5},
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 200


_SNAPSHOT_POST = {
    "leader_id": "manan",
    "fiscal_year": LOCKED_FY,
    "label": "Locked FY snapshot",
    "green": 10,
    "total": 10,
}


@pytest.mark.asyncio
async def test_snapshot_post_locked_fy_rejected_for_user(client, seed_fys_and_admin):
    res = await client.post(
        "/api/pipeline/",
        json=_SNAPSHOT_POST,
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_snapshot_post_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    res = await client.post(
        "/api/pipeline/",
        json=_SNAPSHOT_POST,
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 201
    assert res.json()["fiscal_year"] == LOCKED_FY


@pytest.mark.asyncio
async def test_snapshot_put_locked_fy_rejected_for_user(client, seed_fys_and_admin):
    snapshot_id = await _insert_snapshot(LOCKED_FY)
    res = await client.put(
        f"/api/pipeline/{snapshot_id}",
        json={"green": 99},
        headers=_user_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_snapshot_put_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    snapshot_id = await _insert_snapshot(LOCKED_FY)
    res = await client.put(
        f"/api/pipeline/{snapshot_id}",
        json={"green": 99},
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 200
    assert res.json()["green"] == 99


@pytest.mark.asyncio
async def test_snapshot_delete_locked_fy_rejected_for_management(client, seed_fys_and_admin):
    snapshot_id = await _insert_snapshot(LOCKED_FY, leader_id="varun")
    res = await client.delete(
        f"/api/pipeline/{snapshot_id}",
        headers=_mgmt_headers(seed_fys_and_admin),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_snapshot_delete_locked_fy_allowed_for_admin(client, seed_fys_and_admin):
    snapshot_id = await _insert_snapshot(LOCKED_FY)
    res = await client.delete(
        f"/api/pipeline/{snapshot_id}",
        headers=_admin_headers(seed_fys_and_admin),
    )
    assert res.status_code == 204
