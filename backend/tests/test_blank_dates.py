"""The UI sends "" for an empty <input type="date">; creates must not fail with 422 because of it.

Found by the deployed UI E2E run: "Add Team Member" with no joining date answered 422 (same for a hiring
requirement without an expected joining date).
"""
import pytest

from tests.conftest import auth_header, seed_editable_fy


@pytest.mark.asyncio
@pytest.mark.parametrize("path,body,field", [
    ("/api/team/", {"full_name": "No Date", "designation": "Associate", "email": "", "phone": "", "annual_cost": 0,
                    "joining_date": "", "status": "Active", "notes": "", "reports_to_member_id": None}, "joining_date"),
    ("/api/hiring/", {"role_title": "Tax Manager", "level": "Analyst", "expected_joining_date": "", "status": "Open",
                      "expected_cost": 0, "remarks": ""}, "expected_joining_date"),
    ("/api/tasks/", {"title": "No deadline", "deadline": ""}, "deadline"),
])
async def test_blank_date_from_the_ui_is_accepted(client, seed_users, path, body, field):
    await seed_editable_fy("2627", is_current=True)
    u = seed_users["user"]
    headers = auth_header(u["_id"], "user", "manan")
    res = await client.post(path, headers=headers, json={**body, "leader_id": "manan", "fiscal_year": "2627"})
    assert res.status_code == 201, res.text
    assert res.json().get(field) is None


@pytest.mark.asyncio
async def test_real_dates_and_garbage_still_validated(client, seed_users):
    await seed_editable_fy("2627", is_current=True)
    u = seed_users["user"]
    headers = auth_header(u["_id"], "user", "manan")
    base = {"leader_id": "manan", "fiscal_year": "2627", "full_name": "Dated"}
    ok = await client.post("/api/team/", headers=headers, json={**base, "joining_date": "2026-09-01"})
    assert ok.status_code == 201 and ok.json()["joining_date"].startswith("2026-09-01")
    bad = await client.post("/api/team/", headers=headers, json={**base, "joining_date": "not-a-date"})
    assert bad.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("path,body,field", [
    ("/api/team/", {"full_name": "Dated member"}, "joining_date"),
    ("/api/hiring/", {"role_title": "Dated role"}, "expected_joining_date"),
    ("/api/tasks/", {"title": "Dated task"}, "deadline"),
])
async def test_real_date_is_stored_not_500(client, seed_users, path, body, field):
    """A valid date used to crash the insert (bson cannot encode datetime.date) -> 500."""
    await seed_editable_fy("2627", is_current=True)
    u = seed_users["user"]
    headers = auth_header(u["_id"], "user", "manan")
    res = await client.post(path, headers=headers, json={**body, field: "2026-09-01", "leader_id": "manan", "fiscal_year": "2627"})
    assert res.status_code == 201, res.text
    assert str(res.json()[field]).startswith("2026-09-01")
    upd = await client.put(f"{path}{res.json()['id']}", headers=headers, json={field: "2026-10-15"})
    assert upd.status_code == 200, upd.text
    assert str(upd.json()[field]).startswith("2026-10-15")
    cleared = await client.put(f"{path}{res.json()['id']}", headers=headers, json={field: ""})
    assert cleared.status_code == 200, cleared.text
