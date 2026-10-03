"""All 'today' logic must follow India time regardless of the container's libc timezone."""
import ast
from datetime import date, datetime, timezone
from pathlib import Path

import app.core.serialization as ser

APP = Path(__file__).resolve().parents[1] / "app"


class _Frozen(datetime):
    now_utc = datetime(2027, 3, 31, 18, 29, tzinfo=timezone.utc)

    @classmethod
    def now(cls, tz=None):
        return cls.now_utc.astimezone(tz) if tz else cls.now_utc


def test_today_ist_flips_at_ist_midnight(monkeypatch):
    monkeypatch.setattr(ser, "datetime", _Frozen)
    _Frozen.now_utc = datetime(2027, 3, 31, 18, 29, tzinfo=timezone.utc)
    assert ser.today_ist() == date(2027, 3, 31)
    _Frozen.now_utc = datetime(2027, 3, 31, 18, 30, tzinfo=timezone.utc)
    assert ser.today_ist() == date(2027, 4, 1)


def test_fy_calendar_defaults_use_ist(monkeypatch):
    import app.services.fy_calendar as cal
    monkeypatch.setattr(cal, "today_ist", lambda: date(2027, 4, 1))
    assert cal.get_current_fy_slug() == "2728"
    monkeypatch.setattr(cal, "today_ist", lambda: date(2027, 3, 31))
    assert cal.get_current_fy_slug() == "2627"


def test_no_naive_clock_calls_in_app():
    """date.today(), datetime.today(), datetime.utcnow() and tz-less datetime.now() are banned in app/."""
    offenders = []
    for path in APP.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                name, base = node.func.attr, getattr(node.func.value, "id", getattr(node.func.value, "attr", ""))
                naive = (name in ("today", "utcnow") and base in ("date", "datetime")) or \
                        (name == "now" and base == "datetime" and not node.args and not node.keywords)
                if naive:
                    offenders.append(f"{path.relative_to(APP)}:{node.lineno} {base}.{name}()")
    assert not offenders, offenders
