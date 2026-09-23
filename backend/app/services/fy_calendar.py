from datetime import date

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]


def parse_fy_slug(slug: str) -> tuple[int, int] | None:
    if not slug or len(slug) != 4:
        return None
    start_year = 2000 + int(slug[:2])
    end_year = 2000 + int(slug[2:])
    return start_year, end_year


def get_current_fy_slug(as_of: date | None = None) -> str:
    as_of = as_of or date.today()
    y, m = as_of.year, as_of.month
    if m >= 4:
        return f"{y % 100:02d}{(y + 1) % 100:02d}"
    return f"{(y - 1) % 100:02d}{y % 100:02d}"


def get_fy_month_calendar_year(month_key: str, fiscal_year: str) -> int | None:
    parsed = parse_fy_slug(fiscal_year)
    if not parsed:
        return None
    start_year, end_year = parsed
    month_num = int(month_key)
    return start_year if month_num >= 4 else end_year


def get_last_completed_calendar_month(as_of: date | None = None) -> tuple[int, int]:
    """
    Return (year, month) for the last fully completed calendar month.
    Example: if as_of is 2026-07-02, returns (2026, 6).
    """
    as_of = as_of or date.today()
    if as_of.month == 1:
        return as_of.year - 1, 12
    return as_of.year, as_of.month - 1


def is_fy_month_after_calendar_month(
    fiscal_year: str,
    month_key: str,
    cutoff_year: int,
    cutoff_month: int,
) -> bool:
    """True if the FY month maps to a calendar month strictly after the cutoff."""
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    if cal_year is None:
        return False
    month_num = int(month_key)
    return (cal_year, month_num) > (cutoff_year, cutoff_month)


def is_fy_month_elapsed(month_key: str, fiscal_year: str, as_of: date | None = None) -> bool:
    as_of = as_of or date.today()
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    if cal_year is None:
        return False
    month_num = int(month_key)
    if cal_year < as_of.year:
        return True
    if cal_year > as_of.year:
        return False
    return month_num <= as_of.month


def is_future_fy_month(fiscal_year: str, month_key: str, as_of: date | None = None) -> bool:
    as_of = as_of or date.today()
    if fiscal_year != get_current_fy_slug(as_of):
        return False
    return not is_fy_month_elapsed(month_key, fiscal_year, as_of)


MONTH_FULL_NAMES = {
    "04": "April", "05": "May", "06": "June", "07": "July",
    "08": "August", "09": "September", "10": "October", "11": "November",
    "12": "December", "01": "January", "02": "February", "03": "March",
}


def month_key_from_label(label: str) -> str | None:
    """Parse 'April 2025' style labels to FY month keys."""
    if not label:
        return None
    for key, name in MONTH_FULL_NAMES.items():
        if label.startswith(name):
            return key
    return None


def get_month_lock_date(fiscal_year: str, month_key: str) -> date | None:
    """
    First calendar date when the target FY month becomes locked (20th of the
    month after the target month's calendar period).
    """
    cal_year = get_fy_month_calendar_year(month_key, fiscal_year)
    if cal_year is None or month_key not in FY_MONTH_KEYS:
        return None
    month_num = int(month_key)
    if month_num == 12:
        return date(cal_year + 1, 1, 20)
    return date(cal_year, month_num + 1, 20)


def is_month_locked(
    fiscal_year: str,
    month_key: str,
    user: dict | None = None,
    as_of: date | None = None,
) -> bool:
    """True when status/projection edits for month_key should be blocked."""
    if user and user.get("role") == "admin":
        return False
    lock_date = get_month_lock_date(fiscal_year, month_key)
    if lock_date is None:
        return False
    as_of = as_of or date.today()
    return as_of >= lock_date


def get_available_fy_month_keys(fiscal_year: str, as_of: date | None = None) -> list[str]:
    """
    FY months visible in dashboards for a given fiscal year.
    - Past FY: full year (Apr–Mar)
    - Current FY: elapsed months inclusive of the current calendar month
    - Future FY: April only (first month)
    Mirrors frontend getAvailableFyMonths / getSummaryMonthKeys.
    """
    as_of = as_of or date.today()
    current_fy = get_current_fy_slug(as_of)
    if fiscal_year < current_fy:
        return list(FY_MONTH_KEYS)
    if fiscal_year > current_fy:
        return ["04"]
    return [mk for mk in FY_MONTH_KEYS if is_fy_month_elapsed(mk, fiscal_year, as_of)]
