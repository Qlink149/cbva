"""Vercel serverless entrypoint — top-level `app` required by Vercel Python runtime."""
import sys
from pathlib import Path

# Ensure backend root is on path when Vercel loads api/index.py
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402

__all__ = ["app"]
