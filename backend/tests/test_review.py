"""The review rules on their own, with no database."""

import pytest

from app import review

EDIT = {"value": "2.00%", "not_in_documents": False}
ABSENT = {"value": None, "not_in_documents": True}


def test_an_edit_shows_the_new_value_and_is_marked_edited():
    assert review.current_value("2.25%", EDIT) == "2.00%"
    assert review.field_state("2.25%", EDIT) == review.EDITED


def test_a_field_with_no_value_and_no_decision_is_missing():
    assert review.field_state(None, None) == review.MISSING
    assert review.field_state(None, EDIT) == review.EDITED
    assert review.field_state(None, ABSENT) == review.NOT_IN_DOCUMENTS
    assert review.current_value("2.25%", ABSENT) is None


def test_typing_the_extracted_value_back_is_not_an_edit():
    assert review.is_revert("2.25%", review.clean_value(" 2.25% "))
    assert not review.is_revert("2.25%", "2.00%")


def test_an_empty_value_is_refused():
    with pytest.raises(ValueError):
        review.clean_value("   ")


def test_summary_counts_each_field_once():
    states = [review.EXTRACTED, review.EDITED, review.NOT_IN_DOCUMENTS]
    assert review.summarise(states) == {"total": 3, "extracted": 1, "edited": 1, "missing": 0, "not-in-documents": 1}


def test_only_a_missing_field_blocks_approval():
    assert not review.can_approve(False, review.summarise([review.EXTRACTED, review.MISSING]))
    assert review.can_approve(False, review.summarise([review.EDITED, review.NOT_IN_DOCUMENTS]))
    assert not review.can_approve(True, review.summarise([review.EXTRACTED]))


def test_deal_status_follows_the_start_of_review_then_approval():
    assert review.deal_status(approved=False, review_started=False) == "to-review"
    assert review.deal_status(approved=False, review_started=True) == "in-review"
    assert review.deal_status(approved=True, review_started=True) == "approved"
