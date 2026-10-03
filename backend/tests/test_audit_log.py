import pytest
from app.services.fiscal_year import calendar_fy_slug
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone

from app.services.audit_service import _diff, log_event, log_update
from app.core.security import hash_password, create_access_token


class TestDiff:
    def test_detects_changes(self):
        before = {"name": "A", "amber": 100}
        updates = {"name": "B", "amber": 100}
        changes = _diff(before, updates)
        assert len(changes) == 1
        assert changes[0]["field"] == "name"
        assert changes[0]["old"] == "A"
        assert changes[0]["new"] == "B"

    def test_skips_unchanged_and_skip_list(self):
        before = {"green": 100, "updated_at": "old", "_id": "x"}
        updates = {"green": 100, "updated_at": "new", "_id": "y"}
        changes = _diff(before, updates)
        assert changes == []

    def test_redacts_password_fields(self):
        before = {"password_hash": "oldhash"}
        updates = {"password_hash": "newhash"}
        changes = _diff(before, updates)
        assert len(changes) == 1
        assert changes[0]["old"] == "•••"
        assert changes[0]["new"] == "•••"

    def test_labels_fields(self):
        before = {"blue_sky": 0}
        updates = {"blue_sky": 50}
        changes = _diff(before, updates, field_labels={"blue_sky": "Blue Sky"})
        assert changes[0]["label"] == "Blue Sky"


@pytest.mark.asyncio
async def test_log_update_skips_when_unchanged():
    user = {"_id": ObjectId(), "full_name": "Test", "role": "admin", "email": "t@test.com"}
    before = {"_id": ObjectId(), "name": "Same", "leader_id": "manan", "fiscal_year": "2526"}
    result = await log_update("engagement", before, {"name": "Same"}, user, label="Same")
    assert result is None


@pytest.mark.asyncio
async def test_log_event_never_raises_on_db_failure():
    user = {"_id": ObjectId(), "full_name": "Test", "role": "admin", "email": "t@test.com"}
    mock_db = MagicMock()
    mock_db.audit_log.insert_one = AsyncMock(side_effect=RuntimeError("db down"))
    with patch("app.services.audit_service.database.db", mock_db):
        result = await log_event(
            entity_type="engagement",
            entity_id="abc",
            entity_label="Test",
            action="created",
            user=user,
        )
        assert result is None


