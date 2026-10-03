"""Auth flows on the deployed API: login, /me, refresh + rotation, logout revocation, real expiry."""
import time

import httpx
import pytest

from conftest import API, STATE, Api, login


def test_login_ok_returns_tokens_and_user(sessions):
    s = sessions["leader_a"]
    assert s["token_type"] == "bearer" and s["access_token"] and s["refresh_token"]
    assert s["user"]["email"] == STATE["users"]["leader_a"]["email"] and "password_hash" not in s["user"]


@pytest.mark.parametrize("email,password", [
    ("e2e-leader-a@example.com", "wrong-password"),
    ("e2e-nobody@example.com", "whatever-123"),
])
def test_login_bad_credentials_401_same_message(email, password):
    r = login(email, password)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"   # no user enumeration


@pytest.mark.parametrize("body", [{}, {"email": "not-an-email", "password": "x"}, {"email": "e2e-x@example.com"}])
def test_login_malformed_422(body):
    r = httpx.post(f"{API}/api/auth/login", json=body, timeout=30)   # rejected before the limiter counts it
    assert r.status_code == 422


def test_me_matches_role(sessions, admin, lead_a, mgmt):
    assert admin.get("/api/auth/me").json()["role"] == "admin"
    assert mgmt.get("/api/auth/me").json()["role"] == "management"
    me = lead_a.get("/api/auth/me").json()
    assert me["role"] == "user" and me["leader_id"] == "e2e_leader_a"


@pytest.mark.parametrize("token", ["garbage", "a.b.c",
                                   "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIiwidHlwZSI6ImFjY2VzcyJ9."])  # alg=none
def test_invalid_access_tokens_401(anon, token):
    assert anon.get("/api/auth/me", token=token).status_code == 401


def test_refresh_token_is_not_an_access_token(sessions, anon):
    assert anon.get("/api/auth/me", token=sessions["leader_b"]["refresh_token"]).status_code == 401


def test_refresh_rotates_and_old_token_is_revoked():
    u = STATE["users"]["leader_b"]
    r = login(u["email"], u["password"])
    assert r.status_code == 200
    rt1 = r.json()["refresh_token"]
    r2 = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": rt1}, timeout=30)
    assert r2.status_code == 200, r2.text
    rt2, at2 = r2.json()["refresh_token"], r2.json()["access_token"]
    assert rt2 != rt1
    assert Api(at2).get("/api/auth/me").status_code == 200
    # the used refresh token cannot be replayed
    r3 = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": rt1}, timeout=30)
    assert r3.status_code == 401 and "revoked" in r3.json()["detail"].lower()
    # the rotated one still works
    assert httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": rt2}, timeout=30).status_code == 200


@pytest.mark.parametrize("body", [{"refresh_token": "garbage"}, {}])
def test_refresh_bad_input_4xx(body):
    r = httpx.post(f"{API}/api/auth/refresh", json=body, timeout=30)
    assert r.status_code in (401, 422)


def test_logout_revokes_refresh_tokens():
    """Uses its own fresh login of leader_b (logout clears ALL of that user's refresh tokens)."""
    u = STATE["users"]["leader_b"]
    r = login(u["email"], u["password"])
    assert r.status_code == 200
    at, rt = r.json()["access_token"], r.json()["refresh_token"]
    assert Api(at).post("/api/auth/logout").status_code == 204
    r2 = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": rt}, timeout=30)
    assert r2.status_code == 401
    # documented limitation: the access token itself is stateless and stays valid until it expires (15 min)
    assert Api(at).get("/api/auth/me").status_code == 200


def test_logout_requires_auth(anon):
    assert anon.post("/api/auth/logout").status_code == 401


@pytest.mark.slow
def test_expired_access_token_401_then_refresh_works(sessions):
    """Real expiry: a session saved >15 min ago has a validly signed access token that must now be dead,
    and a refresh token must still mint a working one. (The aged refresh token itself may already be evicted:
    the API keeps only the newest 5 refresh tokens per user, so the current session's token is used.)"""
    aged = STATE.get("aged_session")
    if not aged:
        pytest.skip("no aged session saved")
    age = time.time() - aged["issued_at"]
    if age < 15 * 60 + 30:
        pytest.skip(f"aged session only {int(age)}s old; needs > 930s")
    expired = Api(aged["access_token"]).get("/api/auth/me")
    assert expired.status_code == 401 and expired.json()["detail"] == "Invalid or expired token"
    r = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": aged["refresh_token"]}, timeout=30)
    if r.status_code == 401:     # aged refresh token evicted (newest 5 kept): use the run's own session token
        r = httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": sessions["management"]["refresh_token"]}, timeout=30)
    assert r.status_code == 200, r.text
    sessions["management"].update(r.json())       # keep the shared session's refresh token current
    assert Api(r.json()["access_token"]).get("/api/auth/me").json()["role"] == "management"
