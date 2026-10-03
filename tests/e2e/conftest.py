"""End-to-end suite against a DEPLOYED API (default https://cbva-api.claraai.tech).

Env:
  E2E_API_URL        base URL of the API (required to be https unless E2E_ALLOW_HTTP=1)
  E2E_FRONTEND_ORIGIN  the only origin CORS may allow (default https://cbva.claraai.tech)
  E2E_STATE          credentials file written by provision.py (default tests/e2e/.state.json, gitignored)
  E2E_FY             fiscal year slug used for writes (default 2627)

Only temporary accounts/leaders created by provision.py are used; every record a test creates is labelled
"E2E..." and is owned by the temporary leaders e2e_leader_a / e2e_leader_b. Never point this at production data.
"""
import json
import os
import sys
import time
from pathlib import Path

import httpx
import pytest

HERE = Path(__file__).parent
API = os.environ.get("E2E_API_URL", "https://cbva-api.claraai.tech").rstrip("/")
ORIGIN = os.environ.get("E2E_FRONTEND_ORIGIN", "https://cbva.claraai.tech")
FY = os.environ.get("E2E_FY", "2627")
LEADER_A, LEADER_B = "e2e_leader_a", "e2e_leader_b"
DUMMY_ID = "64b0c0ffee0000000000c0de"
REDIRECTS = {301, 302, 303, 307, 308}

if not API.startswith("https://") and os.environ.get("E2E_ALLOW_HTTP") != "1":
    raise pytest.UsageError(f"E2E_API_URL must be https ({API})")


def pytest_configure(config):
    config.addinivalue_line("markers", "ratelimit: exhausts rate-limit buckets; runs last and takes minutes")
    config.addinivalue_line("markers", "slow: waits for real time to pass")


def pytest_collection_modifyitems(items):
    items.sort(key=lambda i: 1 if i.get_closest_marker("ratelimit") else 0)   # rate-limit tests last


def load_state():
    p = Path(os.environ.get("E2E_STATE", HERE / ".state.json"))
    if not p.exists():
        raise pytest.UsageError(f"{p} missing: run `python tests/e2e/provision.py create` first")
    return json.loads(p.read_text())


STATE = load_state()


class Pacer:
    """Keeps logins under the deployed 5/minute per-IP limit so the suite never trips it by accident.
    Timestamps persist in artifacts/ so back-to-back runs (and the UI suite) share the budget."""
    FILE = HERE / "artifacts" / "login_stamps.json"

    def __init__(self, per_minute=4):
        self.per_minute = per_minute

    def _load(self):
        try:
            return [t for t in json.loads(self.FILE.read_text()) if time.time() - t < 62]
        except (OSError, ValueError):
            return []

    def _save(self, stamps):
        self.FILE.parent.mkdir(exist_ok=True)
        self.FILE.write_text(json.dumps(stamps))

    def wait(self):
        stamps = self._load()
        if len(stamps) >= self.per_minute:
            time.sleep(62 - (time.time() - stamps[-self.per_minute]))
        self._save(self._load() + [time.time()])

    def drain(self):
        """Wait until the per-IP login bucket is guaranteed empty."""
        stamps = self._load()
        if stamps:
            time.sleep(max(0, 62 - (time.time() - stamps[-1])))
        self._save([])


PACER = Pacer()


class Api:
    """Thin httpx wrapper: never follows redirects and records every 3xx/5xx seen during the run."""
    seen_redirects: list = []
    seen_5xx: list = []

    def __init__(self, token=None, role=None):
        self.c = httpx.Client(base_url=API, timeout=60, follow_redirects=False)
        self.token, self.role = token, role

    def renew(self):
        """Access tokens live 15 min; a long run re-authenticates (refresh, else a paced login)."""
        sess = SESSIONS[self.role]
        r = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": sess["refresh_token"]}, timeout=60)
        if r.status_code != 200:
            u = STATE["users"][self.role]
            r = login(u["email"], u["password"])
        r.raise_for_status()
        sess.update(r.json())
        self.token = sess["access_token"]

    def request(self, method, path, token=..., **kw):
        tok = self.token if token is ... else token
        headers = {**({"Authorization": f"Bearer {tok}"} if tok else {}), **kw.pop("headers", {})}
        r = self.c.request(method, path, headers=headers, **kw)
        if (r.status_code == 401 and token is ... and self.role
                and r.json().get("detail") == "Invalid or expired token"):
            self.renew()
            headers["Authorization"] = f"Bearer {self.token}"
            r = self.c.request(method, path, headers=headers, **kw)
        if r.status_code in REDIRECTS or "location" in r.headers:
            Api.seen_redirects.append(f"{method} {path} -> {r.status_code} {r.headers.get('location')}")
        if r.status_code >= 500:
            Api.seen_5xx.append(f"{method} {path} -> {r.status_code} {r.text[:120]}")
        return r

    def get(self, p, **kw): return self.request("GET", p, **kw)
    def post(self, p, **kw): return self.request("POST", p, **kw)
    def put(self, p, **kw): return self.request("PUT", p, **kw)
    def patch(self, p, **kw): return self.request("PATCH", p, **kw)
    def delete(self, p, **kw): return self.request("DELETE", p, **kw)


def login(email, password):
    PACER.wait()
    return httpx.post(f"{API}/api/auth/login", json={"email": email, "password": password}, timeout=60)


SESSIONS: dict = {}


@pytest.fixture(scope="session")
def sessions():
    """One real login per role for the whole run (logins are rate limited)."""
    out = SESSIONS
    for key in ("admin", "management", "leader_a", "leader_b"):
        u = STATE["users"][key]
        r = login(u["email"], u["password"])
        assert r.status_code == 200, (key, r.status_code, r.text[:200])
        out[key] = {**r.json(), "id": u["id"]}
    return out


@pytest.fixture(scope="session")
def admin(sessions): return Api(sessions["admin"]["access_token"], "admin")
@pytest.fixture(scope="session")
def mgmt(sessions): return Api(sessions["management"]["access_token"], "management")
@pytest.fixture(scope="session")
def lead_a(sessions): return Api(sessions["leader_a"]["access_token"], "leader_a")
@pytest.fixture(scope="session")
def lead_b(sessions): return Api(sessions["leader_b"]["access_token"], "leader_b")
@pytest.fixture(scope="session")
def anon(): return Api(None)


def _routes():
    """Every route of the app under test, from the code itself (no database contact)."""
    os.environ.setdefault("SECRET_KEY", "e2e-inventory-only-" + "x" * 32)
    sys.path.insert(0, str(HERE))
    from inventory import backend_routes
    return backend_routes()


ROUTES = _routes()


def concrete(path, **values):
    out = path
    for k, v in values.items():
        out = out.replace("{" + k + "}", v)
    import re
    return re.sub(r"\{[^}]+\}", DUMMY_ID, out)


@pytest.fixture(scope="session", autouse=True)
def no_redirects_or_5xx_overall():
    yield
    # surfaced at the end of the run as a summary (individual tests assert their own statuses)
    if Api.seen_redirects:
        print("\nREDIRECTS SEEN:", *Api.seen_redirects, sep="\n  ")
    if Api.seen_5xx:
        print("\n5xx SEEN:", *Api.seen_5xx, sep="\n  ")
