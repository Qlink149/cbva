"""Shared helpers for FY2526 fix scripts."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db_util import get_db, load_env  # noqa: E402

BACKFILL_LEADERS = ["amol", "manan", "np", "priyesh", "ritesh"]
VERIFY_ONLY_LEADERS = {"priyesh", "ritesh"}
FY2526 = "2526"

AH_ROW_KEY = "fy2526_board_actual_collections_fy_25_26"
XLSX_PATH = (
    Path(__file__).resolve().parents[2]
    / "backend"
    / "csv"
    / "Business Plan_Consolidated_FY 2026-27.xlsx"
)
