from app.services.client_meeting_months import resolve_monthly_status, merge_monthly_status


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
