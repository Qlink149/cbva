"""JWT behaviour after the python-jose -> PyJWT swap."""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from bson import ObjectId

from app.core import database
from app.core.config import settings
from app.core.limiter import login_email_limiter
from app.core.security import (
    JWTError,
    create_access_token,
    create_refresh_token,
    decode_token,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
OLD_DEFAULT_KEY = "dev-secret-change-in-production"  # python-jose era default


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _hs256_by_hand(payload: dict, key: str) -> str:
    """Build a token exactly the way python-jose did (compact JSON, typ=JWT) without using PyJWT."""
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(key.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64(sig)}"


def _exp(minutes=10) -> int:
    return int((datetime.now(timezone.utc) + timedelta(minutes=minutes)).timestamp())


# ---------------- pure decode_token behaviour ----------------

def test_alg_none_rejected():
    header = _b64(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    body = _b64(json.dumps({"sub": "1", "type": "access", "exp": _exp()}).encode())
    with pytest.raises(JWTError):
        decode_token(f"{header}.{body}.")


def test_hs512_and_other_algs_rejected():
    tok = jwt.encode({"sub": "1", "type": "access", "exp": _exp()}, settings.SECRET_KEY, algorithm="HS512")
    with pytest.raises(JWTError):
        decode_token(tok)


def test_wrong_key_rejected():
    tok = jwt.encode({"sub": "1", "type": "access", "exp": _exp()}, "x" * 40, algorithm="HS256")
    with pytest.raises(JWTError):
        decode_token(tok)


def test_expired_rejected():
    tok = jwt.encode({"sub": "1", "type": "access", "exp": _exp(-1)}, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(JWTError):
        decode_token(tok)


def test_sub_is_string_in_encode_and_decode():
    uid = str(ObjectId())
    for tok in (create_access_token(uid, "admin", None), create_refresh_token(uid)):
        payload = decode_token(tok)
        assert isinstance(payload["sub"], str) and payload["sub"] == uid


def test_non_string_sub_rejected_cleanly():
    tok = jwt.encode({"sub": 12345, "type": "access", "exp": _exp()}, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(JWTError):
        decode_token(tok)


def test_jose_format_token_with_old_key_rejected():
    tok = _hs256_by_hand({"sub": str(ObjectId()), "role": "admin", "type": "access", "exp": _exp()}, OLD_DEFAULT_KEY)
    with pytest.raises(JWTError):
        decode_token(tok)


def test_jose_format_token_with_current_key_is_wire_compatible():
    """Documents the swap: same key + HS256 => tokens issued by python-jose keep working (no forced logout)."""
    uid = str(ObjectId())
    tok = _hs256_by_hand({"sub": uid, "type": "access", "exp": _exp()}, settings.SECRET_KEY)
    assert decode_token(tok)["sub"] == uid


# ---------------- HTTP level ----------------

@pytest.mark.asyncio
async def test_http_bad_tokens_get_401_not_500(client, seed_users):
    uid = str(seed_users["user"]["_id"])
    header = _b64(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    none_tok = f"{header}.{_b64(json.dumps({'sub': uid, 'type': 'access', 'exp': _exp()}).encode())}."
    cases = {
        "alg_none": none_tok,
        "wrong_key": jwt.encode({"sub": uid, "type": "access", "exp": _exp()}, "y" * 40, algorithm="HS256"),
        "expired": jwt.encode({"sub": uid, "type": "access", "exp": _exp(-5)}, settings.SECRET_KEY, algorithm="HS256"),
        "old_jose_old_key": _hs256_by_hand({"sub": uid, "role": "user", "type": "access", "exp": _exp()}, OLD_DEFAULT_KEY),
        "refresh_as_access": create_refresh_token(uid),
        "garbage": "not.a.jwt",
        "int_sub": jwt.encode({"sub": 7, "type": "access", "exp": _exp()}, settings.SECRET_KEY, algorithm="HS256"),
        "non_objectid_sub": jwt.encode({"sub": "not-an-objectid", "type": "access", "exp": _exp()}, settings.SECRET_KEY, algorithm="HS256"),
    }
    for name, tok in cases.items():
        res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert res.status_code == 401, f"{name}: got {res.status_code} {res.text}"


@pytest.mark.asyncio
async def test_access_token_cannot_be_used_to_refresh(client, seed_users):
    uid = str(seed_users["user"]["_id"])
    res = await client.post("/api/auth/refresh", json={"refresh_token": create_access_token(uid, "user", "manan")})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotation_old_token_unusable(client, seed_users):
    login_email_limiter.reset()
    res = await client.post("/api/auth/login", json={"email": "leader@test.com", "password": "password123"},
                            headers={"X-Real-IP": "203.0.113.50"})
    assert res.status_code == 200
    old_refresh = res.json()["refresh_token"]

    res = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 200
    new_refresh = res.json()["refresh_token"]
    assert new_refresh != old_refresh

    res = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 401, "reusing a rotated refresh token must fail"

    res = await client.post("/api/auth/refresh", json={"refresh_token": new_refresh})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_logout_revokes_refresh(client, seed_users):
    login_email_limiter.reset()
    res = await client.post("/api/auth/login", json={"email": "leader@test.com", "password": "password123"},
                            headers={"X-Real-IP": "203.0.113.51"})
    data = res.json()
    res = await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert res.status_code == 204
    res = await client.post("/api/auth/refresh", json={"refresh_token": data["refresh_token"]})
    assert res.status_code == 401


# ---------------- SECRET_KEY: app refuses to start ----------------

def _import_app_with_env(secret: str | None) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if k not in {"SECRET_KEY"}}
    env.update({"DATABASE_NAME": "cbva_test", "ENV": "dev", "PYTHONPATH": str(BACKEND_DIR)})
    if secret is not None:
        env["SECRET_KEY"] = secret
    # cwd is an empty temp dir so backend/.env (read relative to cwd) cannot supply SECRET_KEY
    with tempfile.TemporaryDirectory() as empty:
        return subprocess.run(
            [sys.executable, "-c", "import app.main"],
            cwd=empty, env=env, capture_output=True, text=True, timeout=60,
        )


@pytest.mark.parametrize("secret", [None, "", "short-key", "dev-secret-change-in-production",
                                    "change-me-in-production", "change-me-to-a-long-random-string"])
def test_app_import_fails_for_bad_secret(secret):
    proc = _import_app_with_env(secret)
    assert proc.returncode != 0, proc.stdout + proc.stderr
    assert "SECRET_KEY" in proc.stderr


def test_app_import_succeeds_for_good_secret():
    proc = _import_app_with_env("k" * 48)
    assert proc.returncode == 0, proc.stderr
