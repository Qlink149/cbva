from datetime import date, datetime, time, timezone
from typing import Annotated, Optional

from pydantic import BeforeValidator


def _blankable_date(value):
    """"" (an empty <input type="date">) -> None; a date or "YYYY-MM-DD" -> midnight UTC datetime.

    BSON cannot store a bare datetime.date (the insert raised InvalidDocument -> 500), so request dates are
    stored the way engagement_actions.deadline already is: a UTC datetime at midnight.
    """
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None
    if isinstance(value, str) and len(value.strip()) == 10:
        try:
            value = date.fromisoformat(value.strip())
        except ValueError:
            return value          # let datetime validation reject it (422)
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    return value


BlankableDate = Annotated[Optional[datetime], BeforeValidator(_blankable_date)]
