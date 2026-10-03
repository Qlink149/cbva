"""FY slug must follow IST: 31 Mar 18:30 UTC == 1 Apr 00:00 IST."""
from datetime import date, datetime, timezone

import app.services.fiscal_year as fy


class _FrozenDatetime(datetime):
    frozen_utc = datetime(2027, 3, 31, 18, 29, tzinfo=timezone.utc)

    @classmethod
    def now(cls, tz=None):
        return cls.frozen_utc.astimezone(tz) if tz else cls.frozen_utc


def _slug_at(monkeypatch, utc_dt):
    _FrozenDatetime.frozen_utc = utc_dt
    monkeypatch.setattr(fy, "datetime", _FrozenDatetime)
    return fy.calendar_fy_slug()


def test_before_ist_midnight_is_old_fy(monkeypatch):
    assert _slug_at(monkeypatch, datetime(2027, 3, 31, 18, 29, tzinfo=timezone.utc)) == "2627"


def test_at_ist_midnight_is_new_fy(monkeypatch):
    assert _slug_at(monkeypatch, datetime(2027, 3, 31, 18, 30, tzinfo=timezone.utc)) == "2728"


def test_explicit_as_of_unchanged():
    assert fy.calendar_fy_slug(date(2026, 7, 1)) == "2627"
    assert fy.calendar_fy_slug(date(2027, 3, 31)) == "2627"
    assert fy.calendar_fy_slug(date(2027, 4, 1)) == "2728"
