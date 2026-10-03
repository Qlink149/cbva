"""Rate limits on the deployed API (run last: they exhaust this client's buckets; ~3.5 minutes).

/api/auth/login   5/minute per client IP (slowapi, IP = X-Real-IP set by Caddy from the TCP peer)
                  10 attempts / 15 minutes per email (in-process window, counts every attempt)
/api/auth/refresh 30/minute per client IP
Unknown e2e-* emails are used, so no real or temporary account is ever locked out.
"""
import time
import uuid

import httpx
import pytest

from conftest import API, PACER

pytestmark = pytest.mark.ratelimit


def _bad_login(email, **headers):
    return httpx.post(f"{API}/api/auth/login", json={"email": email, "password": "wrong-password"},
                      headers=headers, timeout=30).status_code


def test_login_per_ip_limit_and_spoofed_headers_do_not_help():
    PACER.drain()
    codes = [_bad_login(f"e2e-rl-ip-{i}-{uuid.uuid4().hex[:6]}@example.com",
                        **{"X-Real-IP": f"9.9.9.{i}", "X-Forwarded-For": f"8.8.8.{i}", "CF-Connecting-IP": f"7.7.7.{i}"})
             for i in range(7)]
    PACER._save([time.time()] * 5)                     # the bucket is full now; later logins must wait
    assert codes[:5] == [401] * 5, codes
    assert codes[5:] == [429, 429], f"spoofed forwarding headers escaped the per-IP bucket: {codes}"


def test_login_per_email_limit():
    email = f"e2e-rl-email-{uuid.uuid4().hex[:6]}@example.com"
    seen = []
    for _ in range(2):                                 # 2 x 5 attempts, each batch in a fresh per-IP minute
        PACER.drain()
        seen += [_bad_login(email) for _ in range(5)]
        PACER._save([time.time()] * 5)
    PACER.drain()
    eleventh = _bad_login(email)
    other = _bad_login(f"e2e-rl-other-{uuid.uuid4().hex[:6]}@example.com")
    PACER._save([time.time()] * 2)
    assert seen == [401] * 10, seen
    assert eleventh == 429, "11th attempt for the same email within 15 minutes must be refused"
    assert other == 401, "a different email from the same IP is not affected by the per-email window"


def test_refresh_per_ip_limit():
    codes = [httpx.post(f"{API}/api/auth/refresh", json={"refresh_token": "garbage"}, timeout=30).status_code
             for _ in range(32)]
    assert set(codes[:30]) == {401}, codes
    assert 429 in codes[30:], codes
