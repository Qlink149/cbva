from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def serialize_datetime(dt: datetime | None) -> str | None:
    """Serialize a datetime as UTC ISO-8601 with Z suffix for JSON APIs."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def parse_ist_date_start(value: str | None) -> datetime | None:
    """Parse YYYY-MM-DD as start of day in IST, returned as UTC."""
    if not value:
        return None
    try:
        d = date.fromisoformat(value[:10])
    except ValueError:
        return None
    local = datetime.combine(d, time.min, tzinfo=IST)
    return local.astimezone(timezone.utc)


def parse_ist_date_end(value: str | None) -> datetime | None:
    """Parse YYYY-MM-DD as end of day in IST, returned as UTC."""
    if not value:
        return None
    try:
        d = date.fromisoformat(value[:10])
    except ValueError:
        return None
    local = datetime.combine(d, time(23, 59, 59, 999999), tzinfo=IST)
    return local.astimezone(timezone.utc)