@pytest.mark.asyncio
async def test_engagement_update_creates_audit_entry(client, seed_users):
    from tests.conftest import seed_editable_fy
    FY = calendar_fy_slug()  # current FY: earlier FYs are month-locked for non-admins
    await seed_editable_fy(FY)
    headers = {
        "Authorization": f"Bearer {create_access_token(str(seed_users['user']['_id']), 'user', 'manan')}"
    }
    create_resp = await client.post(
        "/api/engagements/",
        json={
            "leader_id": "manan",
            "fiscal_year": FY,
            "name": "Audit Test Co",
            "green": 100000,
            "amber": 200000,
            "blue_sky": 0,
            "collected": 0,
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    eng_id = create_resp.json()["id"]

    put_resp = await client.put(
        f"/api/engagements/{eng_id}",
        json={"amber": 750000},
        headers=headers,
    )
    assert put_resp.status_code == 200

    from app.core import database
    audit_doc = await database.db.audit_log.find_one(
        {"entity_type": "engagement", "entity_id": eng_id, "action": "updated"},
        sort=[("created_at", -1)],
    )
    assert audit_doc is not None
    fields = {c["field"]: c for c in audit_doc["changes"]}
    assert "amber" in fields
    assert fields["amber"]["old"] == 200000
    assert fields["amber"]["new"] == 750000
    assert fields["total"]["derived"] is True
    assert fields["balance"]["derived"] is True
    assert audit_doc["actor_name"] == "Test Leader"


@pytest.mark.skip(reason="Stale: GET /api/audit-log/ is admin-only (app/routers/audit.py require_roles('admin')), "
                         "so per-leader scoping for non-admins is unreachable. Replaced by "
                         "test_audit_api_is_admin_only below. Re-enable if non-admin access is restored.")
@pytest.mark.asyncio
async def test_audit_api_leader_scoping(client, seed_users):
    from app.core import database
    from tests.conftest import seed_editable_fy
    FY = calendar_fy_slug()  # current FY: earlier FYs are month-locked for non-admins
    await seed_editable_fy(FY)

    now = datetime.now(timezone.utc)
    await database.db.audit_log.insert_many([
        {
            "entity_type": "engagement",
            "entity_id": "e1",
            "entity_label": "Own",
            "action": "updated",
            "changes": [{"field": "green", "label": "Green", "old": 1, "new": 2}],
            "actor_id": str(seed_users["user"]["_id"]),
            "actor_name": "Test Leader",
            "actor_role": "user",
            "leader_id": "manan",
            "fiscal_year": FY,
            "source": "ui",
            "created_at": now,
        },
        {
            "entity_type": "engagement",
            "entity_id": "e2",
            "entity_label": "Other",
            "action": "updated",
            "changes": [{"field": "green", "label": "Green", "old": 1, "new": 2}],
            "actor_id": str(seed_users["mgmt"]["_id"]),
            "actor_name": "Mgmt",
            "actor_role": "management",
            "leader_id": "varun",
            "fiscal_year": FY,
            "source": "ui",
            "created_at": now,
        },
        {
            "entity_type": "user",
            "entity_id": "u1",
            "entity_label": "secret@user.com",
            "action": "updated",
            "changes": [],
            "actor_id": "admin",
            "actor_name": "Admin",
            "actor_role": "admin",
            "leader_id": None,
            "fiscal_year": None,
            "source": "ui",
            "created_at": now,
        },
    ])

    user_headers = {
        "Authorization": f"Bearer {create_access_token(str(seed_users['user']['_id']), 'user', 'manan')}"
    }
    resp = await client.get("/api/audit-log/", headers=user_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    labels = [d["entity_label"] for d in data]
    assert "Own" in labels
    assert "Other" not in labels
    assert "secret@user.com" not in labels


@pytest.mark.asyncio
async def test_audit_api_is_admin_only(client, seed_users):
    from app.core import database

    now = datetime.now(timezone.utc)
    await database.db.audit_log.insert_one({
        "entity_type": "engagement", "entity_id": "e1", "entity_label": "Own", "action": "updated",
        "changes": [], "actor_id": "u", "actor_name": "U", "actor_role": "user",
        "leader_id": "manan", "fiscal_year": None, "source": "ui", "created_at": now,
    })
    user_headers = {"Authorization": f"Bearer {create_access_token(str(seed_users['user']['_id']), 'user', 'manan')}"}
    mgmt_headers = {"Authorization": f"Bearer {create_access_token(str(seed_users['mgmt']['_id']), 'management', 'varun')}"}
    assert (await client.get("/api/audit-log/", headers=user_headers)).status_code == 403
    assert (await client.get("/api/audit-log/", headers=mgmt_headers)).status_code == 403

    admin_id = ObjectId()
    await database.db.users.insert_one({
        "_id": admin_id, "full_name": "Adm", "email": "adm3@test.com", "password_hash": "x",
        "role": "admin", "leader_id": None, "is_active": True, "refresh_token_hashes": [],
    })
    res = await client.get("/api/audit-log/", headers={"Authorization": f"Bearer {create_access_token(str(admin_id), 'admin', None)}"})
    assert res.status_code == 200
    assert "Own" in [d["entity_label"] for d in res.json()["data"]]


@pytest.mark.asyncio
async def test_login_writes_audit_entry(client, seed_users):
    from app.core import database

    resp = await client.post(
        "/api/auth/login",
        json={"email": "leader@test.com", "password": "password123"},
    )
    assert resp.status_code == 200

    audit_doc = await database.db.audit_log.find_one(
        {"entity_type": "auth", "action": "login"},
        sort=[("created_at", -1)],
    )
    assert audit_doc is not None
    assert audit_doc["entity_label"] == "leader@test.com"
    assert audit_doc["source"] == "auth"
