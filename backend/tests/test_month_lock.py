"""Month-level hard-lock (20th of following month) for status and projections."""

from datetime import date

from app.services.fy_calendar import get_month_lock_date, is_month_locked


def test_april_lock_date_is_may_20():
    assert get_month_lock_date("2526", "04") == date(2025, 5, 20)


def test_march_lock_date_is_april_20():
    assert get_month_lock_date("2526", "03") == date(2026, 4, 20)


def test_april_unlocked_before_lock_date():
    user = {"role": "user"}
    assert is_month_locked("2526", "04", user, as_of=date(2025, 5, 19)) is False


def test_april_locked_on_lock_date():
    user = {"role": "user"}
    assert is_month_locked("2526", "04", user, as_of=date(2025, 5, 20)) is True


def test_admin_bypasses_month_lock():
    admin = {"role": "admin"}
    assert is_month_locked("2526", "04", admin, as_of=date(2025, 6, 1)) is False
