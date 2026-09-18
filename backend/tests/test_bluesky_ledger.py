"""Blue Sky ledger / timeline tests."""

from datetime import date
from app.services.fy_calendar import get_available_fy_month_keys
from app.routers.bluesky import _empty_month_row, _key_from_month_label
from app.services.bluesky_service import next_month_key, prior_month_key


def test_available_months_current_fy_includes_through_today():
    # Freeze expectation with a known as_of inside FY 2526 (Apr 2025 – Mar 2026)
    as_of = date(2025, 7, 17)
    keys = get_available_fy_month_keys("2526", as_of)
    assert keys[0] == "04"
    assert "07" in keys
    assert "08" not in keys


def test_empty_month_row_has_nulls():
    row = _empty_month_row(
        leader_id="manan",
        fiscal_year="2526",
        month_key="04",
        sort_order=1,
        is_current_month=False,
    )
    assert row["has_data"] is False
    assert row["opening"] is None
    assert row["additional"] is None
    assert row["converted"] is None
    assert row["closing"] is None
    assert "April" in row["month"]


def test_key_from_month_label():
    assert _key_from_month_label("April 2025") == "04"
    assert _key_from_month_label("July 2026") == "07"
    assert _key_from_month_label("unknown") is None


def test_prior_month_key_within_fy():
    assert prior_month_key("2627", "07") == ("2627", "06")
    assert prior_month_key("2627", "04") == ("2526", "03")


def test_next_month_key_matches_nikhil_converted_window():
    """Converted[M] uses snapshots for M and M+1 — e.g. July row needs Aug pipeline."""
    assert next_month_key("2627", "07") == ("2627", "08")
    assert next_month_key("2627", "03") == ("2728", "04")
    assert prior_month_key("2627", "08") == ("2627", "07")
