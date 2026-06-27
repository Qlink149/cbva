"""Vercel serverless entrypoint — must export top-level `app` (ASGI)."""
from app.main import app

__all__ = ["app"]
