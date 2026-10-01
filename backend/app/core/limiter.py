import ipaddress
import time

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

_TRUSTED_NETWORKS = settings.trusted_proxy_networks


def _is_trusted_peer(peer: str | None) -> bool:
    try:
        addr = ipaddress.ip_address(peer or "")
    except ValueError:
        return False
    return any(addr in net for net in _TRUSTED_NETWORKS)


def client_ip(request: Request) -> str:
    """Real client IP for rate-limit buckets and logs.

    CF-Connecting-IP is honoured ONLY when the immediate TCP peer is a trusted proxy (Caddy on the
    compose network, see TRUSTED_PROXY_CIDRS). Caddy overwrites that header with the Cloudflare-verified
    client IP. A direct connection from anywhere else cannot choose its own bucket: the header is
    ignored and the peer address is used. Requires uvicorn to NOT rewrite request.client from
    X-Forwarded-For (i.e. no --forwarded-allow-ips '*').
    """
    peer = get_remote_address(request)
    cf_ip = (request.headers.get("cf-connecting-ip") or "").strip()
    if cf_ip and _is_trusted_peer(peer):
        try:
            return str(ipaddress.ip_address(cf_ip))
        except ValueError:
            pass
    return peer


limiter = Limiter(key_func=client_ip)


class _AttemptWindow:
    """Tiny in-process sliding window (single-worker deployment; resets on restart).

    Memory is bounded: expired keys are swept every `sweep_every` calls, and the table is hard-capped.
    """

    def __init__(self, limit: int, window_seconds: int, max_keys: int = 10_000, sweep_every: int = 256):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self.sweep_every = sweep_every
        self._calls = 0
        self._hits: dict[str, list[float]] = {}

    def _sweep(self, now: float) -> None:
        for k in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window]:
            del self._hits[k]

    def check(self, key: str) -> None:
        now = time.monotonic()
        self._calls += 1
        if self._calls % self.sweep_every == 0 or len(self._hits) >= self.max_keys:
            self._sweep(now)
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        if len(hits) >= self.limit:
            self._hits[key] = hits
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        hits.append(now)
        if len(self._hits) >= self.max_keys and key not in self._hits:
            self._hits.clear()  # last-resort cap
        self._hits[key] = hits

    def reset(self) -> None:
        self._hits.clear()


# Per-account throttle for /api/auth/login (slowapi key_func cannot read the JSON body).
login_email_limiter = _AttemptWindow(limit=10, window_seconds=900)
