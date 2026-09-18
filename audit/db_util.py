"""Read-only Mongo helpers for CBVA audits. Never writes."""
from __future__ import annotations

import os
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT / "backend" / ".env"

CODE_TO_LEADER: dict[str, str | None] = {
    "AH": "amol",
    "AK": "ak",  # app CODE_TO_LEADER maps this to None — audit uses real slug
    "AM": "abhitan",
    "MM": "manan",
    "BIU": "biu",
    "NP": "np",
    "PV": "priyesh",
    "RT": "ritesh",
    "SP": None,  # missing in DB
    "VC": "varun",
    "VP": None,  # missing in DB
    "VS": "vinay",
}

# App mapping as shipped (for classifying TRANSMISSION / LEADER_MAPPING errors)
APP_CODE_TO_LEADER: dict[str, str | None] = {
    "AH": "amol",
    "AK": None,
    "AM": "abhitan",
    "MM": "manan",
    "BIU": "biu",
    "NP": "np",
    "PV": "priyesh",
    "RT": "ritesh",
    "SP": None,
    "VC": "varun",
    "VP": None,
    "VS": "vinay",
}

LEADER_TO_CODE = {v: k for k, v in CODE_TO_LEADER.items() if v}

MONTH_LABEL_TO_KEY = {
    "April": "04",
    "May": "05",
    "June": "06",
    "July": "07",
    "August": "08",
    "September": "09",
    "October": "10",
    "November": "11",
    "December": "12",
    "January": "01",
    "February": "02",
    "March": "03",
}

MONTH_KEY_TO_YM = {
    "04": "2025-04",
    "05": "2025-05",
    "06": "2025-06",
    "07": "2025-07",
    "08": "2025-08",
    "09": "2025-09",
    "10": "2025-10",
    "11": "2025-11",
    "12": "2025-12",
    "01": "2026-01",
    "02": "2026-02",
    "03": "2026-03",
}

FY2627_MONTH_KEY_TO_YM = {
    "04": "2026-04",
    "05": "2026-05",
    "06": "2026-06",
    "07": "2026-07",
    "08": "2026-08",
}

TOL_ROW = 1.0
TOL_LEADER_MONTH = 10.0
TOL_FY_TOTAL = 100.0


def load_env() -> None:
    if not BACKEND_ENV.exists():
        raise FileNotFoundError(f"Missing {BACKEND_ENV}")
    for line in BACKEND_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip())


def get_db() -> tuple[AsyncIOMotorClient, AsyncIOMotorDatabase]:
    load_env()
    url = os.environ["MONGODB_URL"]
    name = os.environ["DATABASE_NAME"].strip()
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=15000)
    return client, client[name]


def nearly_equal(a: float | None, b: float | None, tol: float) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= tol


def month_key_from_entry_label(label: str) -> str | None:
    text = (label or "").strip()
    for name, key in MONTH_LABEL_TO_KEY.items():
        if text.startswith(name):
            return key
    return None


def pass_fail(ok: bool) -> str:
    return "PASS" if ok else "FAIL"
