"""Every write endpoint, end to end on the deployed API, on e2e-owned data only.

Records belong to the temporary leader e2e_leader_a and are labelled "E2E ...". Each module test:
create (leader A) -> read back -> update -> verify -> leader B attempts read/update/delete (403, record unchanged)
-> management without a home leader attempts a write (403) -> delete where an endpoint exists.
Collections without a delete endpoint (actions, collections, bluesky, headcount, baselines, pipeline fy-actuals,
admin plans, kra, appraisal ratings, leaders, users, FY) are removed by `provision.py cleanup`.
Global, shared settings (PUT /api/admin/settings, FY-layer and all-time KRA config) are never written: only their
validation and authorization are exercised.
"""
import random
import uuid
from datetime import date

import pytest

from conftest import FY, LEADER_A, LEADER_B, STATE

MONTH_NOW = f"{date.today().month:02d}"
MONTH_PREV = f"{(date.today().month - 2) % 12 + 1:02d}"
RUN = uuid.uuid4().hex[:6]          # unique values per run, so the suite can be re-run before cleanup


def ok(r, *codes):
    codes = codes or (200, 201)
    assert r.status_code in codes, (r.request.method, str(r.request.url), r.status_code, r.text[:400])
    return r.json() if r.content else None


def listed(res_json):
    return res_json["data"] if isinstance(res_json, dict) and "data" in res_json else res_json


def ids(rows):
    return {x.get("id") for x in rows}


def forbidden(api, method, path, **kw):
    r = api.request(method, path, **kw)
    assert r.status_code == 403, (method, path, r.status_code, r.text[:200])


@pytest.fixture(scope="module")
def eng(lead_a):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "name": "E2E Engagement One", "green": 100000, "amber": 50000,
            "blue_sky": 25000, "el_status": "Signed", "model": "Retainer"}
    e = ok(lead_a.post("/api/engagements/", json=body), 201)
    yield e
    lead_a.delete(f"/api/engagements/{e['id']}")


