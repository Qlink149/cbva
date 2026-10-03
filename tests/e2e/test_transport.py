"""Edge behaviour of the deployed API: no redirects, strict CORS, security headers, no API docs."""
import httpx
import pytest

from conftest import API, FY, LEADER_A, ORIGIN, REDIRECTS, ROUTES, concrete

GETS = [r for r in ROUTES if r["method"] == "GET"]


def _toggle(p):
    return p[:-1] if p.endswith("/") else p + "/"


@pytest.mark.parametrize("r", GETS, ids=lambda r: r["path"])
def test_no_redirect_either_spelling(admin, r):
    path = concrete(r["path"], leader_id=LEADER_A)
    for p in (path, _toggle(path)):
        res = admin.get(p, params={"leader_id": LEADER_A, "fiscal_year": FY})
        assert res.status_code not in REDIRECTS and "location" not in res.headers, (p, res.status_code, res.headers.get("location"))


def test_plain_http_is_redirected_to_https_by_the_edge_only():
    """Port 80 -> https is Caddy's job (308); the API itself never redirects."""
    res = httpx.get(API.replace("https://", "http://") + "/health", follow_redirects=False, timeout=30)
    assert res.status_code in (301, 308) and res.headers["location"].startswith("https://")


def test_cors_allows_only_the_frontend_origin():
    pre = {"Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,content-type"}
    ok = httpx.options(f"{API}/api/leaders/", headers={"Origin": ORIGIN, **pre}, timeout=30)
    assert ok.status_code == 200 and ok.headers.get("access-control-allow-origin") == ORIGIN
    assert ok.headers.get("access-control-allow-credentials") in (None, "false")
    allowed = {m.strip() for m in ok.headers.get("access-control-allow-methods", "").split(",")}
    assert {"GET", "POST", "PUT", "PATCH", "DELETE"} <= allowed
    for evil in ("https://evil.example.com", "https://cbva.claraai.tech.evil.com", "http://cbva.claraai.tech",
                 "https://staging.cbva.claraai.tech", "null", "https://x.vercel.app", "http://localhost:5173"):
        r = httpx.options(f"{API}/api/leaders/", headers={"Origin": evil, **pre}, timeout=30)
        assert r.headers.get("access-control-allow-origin") not in (evil, "*"), evil
        g = httpx.get(f"{API}/health", headers={"Origin": evil}, timeout=30)
        assert g.headers.get("access-control-allow-origin") not in (evil, "*"), evil


def test_security_headers():
    h = httpx.get(f"{API}/health", timeout=30).headers
    assert "max-age=" in h.get("strict-transport-security", "")
    assert h.get("x-content-type-options") == "nosniff"
    assert h.get("x-frame-options", "").upper() == "DENY"
    assert "server" not in h or "uvicorn" not in h["server"].lower()


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"])
def test_api_docs_disabled(path):
    assert httpx.get(f"{API}{path}", timeout=30, follow_redirects=False).status_code == 404


def test_health_endpoints():
    assert httpx.get(f"{API}/health", timeout=30).status_code == 200
    ready = httpx.get(f"{API}/health/ready", timeout=30)
    assert ready.status_code == 200 and ready.json()["db"] == "up"


def test_unknown_path_404_no_stack_trace():
    r = httpx.get(f"{API}/api/does-not-exist", timeout=30)
    assert r.status_code == 404 and "Traceback" not in r.text
