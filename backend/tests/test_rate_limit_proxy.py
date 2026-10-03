"""Client-IP trust, per-email throttle and slowapi per-IP login limit."""
import pytest
from starlette.requests import Request

from app.core import limiter as lim
from app.core.limiter import _AttemptWindow, client_ip, login_email_limiter


def _req(peer: str, **headers: str) -> Request:
    """Request from TCP peer `peer`; keyword names use underscores for hyphens (x_real_ip -> x-real-ip)."""
    raw = [(k.replace("_", "-").encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 4242)})


@pytest.fixture
def cloudflare_mode(monkeypatch):
    monkeypatch.setattr(lim, "_CLIENT_IP_HEADER", "cf-connecting-ip")


# ---------------- which header is read (EDGE_MODE / CLIENT_IP_HEADER) ----------------

def test_default_is_direct_mode_x_real_ip():
    from app.core.config import Settings
    s = Settings(_env_file=None, SECRET_KEY="k" * 40)
    assert s.EDGE_MODE == "direct" and s.client_ip_header == "X-Real-IP"
    assert lim._CLIENT_IP_HEADER == "x-real-ip"


def test_cloudflare_mode_defaults_to_cf_header_and_override_wins():
    from app.core.config import Settings
    assert Settings(_env_file=None, SECRET_KEY="k" * 40, EDGE_MODE="cloudflare").client_ip_header == "CF-Connecting-IP"
    assert Settings(_env_file=None, SECRET_KEY="k" * 40, EDGE_MODE="cloudflare", CLIENT_IP_HEADER="X-Real-IP").client_ip_header == "X-Real-IP"
    assert Settings(_env_file=None, SECRET_KEY="k" * 40, CLIENT_IP_HEADER="").client_ip_header == "X-Real-IP"


@pytest.mark.parametrize("bad", ["X Real IP", "X-Real-IP:", "a/b", "x_y!"])
def test_invalid_header_name_rejected(bad):
    from pydantic import ValidationError
    from app.core.config import Settings
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="k" * 40, CLIENT_IP_HEADER=bad)


def test_invalid_edge_mode_rejected():
    from pydantic import ValidationError
    from app.core.config import Settings
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="k" * 40, EDGE_MODE="both")


# ---------------- key_func trust: direct mode (X-Real-IP) ----------------

@pytest.mark.parametrize("peer", ["172.18.0.3", "10.1.2.3", "192.168.1.9", "127.0.0.1"])
def test_x_real_ip_honoured_from_trusted_private_peer(peer):
    assert client_ip(_req(peer, x_real_ip="198.51.100.7")) == "198.51.100.7"


@pytest.mark.parametrize("peer", ["203.0.113.9", "8.8.8.8", "2001:db8::1"])
def test_x_real_ip_ignored_from_untrusted_peer(peer):
    assert client_ip(_req(peer, x_real_ip="198.51.100.7")) == peer


def test_other_headers_never_used_in_direct_mode():
    """A client cannot pick its bucket with CF-Connecting-IP or X-Forwarded-For, even via the trusted peer."""
    r = _req("172.18.0.3", cf_connecting_ip="1.1.1.1", x_forwarded_for="2.2.2.2")
    assert client_ip(r) == "172.18.0.3"


def test_spoofed_header_cannot_change_bucket_for_direct_client():
    keys = {client_ip(_req("203.0.113.9", x_real_ip=f"1.1.1.{i}", cf_connecting_ip=f"2.2.2.{i}")) for i in range(20)}
    assert keys == {"203.0.113.9"}


def test_two_real_ips_get_distinct_keys():
    assert client_ip(_req("172.18.0.4", x_real_ip="198.51.100.1")) != client_ip(_req("172.18.0.4", x_real_ip="198.51.100.2"))


def test_invalid_header_value_falls_back_to_peer():
    assert client_ip(_req("172.18.0.3", x_real_ip="not-an-ip")) == "172.18.0.3"
    assert client_ip(_req("172.18.0.3", x_real_ip="")) == "172.18.0.3"
    assert client_ip(_req("172.18.0.3", x_real_ip="1.2.3.4, 5.6.7.8")) == "172.18.0.3"


def test_no_header_uses_peer():
    assert client_ip(_req("172.18.0.3")) == "172.18.0.3"


def test_ipv6_client_via_trusted_peer():
    assert client_ip(_req("172.18.0.3", x_real_ip="2001:db8::5")) == "2001:db8::5"


# ---------------- key_func trust: cloudflare mode (CF-Connecting-IP) ----------------

