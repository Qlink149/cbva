from app.services.client_meeting_months import (
    quarter_data_flags,
    quarter_has_data,
    resolve_monthly_from_quarterly,
    resolve_monthly_status,
    merge_monthly_status,
)


def test_resolve_from_quarterly_legacy():
    doc = {
        "q1_status": "Planned",
        "q1_date": "2025-04-15",
        "q2_status": "Completed",
        "q2_date": "",
    }
    monthly = resolve_monthly_status(doc)
    assert monthly["04"]["status"] == "Planned"
    assert monthly["05"]["status"] == "Planned"
    assert monthly["07"]["status"] == "Completed"


def test_merge_monthly_status_partial():
    existing = {"monthly_status": {"04": {"status": "Planned", "date": "2025-04-01"}}}
    merged = merge_monthly_status(existing, {"04": {"status": "Completed"}})
    assert merged["04"]["status"] == "Completed"
    assert merged["04"]["date"] == "2025-04-01"


def test_quarter_blank_yields_empty_months():
    doc = {"q1_status": "", "q1_date": "", "q2_status": None}
    assert quarter_has_data(doc, "q1") is False
    monthly = resolve_monthly_from_quarterly(doc)
    assert monthly["04"] == {"status": "", "date": ""}
    assert monthly["07"] == {"status": "", "date": ""}


def test_quarter_status_only_copies_to_three_months():
    doc = {"q3_status": "Completed", "q3_date": ""}
    monthly = resolve_monthly_from_quarterly(doc)
    assert monthly["10"]["status"] == "Completed"
    assert monthly["11"]["status"] == "Completed"
    assert monthly["12"]["status"] == "Completed"
    assert monthly["10"]["date"] == ""


def test_quarter_data_flags():
    doc = {
        "q1_status": "Planned",
        "q2_date": "2025-07-01",
        "q3_status": "",
        "q3_date": "",
    }
    flags = quarter_data_flags(doc)
    assert flags == {"q1": True, "q2": True, "q3": False, "q4": False}


def test_resolve_monthly_from_quarterly_ignores_existing_monthly():
    doc = {
        "q1_status": "Planned",
        "monthly_status": {"04": {"status": "Overdue", "date": "2025-04-01"}},
    }
    monthly = resolve_monthly_from_quarterly(doc)
    assert monthly["04"]["status"] == "Planned"
    assert monthly["05"]["status"] == "Planned"
