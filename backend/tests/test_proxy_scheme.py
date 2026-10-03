"""X-Forwarded-Proto is honoured only from TRUSTED_PROXY_CIDRS (Caddy), and never changes the client IP."""
import pytest
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.limiter import client_ip
from app.core.proxy import TrustedProxySchemeMiddleware


async def _echo(scope, receive, send):
    req = Request(scope, receive)
    await JSONResponse({"scheme": scope["scheme"], "url": str(req.url), "client": scope["client"][0],
                        "key": client_ip(req)})(scope, receive, send)


APP = TrustedProxySchemeMiddleware(_echo)


async def _get(peer: str, headers: dict) -> dict:
    transport = ASGITransport(app=APP, client=(peer, 40000))
    async with AsyncClient(transport=transport, base_url="http://cbva-api.claraai.tech") as ac:
        return (await ac.get("/api/leaders/", headers=headers)).json()


@pytest.mark.asyncio
@pytest.mark.parametrize("peer", ["172.18.0.4", "10.0.0.2", "127.0.0.1"])
async def test_https_from_trusted_proxy_sets_scheme(peer):
    r = await _get(peer, {"X-Forwarded-Proto": "https"})
    assert r["scheme"] == "https"
    assert r["url"] == "https://cbva-api.claraai.tech/api/leaders/"


@pytest.mark.asyncio
@pytest.mark.parametrize("peer", ["203.0.113.9", "8.8.8.8"])
async def test_untrusted_peer_cannot_set_scheme(peer):
    r = await _get(peer, {"X-Forwarded-Proto": "https"})
    assert r["scheme"] == "http"


@pytest.mark.asyncio
@pytest.mark.parametrize("value", ["ftp", "javascript", "", "https evil", "gopher://x"])
async def test_invalid_values_ignored(value):
    r = await _get("172.18.0.4", {"X-Forwarded-Proto": value})
    assert r["scheme"] == "http"


@pytest.mark.asyncio
async def test_first_value_of_a_list_and_case_insensitive():
    assert (await _get("172.18.0.4", {"X-Forwarded-Proto": "HTTPS, http"}))["scheme"] == "https"


@pytest.mark.asyncio
async def test_no_header_keeps_scheme():
    assert (await _get("172.18.0.4", {}))["scheme"] == "http"


@pytest.mark.asyncio
async def test_scheme_middleware_never_changes_client_ip_or_bucket():
    """Spoofed forwarding headers still cannot change the rate-limit key."""
    spoof = {"X-Forwarded-Proto": "https", "X-Forwarded-For": "1.1.1.1", "CF-Connecting-IP": "2.2.2.2"}
    r = await _get("203.0.113.9", {**spoof, "X-Real-IP": "3.3.3.3"})       # untrusted peer
    assert r["client"] == "203.0.113.9" and r["key"] == "203.0.113.9" and r["scheme"] == "http"
    r = await _get("172.18.0.4", {**spoof, "X-Real-IP": "198.51.100.7"})   # trusted peer (Caddy)
    assert r["client"] == "172.18.0.4" and r["key"] == "198.51.100.7" and r["scheme"] == "https"
