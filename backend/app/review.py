"""The review rules. Pure functions: no database, no web framework.

A field's state comes from two things: what the agent extracted, and whether the
deal manager changed it. Every count, status and permission is derived from that.
"""

from typing import TypedDict

EXTRACTED = "extracted"  # the agent's value stands
EDITED = "edited"  # the deal manager replaced or added a value
MISSING = "missing"  # the agent found nothing and nobody has acted
NOT_IN_DOCUMENTS = "not-in-documents"  # the deal manager says the documents do not contain it


class Edit(TypedDict):
    value: str | None
    not_in_documents: bool


def field_state(extracted: str | None, edit: Edit | None) -> str:
    if edit:
        return NOT_IN_DOCUMENTS if edit["not_in_documents"] else EDITED
    return MISSING if extracted is None else EXTRACTED


def current_value(extracted: str | None, edit: Edit | None) -> str | None:
    return edit["value"] if edit else extracted


def summarise(states: list[str]) -> dict[str, int]:
    counts = {"total": len(states), EXTRACTED: 0, EDITED: 0, MISSING: 0, NOT_IN_DOCUMENTS: 0}
    for state in states:
        counts[state] += 1
    return counts


def deal_status(approved: bool, review_started: bool) -> str:
    if approved:
        return "approved"
    return "in-review" if review_started else "to-review"


def can_approve(approved: bool, summary: dict[str, int]) -> bool:
    """A deal is approved as a whole. The only blocker is a field with no value and no decision."""
    return not approved and summary[MISSING] == 0


def clean_value(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise ValueError("A value cannot be empty.")
    return value


def is_revert(extracted: str | None, value: str) -> bool:
    """Typing the extracted value back is not an edit."""
    return value == extracted
