"""Authorization matrix over EVERY route of the app (route list comes from the code, so new routes are covered).

- unauthenticated: 401 everywhere except the public routes
- roles:admin routes: management and leader -> 403
- roles:admin,management routes: leader -> 403, management passes the role check
- leader-scoped list routes: leader B asking for leader A's data -> 403 (object-level checks live in test_crud.py)
Bodies are {} and ids are dummies: the role check runs before validation, so a 403/401 is the only acceptable
answer and nothing is ever written.
"""
import pytest

from conftest import FY, LEADER_A, ROUTES, concrete

PUBLIC = {("POST", "/api/auth/login"), ("POST", "/api/auth/refresh"), ("GET", "/health"), ("GET", "/health/ready")}
ADMIN_ONLY = [r for r in ROUTES if r["auth"] == "roles:admin"]
ADMIN_MGMT = [r for r in ROUTES if r["auth"] == "roles:admin,management"]
PROTECTED = [r for r in ROUTES if (r["method"], r["path"]) not in PUBLIC]
WRITE = {"POST", "PUT", "PATCH"}


def _call(api, r, params=None):
    kw = {"json": {}} if r["method"] in WRITE else {}
    return api.request(r["method"], concrete(r["path"], leader_id=LEADER_A), params=params, **kw)


def _id(r):
    return f"{r['method']} {r['path']}"


def test_inventory_sane():
    assert len(ROUTES) >= 117
    assert {(r["method"], r["path"]) for r in ROUTES if r["auth"] == "public"} == PUBLIC


@pytest.mark.parametrize("r", PROTECTED, ids=_id)
def test_unauthenticated_401(anon, r):
    res = _call(anon, r, params={"leader_id": LEADER_A, "fiscal_year": FY})
    assert res.status_code == 401, res.text[:200]


@pytest.mark.parametrize("r", sorted(PUBLIC), ids=lambda p: f"{p[0]} {p[1]}")
def test_public_routes_reachable_unauthenticated(anon, r):
    method, path = r
    if method == "GET":
        assert anon.get(path).status_code == 200
    else:   # login/refresh: a malformed body is a validation error, not an auth error
        assert anon.post(path, json={}).status_code == 422


@pytest.mark.parametrize("r", ADMIN_ONLY, ids=_id)
@pytest.mark.parametrize("who", ["mgmt", "lead_a"])
def test_admin_only_forbidden_for_non_admin(request, r, who):
    api = request.getfixturevalue(who)
    res = _call(api, r, params={"leader_id": LEADER_A, "fiscal_year": FY})
    assert res.status_code == 403, res.text[:200]


@pytest.mark.parametrize("r", ADMIN_MGMT, ids=_id)
def test_admin_mgmt_routes_forbidden_for_leader(lead_a, r):
    res = _call(lead_a, r, params={"leader_id": LEADER_A, "fiscal_year": FY})
    assert res.status_code == 403, res.text[:200]


@pytest.mark.parametrize("r", [r for r in ADMIN_MGMT if r["method"] == "GET"], ids=_id)
def test_admin_mgmt_reads_allowed_for_management(mgmt, r):
    res = _call(mgmt, r, params={"leader_id": LEADER_A, "fiscal_year": FY})
    assert res.status_code not in (401, 403), res.text[:200]
    assert res.status_code < 500, res.text[:200]


LEADER_LISTS = [r for r in ROUTES if r["method"] == "GET" and r["leader_scope"] and "{" not in r["path"]]


@pytest.mark.parametrize("r", LEADER_LISTS, ids=_id)
def test_leader_b_cannot_read_leader_a_lists(lead_a, lead_b, r):
    params = {"leader_id": LEADER_A, "fiscal_year": FY}
    own = _call(lead_a, r, params=params)
    other = _call(lead_b, r, params=params)
    assert own.status_code == 200, (own.status_code, own.text[:200])
    assert other.status_code == 403, (other.status_code, other.text[:200])


def test_leader_cannot_list_all_leaders_but_can_read_one(lead_b):
    """Observed (old and new backend alike): the list is admin/management-only, but GET /api/leaders/{id}
    only needs a login, so a leader can read another leader's directory entry (name, practice, email)."""
    assert lead_b.get("/api/leaders/").status_code == 403
    assert lead_b.get(f"/api/leaders/{LEADER_A}").status_code == 200