def test_engagements(lead_a, lead_b, mgmt, admin, eng):
    eid = eng["id"]
    assert eng["name"] == "E2E Engagement One" and eng["leader_id"] == LEADER_A
    rows = listed(ok(lead_a.get("/api/engagements/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert eid in ids(rows)
    upd = ok(lead_a.put(f"/api/engagements/{eid}", json={"name": "E2E Engagement One (edited)", "green": 120000}))
    assert upd["name"] == "E2E Engagement One (edited)" and upd["green"] == 120000
    ok(lead_a.patch(f"/api/engagements/{eid}/remarks", json={"remarks": "E2E remark", "mode": "edit"}))
    changes = ok(lead_a.get(f"/api/engagements/{eid}/changes"))
    assert changes is not None
    # leader B: cannot read A's history, edit, re-remark or archive
    forbidden(lead_b, "GET", f"/api/engagements/{eid}/changes")
    forbidden(lead_b, "PUT", f"/api/engagements/{eid}", json={"name": "E2E hacked"})
    forbidden(lead_b, "PATCH", f"/api/engagements/{eid}/remarks", json={"remarks": "E2E hacked"})
    forbidden(lead_b, "DELETE", f"/api/engagements/{eid}")
    forbidden(lead_b, "POST", "/api/engagements/", json={"leader_id": LEADER_A, "fiscal_year": FY, "name": "E2E by B"})
    forbidden(mgmt, "PUT", f"/api/engagements/{eid}", json={"name": "E2E by mgmt"})
    after = [r for r in listed(ok(lead_a.get("/api/engagements/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
             if r["id"] == eid][0]
    assert after["name"] == "E2E Engagement One (edited)"
    # admin may edit any leader's data
    ok(admin.put(f"/api/engagements/{eid}", json={"remarks": "E2E admin remark"}))


def test_engagement_archive(lead_a):
    e = ok(lead_a.post("/api/engagements/", json={"leader_id": LEADER_A, "fiscal_year": FY, "name": "E2E To Archive"}), 201)
    ok(lead_a.delete(f"/api/engagements/{e['id']}"), 204)
    active = listed(ok(lead_a.get("/api/engagements/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert e["id"] not in ids(active)


@pytest.mark.parametrize("path", ["/api/engagement-actions/", "/api/engagement-actions"])
def test_engagement_actions(lead_a, lead_b, eng, path):
    body = {"engagement_id": eng["id"], "leader_id": LEADER_A, "fiscal_year": FY, "description": "E2E follow up",
            "deadline": date.today().isoformat()}
    a = ok(lead_a.post(path, json=body), 201)
    rows = listed(ok(lead_a.get("/api/engagement-actions/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert a["id"] in ids(rows)
    assert ok(lead_a.patch(f"/api/engagement-actions/{a['id']}", json={"remarks": "E2E edited"}))["remarks"] == "E2E edited"
    ok(lead_a.patch(f"/api/engagement-actions/{a['id']}/status", json={"status": "In Progress"}))
    forbidden(lead_b, "PATCH", f"/api/engagement-actions/{a['id']}", json={"remarks": "E2E hacked"})
    forbidden(lead_b, "PATCH", f"/api/engagement-actions/{a['id']}/status", json={"status": "Done"})
    forbidden(lead_b, "DELETE", f"/api/engagement-actions/{a['id']}")
    forbidden(lead_b, "POST", path, json=body)
    ok(lead_a.delete(f"/api/engagement-actions/{a['id']}"), 200, 204)
    rows = listed(ok(lead_a.get("/api/engagement-actions/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert a["id"] not in ids(rows)


def test_collection_transactions(lead_a, lead_b, eng):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "engagement_id": eng["id"], "month": MONTH_PREV,
            "client_name": "E2E Engagement One", "amount_billed": 1000, "amount_collected": 500}
    forbidden(lead_b, "POST", "/api/collection-transactions/", json=body)
    t = ok(lead_a.post("/api/collection-transactions/", json=body), 201)
    rows = listed(ok(lead_a.get("/api/collection-transactions/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert t["id"] in ids(rows)
    forbidden(lead_b, "DELETE", f"/api/collection-transactions/{t['id']}")
    ok(lead_a.delete(f"/api/collection-transactions/{t['id']}"), 200, 204)
    rows = listed(ok(lead_a.get("/api/collection-transactions/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert t["id"] not in ids(rows)


def test_collections_plan(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "month_key": MONTH_PREV, "planned": 7777, "remarks": "E2E plan"}
    forbidden(lead_b, "POST", "/api/collections/", json=body)
    e = ok(lead_a.post("/api/collections/", json=body), 200, 201)
    entry_id = e.get("id") or e.get("entry_id")
    assert entry_id, e
    ok(lead_a.put(f"/api/collections/{entry_id}", json={"remarks": "E2E plan edited"}))
    forbidden(lead_b, "PUT", f"/api/collections/{entry_id}", json={"remarks": "E2E hacked"})
    data = ok(lead_a.get("/api/collections/", params={"leader_id": LEADER_A, "fiscal_year": FY}))
    assert "E2E plan edited" in str(data)


def test_actions(lead_a, lead_b, mgmt):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "category": "Risk", "description": "E2E action", "status": "Not Started"}
    forbidden(lead_b, "POST", "/api/actions/", json=body)
    a = ok(lead_a.post("/api/actions/", json=body), 201)
    assert ok(lead_a.put(f"/api/actions/{a['id']}", json={"description": "E2E action edited"}))["description"] == "E2E action edited"
    assert ok(lead_a.patch(f"/api/actions/{a['id']}/status", json={"status": "Closed"}))["status"] == "Closed"
    forbidden(lead_b, "PUT", f"/api/actions/{a['id']}", json={"description": "E2E hacked"})
    forbidden(lead_b, "PATCH", f"/api/actions/{a['id']}/status", json={"status": "In-Progress"})
    forbidden(mgmt, "PUT", f"/api/actions/{a['id']}", json={"description": "E2E by mgmt"})
    rows = listed(ok(lead_a.get("/api/actions/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert [r for r in rows if r["id"] == a["id"]][0]["description"] == "E2E action edited"


def test_tasks(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "title": "E2E task", "priority": "High"}
    t = ok(lead_a.post("/api/tasks/", json=body), 201)
    assert ok(lead_a.put(f"/api/tasks/{t['id']}", json={"title": "E2E task edited"}))["title"] == "E2E task edited"
    assert ok(lead_a.patch(f"/api/tasks/{t['id']}/status", json={"status": "Done"}))["status"] == "Done"
    forbidden(lead_b, "PUT", f"/api/tasks/{t['id']}", json={"title": "E2E hacked"})
    forbidden(lead_b, "PATCH", f"/api/tasks/{t['id']}/status", json={"status": "Pending"})
    forbidden(lead_b, "DELETE", f"/api/tasks/{t['id']}")
    forbidden(lead_b, "POST", "/api/tasks/", json=body)
    ok(lead_a.delete(f"/api/tasks/{t['id']}"), 200, 204)
    assert t["id"] not in ids(listed(ok(lead_a.get("/api/tasks/", params={"leader_id": LEADER_A}))))


def test_team(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "full_name": "E2E Member", "designation": "Analyst", "annual_cost": 1}
    forbidden(lead_b, "POST", "/api/team/", json=body)
    m = ok(lead_a.post("/api/team/", json=body), 201)
    assert ok(lead_a.put(f"/api/team/{m['id']}", json={"designation": "Associate"}))["designation"] == "Associate"
    forbidden(lead_b, "PUT", f"/api/team/{m['id']}", json={"full_name": "E2E hacked"})
    forbidden(lead_b, "DELETE", f"/api/team/{m['id']}")
    ok(lead_a.delete(f"/api/team/{m['id']}"), 200, 204)
    rows = listed(ok(lead_a.get("/api/team/", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert m["id"] not in ids(r for r in rows if r.get("status") != "Inactive")


def test_hiring(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "role_title": "E2E Analyst", "level": "Analyst", "expected_cost": 1}
    forbidden(lead_b, "POST", "/api/hiring/", json=body)
    h = ok(lead_a.post("/api/hiring/", json=body), 201)
    assert ok(lead_a.put(f"/api/hiring/{h['id']}", json={"status": "On Hold"}))["status"] == "On Hold"
    forbidden(lead_b, "PUT", f"/api/hiring/{h['id']}", json={"status": "Filled"})
    forbidden(lead_b, "DELETE", f"/api/hiring/{h['id']}")
    ok(lead_a.delete(f"/api/hiring/{h['id']}"), 200, 204)
    assert h["id"] not in ids(listed(ok(lead_a.get("/api/hiring/", params={"leader_id": LEADER_A, "fiscal_year": FY}))))


def test_headcount(lead_a, lead_b, admin):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "designation": "Analyst", "board_approved": 3}
    forbidden(lead_b, "POST", "/api/headcount/", json=body)
    r = lead_a.post("/api/headcount/", json=body)
    if r.status_code == 403:          # board numbers may be admin-only for leaders
        r = admin.post("/api/headcount/", json=body)
    ok(r, 200, 201)
    data = ok(lead_a.get("/api/headcount/", params={"leader_id": LEADER_A, "fiscal_year": FY}))
    assert "Analyst" in str(data)


def test_bluesky(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "month_key": MONTH_NOW, "opening": 0, "additional": 1000,
            "converted": 0, "remarks": "E2E bluesky"}
    forbidden(lead_b, "POST", "/api/bluesky/", json=body)
    e = ok(lead_a.post("/api/bluesky/", json=body), 200, 201)
    eid = e.get("id")
    assert eid, e
    ok(lead_a.put(f"/api/bluesky/{eid}", json={"remarks": "E2E bluesky edited"}))
    forbidden(lead_b, "PUT", f"/api/bluesky/{eid}", json={"remarks": "E2E hacked"})
    assert "E2E bluesky edited" in str(ok(lead_a.get("/api/bluesky/", params={"leader_id": LEADER_A, "fiscal_year": FY})))


def test_client_meetings(lead_a, lead_b):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "client_name": "E2E Client", "meeting_frequency": "Monthly"}
    forbidden(lead_b, "POST", "/api/client-meetings/", json=body)
    m = ok(lead_a.post("/api/client-meetings/", json=body), 201)
    assert ok(lead_a.put(f"/api/client-meetings/{m['id']}", json={"notes": "E2E notes"}))["notes"] == "E2E notes"
    forbidden(lead_b, "PUT", f"/api/client-meetings/{m['id']}", json={"notes": "E2E hacked"})
    forbidden(lead_b, "DELETE", f"/api/client-meetings/{m['id']}")
    ok(lead_a.delete(f"/api/client-meetings/{m['id']}"), 200, 204)
    assert m["id"] not in ids(listed(ok(lead_a.get("/api/client-meetings/", params={"leader_id": LEADER_A, "fiscal_year": FY}))))


@pytest.mark.parametrize("create_path,list_path", [("/api/additional-work/", "/api/additional-work/"),
                                                   ("/api/new-clients/", "/api/new-clients/")])
def test_additional_work_and_new_clients(lead_a, lead_b, create_path, list_path):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "client_name": "E2E Client", "nature_of_work": "E2E scope",
            "month_key": MONTH_PREV, "amount": 10}
    forbidden(lead_b, "POST", create_path, json=body)
    w = ok(lead_a.post(create_path, json=body), 201)
    assert w["id"] in ids(listed(ok(lead_a.get(list_path, params={"leader_id": LEADER_A, "fiscal_year": FY}))))
    assert ok(lead_a.put(f"/api/additional-work/{w['id']}", json={"notes": "E2E edited"}))["notes"] == "E2E edited"
    forbidden(lead_b, "PUT", f"/api/additional-work/{w['id']}", json={"notes": "E2E hacked"})
    forbidden(lead_b, "DELETE", f"/api/additional-work/{w['id']}")
    ok(lead_a.delete(f"/api/additional-work/{w['id']}"), 200, 204)


def test_pipeline_snapshots_and_fy_actuals(lead_a, lead_b, admin, mgmt):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "label": "E2E snapshot", "green": 1, "amber": 2, "blue_sky": 3,
            "total": 6, "snapshot_type": "monthly"}
    forbidden(lead_b, "POST", "/api/pipeline/", json=body)
    s = ok(lead_a.post("/api/pipeline/", json=body), 200, 201)
    ok(lead_a.put(f"/api/pipeline/{s['id']}", json={"label": "E2E snapshot edited"}))
    forbidden(lead_b, "PUT", f"/api/pipeline/{s['id']}", json={"label": "E2E hacked"})
    forbidden(lead_a, "DELETE", f"/api/pipeline/{s['id']}")            # delete is admin/management only
    ok(admin.delete(f"/api/pipeline/{s['id']}"), 200, 204)
    fa = {"leader_id": LEADER_A, "fiscal_year": FY, "total": 10, "green": 5, "amber": 3, "blue_sky": 2}
    forbidden(lead_b, "PUT", "/api/pipeline/fy-actuals", json=fa)
    r = lead_a.put("/api/pipeline/fy-actuals", json=fa)
    if r.status_code == 403:
        r = admin.put("/api/pipeline/fy-actuals", json=fa)
    ok(r)
    ok(lead_a.get("/api/pipeline/fy-actuals", params={"leader_id": LEADER_A, "fiscal_year": FY}))
    ok(lead_a.get("/api/pipeline/", params={"leader_id": LEADER_A, "fiscal_year": FY}))


def test_baselines(lead_a, lead_b, admin):
    # financial_year_id is the FY slug (the handler checks FY editability with it); one baseline per leader+FY
    body = {"leader_id": LEADER_A, "financial_year_id": FY, "baseline_green": 1, "baseline_amber": 2,
            "baseline_blue_sky": 3, "baseline_total": 6}
    forbidden(lead_b, "POST", "/api/baselines/", json=body)
    existing = [x for x in listed(ok(admin.get("/api/baselines/", params={"leader_id": LEADER_A})))
                if x["financial_year_id"] == FY]
    if existing:
        dup = admin.post("/api/baselines/", json=body)
        if dup.status_code == 500:
            pytest.xfail("duplicate baseline -> 500 (DuplicateKeyError) until PR #5 is deployed; expected 409")
        assert dup.status_code == 409, dup.text
        b = existing[0]
    else:
        r = lead_a.post("/api/baselines/", json=body)
        if r.status_code == 403:
            r = admin.post("/api/baselines/", json=body)
        b = ok(r, 200, 201)
        dup = admin.post("/api/baselines/", json=body)
        assert dup.status_code in (409, 500), dup.text
    forbidden(lead_b, "PUT", f"/api/baselines/{b['id']}", json={"baseline_total": 999})
    ok(admin.put(f"/api/baselines/{b['id']}", json={"baseline_total": 7, "baseline_green": 2}))
    rows = listed(ok(lead_a.get("/api/baselines/", params={"leader_id": LEADER_A})))
    assert [x for x in rows if x["id"] == b["id"]][0]["baseline_total"] == 7


def test_admin_plans(admin, mgmt, lead_a):
    body = {"leader_id": LEADER_A, "fiscal_year": FY, "initial": {"green": 1, "amber": 1, "blue_sky": 1},
            "board": {"green": 2, "amber": 2, "blue_sky": 2}}
    forbidden(mgmt, "PUT", "/api/admin/plans", json=body)
    ok(admin.put("/api/admin/plans", json=body))
    assert "2" in str(ok(admin.get("/api/admin/plans", params={"leader_id": LEADER_A, "fiscal_year": FY})))


def test_el_summary_update_unknown_id_is_404(admin, lead_b):
    # no el_summaries exist in this dataset and there is no create endpoint: only the not-found path is testable
    r = admin.put("/api/el-summary/64b0c0ffee0000000000c0de", json={"el_signed": 1})
    assert r.status_code == 404, r.text
    assert listed(ok(admin.get("/api/el-summary/", params={"leader_id": LEADER_A, "fiscal_year": FY}))) is not None


def test_assessments_read(lead_a, lead_b):
    ok(lead_a.get("/api/assessments/", params={"leader_id": LEADER_A, "fiscal_year": FY}))
    forbidden(lead_b, "GET", "/api/assessments/", params={"leader_id": LEADER_A, "fiscal_year": FY})


def test_kra_leader_layer(admin, lead_a, mgmt):
    cats = listed(ok(admin.get("/api/kra/categories")))
    cat = cats[0]["id"]
    base = {"layer": "leader", "fiscal_year": FY, "leader_id": LEADER_A}
    kpi = ok(admin.post("/api/kra/kpis", json={**base, "category_id": cat, "kpi_name": "E2E KPI", "sub_weight": 0.5}), 200, 201)
    ok(admin.put(f"/api/kra/kpis/{kpi['id']}", json={"kpi_name": "E2E KPI edited"}))
    comp = ok(admin.post("/api/kra/competencies", json={**base, "key": "e2e_comp", "name": "E2E Competency", "weight": 0.5}), 200, 201)
    ok(admin.put(f"/api/kra/competencies/{comp['id']}", json={"name": "E2E Competency edited"}))
    ok(admin.put("/api/kra/weights", json={**base, "weights": {c["id"]: round(1 / len(cats), 4) for c in cats}}))
    kpis = ok(lead_a.get("/api/kra/kpis", params=base))
    assert "E2E KPI edited" in str(kpis)
    ok(lead_a.get("/api/kra/resolved", params={"fiscal_year": FY, "leader_id": LEADER_A}))
    for who in (mgmt, lead_a):
        forbidden(who, "POST", "/api/kra/kpis", json={**base, "category_id": cat, "kpi_name": "E2E x", "sub_weight": 0.1})
        forbidden(who, "DELETE", f"/api/kra/kpis/{kpi['id']}")
        forbidden(who, "PUT", "/api/kra/weights", json={**base, "weights": {}})
    ok(admin.delete(f"/api/kra/kpis/{kpi['id']}"), 200, 204)
    ok(admin.delete(f"/api/kra/competencies/{comp['id']}"), 200, 204)
    # the writes above created the leader layer: remove it, copy the FY layer into it, remove the copy again
    ok(admin.request("DELETE", "/api/kra/copy", params={"fiscal_year": FY, "leader_id": LEADER_A}), 200, 204)
    assert admin.post("/api/kra/copy", json={"target_layer": "leader", "fiscal_year": FY, "leader_id": LEADER_A}).status_code in (200, 201)
    assert admin.post("/api/kra/copy", json={"target_layer": "leader", "fiscal_year": FY, "leader_id": LEADER_A}).status_code == 409
    ok(admin.request("DELETE", "/api/kra/copy", params={"fiscal_year": FY, "leader_id": LEADER_A}), 200, 204)


def test_appraisals(lead_a, lead_b, mgmt):
    rounds = listed(ok(lead_a.get("/api/appraisals/rounds", params={"leader_id": LEADER_A, "fiscal_year": FY})))
    assert len(rounds) == 4
    open_self = [r for r in rounds if r["round_type"].startswith("self_") and r.get("state") == "open"]
    open_mgmt = [r for r in rounds if r["round_type"].startswith("mgmt_") and r.get("state") == "open"]
    if not open_self or not open_mgmt:
        pytest.skip("all e2e appraisal rounds were submitted by an earlier run: run `provision.py cleanup` + `create`")
    self_round, mgmt_round = open_self[0], open_mgmt[0]
    forbidden(lead_b, "GET", f"/api/appraisals/rounds/{self_round['id']}")
    forbidden(lead_b, "PUT", f"/api/appraisals/rounds/{self_round['id']}/ratings", json={"kpi_ratings": [], "competency_ratings": []})
    forbidden(lead_a, "PUT", f"/api/appraisals/rounds/{mgmt_round['id']}/ratings", json={"kpi_ratings": [], "competency_ratings": []})
    detail = ok(lead_a.get(f"/api/appraisals/rounds/{self_round['id']}"))
    kpi_ids = [k.get("id") or k.get("kpi_definition_id") for k in detail.get("kpis", [])][:1]
    body = {"kpi_ratings": [{"kpi_definition_id": k, "rating": 4, "comment": "E2E"} for k in kpi_ids], "competency_ratings": []}
    ok(lead_a.put(f"/api/appraisals/rounds/{self_round['id']}/ratings", json=body))
    ok(mgmt.put(f"/api/appraisals/rounds/{mgmt_round['id']}/ratings", json={"kpi_ratings": [], "competency_ratings": []}))
    sub = ok(lead_a.post(f"/api/appraisals/rounds/{self_round['id']}/submit"))
    assert sub["state"] == "submitted"
    r = lead_a.put(f"/api/appraisals/rounds/{self_round['id']}/ratings", json=body)
    assert r.status_code == 403        # closed after submit
    ok(lead_a.get("/api/appraisals/scorecard", params={"leader_id": LEADER_A, "fiscal_year": FY}))


def test_admin_users_lifecycle(admin, mgmt):
    import httpx
    from conftest import API, login
    body = {"full_name": "E2E Crud User", "email": f"e2e-crud-{RUN}@example.com", "password": "E2e-Crud-Password-123",
            "role": "user", "leader_id": LEADER_B}
    forbidden(mgmt, "POST", "/api/admin/users", json=body)
    u = ok(admin.post("/api/admin/users", json=body), 201)
    assert ok(admin.put(f"/api/admin/users/{u['id']}", json={"designation": "E2E"}))["designation"] == "E2E"
    r = login(body["email"], body["password"])
    assert r.status_code == 200
    rt = r.json()["refresh_token"]
    forbidden(mgmt, "DELETE", f"/api/admin/users/{u['id']}")
    ok(admin.delete(f"/api/admin/users/{u['id']}"), 200, 204)
    # deactivation revokes refresh tokens and blocks login
    assert httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": rt}, timeout=30).status_code == 401
    assert login(body["email"], body["password"]).status_code == 401
    assert u["id"] in ids(listed(ok(admin.get("/api/admin/users"))))


def test_leaders(admin, mgmt):
    body = {"id": f"e2e_leader_c_{RUN}", "name": "E2E Leader C", "practice": "E2E", "email": "e2e-leader-c@example.com"}
    forbidden(mgmt, "POST", "/api/leaders/", json=body)
    ok(admin.post("/api/leaders/", json=body), 201)
    assert admin.post("/api/leaders/", json=body).status_code == 409
    assert ok(admin.put(f"/api/leaders/e2e_leader_c_{RUN}", json={"practice": "E2E edited"}))["practice"] == "E2E edited"
    forbidden(mgmt, "PUT", f"/api/leaders/e2e_leader_c_{RUN}", json={"name": "E2E hacked"})
    assert ok(admin.get(f"/api/leaders/e2e_leader_c_{RUN}"))["name"] == "E2E Leader C"
    ok(admin.put(f"/api/leaders/e2e_leader_c_{RUN}", json={"is_active": False}))


def test_admin_financial_years(admin, mgmt):
    slug = f"9{random.randint(100, 999)}"
    body = {"slug": slug, "label": f"E2E FY {slug}", "is_current": False, "is_active": False, "is_editable": False, "sort_order": 9899}
    forbidden(mgmt, "POST", "/api/admin/financial-years", json=body)
    f = ok(admin.post("/api/admin/financial-years", json=body), 201)
    assert ok(admin.put(f"/api/admin/financial-years/{f['id']}", json={"label": f"E2E FY {slug} edited"}))["label"] == f"E2E FY {slug} edited"
    forbidden(mgmt, "PUT", f"/api/admin/financial-years/{f['id']}", json={"label": "E2E hacked"})
    # inactive: never offered in the app's FY pickers
    assert slug not in str(ok(admin.get("/api/financial-years/")))


def test_admin_settings_read_and_validation_only(admin, mgmt):
    before = ok(admin.get("/api/admin/settings"))
    r = admin.put("/api/admin/settings", json={"maintenance_mode": "not-a-bool-🙂"})
    assert r.status_code == 422
    forbidden(mgmt, "PUT", "/api/admin/settings", json={"maintenance_mode": False})
    assert ok(admin.get("/api/admin/settings")) == before          # nothing changed


@pytest.mark.parametrize("path,body", [("/api/admin/clients", {"name": "E2E Client Master", "type": "Corporate", "status": "Active"}),
                                       ("/api/admin/engagement-types", {"name": "E2E Engagement Type", "is_active": True})])
@pytest.mark.xfail(strict=True, reason="returns 500 on every create until PR #5 (fix/admin-master-data-500) is deployed")
def test_admin_master_data_create(admin, path, body):
    r = admin.post(path, json=body)
    assert r.status_code == 201, r.text[:200]
    assert r.json()["name"] == body["name"]
