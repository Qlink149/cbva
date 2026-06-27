from datetime import date


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
