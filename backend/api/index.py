"""Vercel serverless entrypoint — top-level `app` required by Vercel Python runtime."""
import sys
from pathlib import Path

# Ensure backend root is on path when Vercel loads api/index.py
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app as fastapi_app  # noqa: E402

# Rewrites send traffic to /api/index, so FastAPI otherwise only sees that path
# and every real route 404s (including /health and /api/auth/login).
_STRIP = "/api/index"


def _header_map(scope: dict) -> dict[str, str]:
    out = {}
    for key, value in scope.get("headers") or []:
        out[key.decode("latin1").lower()] = value.decode("latin1")
    return out


def _restore_path(scope: dict) -> dict:
    if scope.get("type") != "http":
        return scope
    path = scope.get("path") or "/"
    headers = _header_map(scope)
    forwarded = (headers.get("x-forwarded-uri") or headers.get("x-invoke-path") or "").split("?")[0]
    if path == _STRIP or path.startswith(_STRIP + "/"):
        path = path[len(_STRIP):] or "/"
        if not path.startswith("/"):
            path = f"/{path}"
    elif path in ("/", _STRIP) and forwarded.startswith("/") and forwarded not in ("/", _STRIP):
        path = forwarded
    if path != scope.get("path"):
        scope = dict(scope)
        scope["path"] = path
    return scope


async def app(scope, receive, send):
    await fastapi_app(_restore_path(scope), receive, send)


__all__ = ["app"]
