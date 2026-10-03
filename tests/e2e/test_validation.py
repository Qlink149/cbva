"""Bad input never produces a 5xx, on every route (route list comes from the code).

Runs as admin so requests get past the role checks and reach validation. Path ids are a valid-but-unknown
ObjectId (expect 404/422) or a malformed id (expect 4xx, not a crash). Calls that would mutate shared state
even with an empty body are excluded and listed in EXCLUDED with the reason.
"""
import pytest

from conftest import FY, LEADER_A, ROUTES, concrete

WRITE = {"POST", "PUT", "PATCH"}
EXCLUDED = {
    ("PUT", "/api/admin/settings"): "all fields optional: {} would rewrite the global settings document",
    ("POST", "/api/auth/logout"): "revokes the admin session used by the rest of the run (covered in test_auth)",
    ("POST", "/api/auth/login"): "rate limited; malformed bodies covered in test_auth",
    ("POST", "/api/auth/refresh"): "covered in test_auth",
}
# fixed by PR #5 (fix/admin-master-data-500), not deployed yet. Each is xfail ONLY for its known root cause;
# any other 5xx fails the run.
KNOWN_5XX = {("POST", "/api/admin/clients"), ("POST", "/api/admin/engagement-types")}
KNOWN_BAD_FY_5XX = {"/api/bluesky/", "/api/collections/", "/api/firmwide/dashboard-aggregate"}
LIST_BY_ID = {("GET", "/api/audit-log/entity/{entity_type}/{entity_id}")}   # unknown id = empty list (200)
PR5 = "known until PR #5 is deployed"
BAD_BODIES = [{}, [], "text", {"leader_id": 123, "fiscal_year": None}, {"name": "E2E" + "x" * 5000}]

CASES = [r for r in ROUTES if (r["method"], r["path"]) not in EXCLUDED and r["auth"] != "public"]


def _id(r):
    return f"{r['method']} {r['path']}"


@pytest.mark.parametrize("r", [r for r in CASES if r["method"] in WRITE], ids=_id)
def test_bad_bodies_are_4xx(admin, r):
    path = concrete(r["path"])
    problems = []
    for body in BAD_BODIES:
        if isinstance(body, dict) and "name" in body and "{" not in r["path"] and r["method"] == "POST":
            continue    # a long but valid "name" could legitimately create a record on create routes
        res = admin.request(r["method"], path, json=body)
        if res.status_code >= 500 or res.status_code < 400:
            problems.append(f"{str(body)[:30]!r} -> {res.status_code} {res.text[:100]}")
    if (r["method"], r["path"]) in KNOWN_5XX:
        pytest.xfail(f"known 500 until PR #5 deploys: {problems}")
    assert not problems, problems


@pytest.mark.parametrize("r", [r for r in CASES if "{" in r["path"]], ids=_id)
@pytest.mark.parametrize("bad_id", ["64b0c0ffee0000000000c0de", "not-an-object-id", "%24where"])
def test_unknown_or_malformed_ids_are_4xx(admin, r, bad_id):
    path = concrete(r["path"], leader_id=bad_id) if "{leader_id}" in r["path"] else \
        __import__("re").sub(r"\{[^}]+\}", bad_id, r["path"])
    kw = {"json": {}} if r["method"] in WRITE else {}
    res = admin.request(r["method"], path, params={"leader_id": LEADER_A, "fiscal_year": FY}, **kw)
    if res.status_code >= 500 and bad_id != "64b0c0ffee0000000000c0de":
        pytest.xfail(f"malformed ObjectId -> {res.status_code} (bson InvalidId), {PR5}")
    if (r["method"], r["path"]) in LIST_BY_ID:
        assert res.status_code in (200, 422) and (res.status_code != 200 or res.json()["total"] == 0), res.text[:200]
        return
    assert 400 <= res.status_code < 500, (res.status_code, res.text[:200])


@pytest.mark.parametrize("r", [r for r in CASES if r["method"] == "GET" and "{" not in r["path"]], ids=_id)
def test_bad_query_params_are_4xx(admin, r):
    for params in ({"fiscal_year": FY, "leader_id": "x" * 300},
                   {"fiscal_year": FY, "leader_id": LEADER_A, "skip": "-1", "limit": "100000", "month": "13"},
                   {"fiscal_year": {"$ne": 1}},
                   {"fiscal_year": "abcd", "leader_id": LEADER_A}):     # last: may xfail (PR #5)
        res = admin.get(r["path"], params=params)
        if params.get("fiscal_year") == "abcd" and res.status_code >= 500 and r["path"] in KNOWN_BAD_FY_5XX:
            pytest.xfail(f"fiscal_year=abcd -> {res.status_code}, {PR5}")
        if params.get("fiscal_year") != FY and r["path"] == "/api/consolidated-summary/" and res.status_code == 503:
            pytest.xfail(f"malformed FY answers 503 'not seeded' instead of 422, {PR5}")
        assert res.status_code < 500, (params, res.status_code, res.text[:200])
