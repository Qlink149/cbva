"""ASGI middlewares for running behind Caddy.

TrustedProxySchemeMiddleware
    uvicorn runs with --no-proxy-headers (so a client can never pick its own IP through X-Forwarded-For). That also
    left the request scheme at "http" behind Caddy, so any absolute URL the app built (e.g. FastAPI's trailing-slash
    redirect) pointed at http://. This middleware sets scope["scheme"] from X-Forwarded-Proto, but ONLY when the TCP
    peer is inside TRUSTED_PROXY_CIDRS (the Caddy container network) and the value is http/https. It never touches
    scope["client"], so client-IP handling (app.core.limiter.client_ip) is unchanged. Caddy overwrites any
    client-sent X-Forwarded-Proto with the real scheme of the browser connection.

TrailingSlashNormalizerMiddleware
    The app runs with redirect_slashes=False. When no route matches the request path but the same path with the
    trailing slash added/removed does, the request is served by that route directly: no redirect hop, so methods,
    bodies and the Authorization header are preserved and the frontend never depends on redirects.
"""
from starlette.routing import Match
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.limiter import _is_trusted_peer

_SCHEMES = {"http": {"http", "https"}, "websocket": {"ws", "wss"}}
_WS_FOR = {"http": "ws", "https": "wss"}


class TrustedProxySchemeMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in _SCHEMES:
            client = scope.get("client")
            if client and _is_trusted_peer(client[0]):
                proto = _header(scope, b"x-forwarded-proto")
                if proto:
                    proto = proto.split(",")[0].strip().lower()
                    if scope["type"] == "websocket":
                        proto = _WS_FOR.get(proto, proto)
                    if proto in _SCHEMES[scope["type"]]:
                        scope = dict(scope)
                        scope["scheme"] = proto
        await self.app(scope, receive, send)


class TrailingSlashNormalizerMiddleware:
    def __init__(self, app: ASGIApp, router) -> None:
        self.app = app
        self.router = router

    def _path_matches(self, scope: Scope) -> bool:
        """True if any route matches the path (FULL, or PARTIAL = path matches but not the method)."""
        for route in self.router.routes:
            match, _ = route.matches(scope)
            if match is not Match.NONE:
                return True
        return False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path not in ("", "/") and not self._path_matches(scope):
                alt = path[:-1] if path.endswith("/") else path + "/"
                alt_scope = dict(scope)
                alt_scope["path"] = alt
                raw = scope.get("raw_path")
                if raw is not None:
                    alt_scope["raw_path"] = raw[:-1] if raw.endswith(b"/") else raw + b"/"
                if self._path_matches(alt_scope):
                    scope = alt_scope
        await self.app(scope, receive, send)


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers") or []:
        if key == name:
            return value.decode("latin-1")
    return None