def test_cloudflare_mode_reads_cf_header_only(cloudflare_mode):
    assert client_ip(_req("172.18.0.3", cf_connecting_ip="198.51.100.7")) == "198.51.100.7"
    assert client_ip(_req("172.18.0.3", x_real_ip="198.51.100.7")) == "172.18.0.3"


def test_cloudflare_mode_still_ignored_from_untrusted_peer(cloudflare_mode):
    assert client_ip(_req("203.0.113.9", cf_connecting_ip="198.51.100.7")) == "203.0.113.9"


def test_limiter_uses_client_ip_key_func():
    assert lim.limiter._key_func is client_ip


# ---------------- per-email window ----------------

def test_window_blocks_after_limit_and_expires(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(lim.time, "monotonic", lambda: t[0])
    w = _AttemptWindow(limit=3, window_seconds=60)
    for _ in range(3):
        w.check("a")
    with pytest.raises(Exception) as ei:
        w.check("a")
    assert getattr(ei.value, "status_code", None) == 429
    t[0] += 61
    w.check("a")  # window slid


def test_window_prunes_expired_keys_bounded_memory(monkeypatch):
    t = [0.0]
    monkeypatch.setattr(lim.time, "monotonic", lambda: t[0])
    w = _AttemptWindow(limit=10, window_seconds=60, max_keys=100_000, sweep_every=50)
    for i in range(500):
        w.check(f"user{i}@x.com")
    assert len(w._hits) == 500
    t[0] += 120  # everything expired
    for i in range(50):  # triggers a sweep
        w.check(f"fresh{i}@x.com")
    assert len(w._hits) <= 60, len(w._hits)


def test_window_hard_cap(monkeypatch):
    monkeypatch.setattr(lim.time, "monotonic", lambda: 5.0)
    w = _AttemptWindow(limit=10, window_seconds=900, max_keys=100, sweep_every=10_000)
    for i in range(1000):
        w.check(f"k{i}")
    assert len(w._hits) <= 100


# ---------------- HTTP: /login behaviour ----------------

async def _login(client, email, ip, password="wrong"):
    return await client.post("/api/auth/login", json={"email": email, "password": password},
                             headers={"X-Real-IP": ip})


@pytest.mark.asyncio
async def test_email_throttle_case_insensitive_and_11th_is_429(client, seed_users):
    login_email_limiter.reset()
    variants = ["Leader@Test.com", "leader@test.com", "LEADER@test.com", "leader@TEST.COM", " leader@test.com"]
    codes = []
    for i in range(11):
        res = await _login(client, variants[i % len(variants)].strip(), f"198.51.100.{100 + i}")
        codes.append(res.status_code)
    assert codes[:10] == [401] * 10, codes
    assert codes[10] == 429, codes
    login_email_limiter.reset()


@pytest.mark.asyncio
async def test_throttle_does_not_reveal_whether_email_exists(client, seed_users):
    login_email_limiter.reset()
    outcomes = {}
    for email in ("leader@test.com", "nobody-here@test.com"):
        seq = []
        for i in range(11):
            res = await _login(client, email, f"198.51.101.{(1 if email.startswith('l') else 100) + i}")
            seq.append((res.status_code, res.json().get("detail")))
        outcomes[email] = seq
    assert outcomes["leader@test.com"] == outcomes["nobody-here@test.com"]
    assert outcomes["leader@test.com"][0] == (401, "Invalid email or password")
    assert outcomes["leader@test.com"][10][0] == 429
    login_email_limiter.reset()


@pytest.mark.asyncio
async def test_per_ip_login_limit_is_per_client_not_global(client, seed_users):
    login_email_limiter.reset()
    ip_a, ip_b = "192.0.2.201", "192.0.2.202"
    a_codes = [(await _login(client, f"spray{i}@test.com", ip_a)).status_code for i in range(6)]
    assert a_codes[:5] == [401] * 5 and a_codes[5] == 429, a_codes
    # a different client IP must still be able to log in
    ok = await _login(client, "leader@test.com", ip_b, password="password123")
    assert ok.status_code == 200, ok.text
    login_email_limiter.reset()


@pytest.mark.asyncio
async def test_untrusted_peer_cannot_dodge_limit_by_rotating_header(client, seed_users, monkeypatch):
    """Direct (untrusted) peer rotating X-Real-IP / CF-Connecting-IP still lands in ONE slowapi bucket."""
    login_email_limiter.reset()
    monkeypatch.setattr(lim, "_TRUSTED_NETWORKS", [])  # simulate: test peer is not the trusted proxy
    codes = [(await _login(client, f"rot{i}@test.com", f"198.18.0.{i + 1}")).status_code for i in range(7)]
    assert codes[5] == 429 and codes[6] == 429, codes
    login_email_limiter.reset()
