"""Manual entry schema validation for additional_work / new_client."""

import pytest
from pydantic import ValidationError

from app.schemas.additional_work import AdditionalWorkCreate


def test_additional_work_create_syncs_month_keys():
    body = AdditionalWorkCreate(
        leader_id="L1",
        fiscal_year="2627",
        client_name="Acme Corp",
        nature_of_work="Tax advisory",
        logged_month="04",
        source_tab="collections",
    )
    assert body.month_key == "04"
    assert body.logged_month == "04"
    assert body.entry_type == "additional_work"


def test_additional_work_create_requires_month():
    with pytest.raises(ValidationError):
        AdditionalWorkCreate(
            leader_id="L1",
            fiscal_year="2627",
            client_name="Acme Corp",
            nature_of_work="Audit",
        )


def test_new_client_entry_type():
    body = AdditionalWorkCreate(
        leader_id="L1",
        fiscal_year="2627",
        client_name="New Co",
        nature_of_work="Onboarding",
        logged_month="09",
        entry_type="new_client",
        source_tab="engagements",
    )
    assert body.entry_type == "new_client"
