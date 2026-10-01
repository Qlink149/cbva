import time

from fastapi import HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    """Real client IP.

    CF-Connecting-IP is trusted only because the API container's port is never published:
    Caddy (which is fed by Cloudflare) is the sole peer. Do not expose uvicorn directly.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)


class _AttemptWindow:
    """Tiny in-process sliding window (single-worker deployment; resets on restart)."""

    def __init__(self, limit: int, window_seconds: int, max_keys: int = 10_000):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, list[float]] = {}

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        if len(hits) >= self.limit:
            self._hits[key] = hits
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        hits.append(now)
        if len(self._hits) >= self.max_keys and key not in self._hits:
            self._hits.clear()  # crude bound on memory
        self._hits[key] = hits

    def reset(self) -> None:
        self._hits.clear()


# Per-account throttle for /api/auth/login (slowapi key_func cannot read the JSON body).
login_email_limiter = _AttemptWindow(limit=10, window_seconds=900)
