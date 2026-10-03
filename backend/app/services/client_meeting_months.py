"""Monthly meeting status helpers — quarter legacy backfill + monthly_status map."""

FY_MONTH_KEYS = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"]

QUARTER_MONTHS = {
    "q1": ["04", "05", "06"],
    "q2": ["07", "08", "09"],
    "q3": ["10", "11", "12"],
    "q4": ["01", "02", "03"],
}

EMPTY_MONTH = {"status": "", "date": ""}

QUARTER_KEYS = ("q1", "q2", "q3", "q4")


def quarter_has_data(doc: dict, quarter: str) -> bool:
    """True when qN_status or qN_date is non-empty after strip."""
    status = str(doc.get(f"{quarter}_status") or "").strip()
    date_val = str(doc.get(f"{quarter}_date") or "").strip()
    return bool(status or date_val)


def quarter_data_flags(doc: dict) -> dict[str, bool]:
    return {q: quarter_has_data(doc, q) for q in QUARTER_KEYS}


def resolve_monthly_from_quarterly(doc: dict) -> dict[str, dict]:
    """Force quarterly→monthly mapping; ignores existing monthly_status."""
    monthly: dict[str, dict] = {}
    for q, months in QUARTER_MONTHS.items():
        status = doc.get(f"{q}_status", "") or ""
        date_val = doc.get(f"{q}_date", "") or ""
        for mk in months:
            monthly[mk] = {"status": status, "date": date_val}
    for mk in FY_MONTH_KEYS:
        monthly.setdefault(mk, EMPTY_MONTH.copy())
    return monthly


def resolve_monthly_status(doc: dict) -> dict[str, dict]:
    """Return month_key → {status, date}, seeding from quarterly fields when absent."""
    existing = doc.get("monthly_status")
    if isinstance(existing, dict) and existing:
        return {
            mk: {
                "status": (existing.get(mk) or {}).get("status", ""),
                "date": (existing.get(mk) or {}).get("date", ""),
            }
            for mk in FY_MONTH_KEYS
        }

    monthly: dict[str, dict] = {}
    for q, months in QUARTER_MONTHS.items():
        status = doc.get(f"{q}_status", "") or ""
        date_val = doc.get(f"{q}_date", "") or ""
        for mk in months:
            monthly[mk] = {"status": status, "date": date_val}
    for mk in FY_MONTH_KEYS:
        monthly.setdefault(mk, EMPTY_MONTH.copy())
    return monthly


def merge_monthly_status(existing: dict, patch: dict | None) -> dict[str, dict]:
    base = resolve_monthly_status(existing)
    if not patch:
        return base
    for mk, entry in patch.items():
        if mk not in FY_MONTH_KEYS or not isinstance(entry, dict):
            continue
        cur = base.get(mk, EMPTY_MONTH.copy())
        if "status" in entry and entry["status"] is not None:
            cur["status"] = entry["status"]
        if "date" in entry and entry["date"] is not None:
            cur["date"] = entry["date"]
        base[mk] = cur
    return base
