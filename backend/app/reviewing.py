"""Reviewing a deal: changing a value, undoing a change, and approving.

Anything here first locks the deal's row, so two requests on the same deal run one
after the other, and refuses if the deal is already approved.
"""

import uuid
from datetime import UTC, datetime

from psycopg.types.json import Jsonb

from . import audit, deals, fields, review
from .db import Connection
from .errors import Conflict, Invalid, NotFound


def _field_values(conn: Connection, deal_id: str, field_id: str) -> tuple[str | None, review.Edit | None]:
    """The extracted value of a field on a deal, and the reviewer's current change to it, if any."""
    if not any(f["id"] == field_id for f in fields.active(conn)):
        raise NotFound("Field not found.")
    key = (deal_id, field_id)
    found = conn.execute("SELECT value FROM extracted_fields WHERE deal_id = %s AND field_id = %s", key).fetchone()
    row = conn.execute("SELECT value, not_in_documents FROM field_edits WHERE deal_id = %s AND field_id = %s", key).fetchone()
    edit = review.Edit(value=row["value"], not_in_documents=row["not_in_documents"]) if row else None
    return (found["value"] if found else None), edit


def save_edit(conn: Connection, deal_id: str, field_id: str, actor: str, value: str | None = None, not_in_documents: bool = False) -> None:
    deals.lock_open_deal(conn, deal_id)
    # Review has started from the first change, and stays started even if the change is undone.
    conn.execute("UPDATE deals SET review_started_at = COALESCE(review_started_at, now()) WHERE id = %s", (deal_id,))
    extracted, previous = _field_values(conn, deal_id, field_id)

    if not_in_documents:
        new, action = None, "marked-not-in-documents"
    else:
        try:
            new = review.clean_value(value or "")
        except ValueError as error:
            raise Invalid(str(error)) from error
        if review.is_revert(extracted, new):
            return undo_edit(conn, deal_id, field_id, actor)
        action = "edited"

    conn.execute(
        """INSERT INTO field_edits (deal_id, field_id, value, not_in_documents, edited_by)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (deal_id, field_id) DO UPDATE
           SET value = EXCLUDED.value, not_in_documents = EXCLUDED.not_in_documents,
               edited_by = EXCLUDED.edited_by, edited_at = now()""",
        (deal_id, field_id, new, not_in_documents, actor),
    )
    audit.record(conn, deal_id, action, actor, field_id, review.current_value(extracted, previous), new)


def undo_edit(conn: Connection, deal_id: str, field_id: str, actor: str) -> None:
    deals.lock_open_deal(conn, deal_id)
    extracted, previous = _field_values(conn, deal_id, field_id)
    if not previous:
        return
    conn.execute("DELETE FROM field_edits WHERE deal_id = %s AND field_id = %s", (deal_id, field_id))
    audit.record(conn, deal_id, "reverted", actor, field_id, previous["value"], extracted)


def approve(conn: Connection, deal_id: str, actor: str, at: datetime | None = None) -> uuid.UUID:
    """Approve the deal and queue its message for the downstream system, in one transaction."""
    deals.lock_open_deal(conn, deal_id)
    deal = deals.get_deal(conn, deal_id)
    if not deal["canApprove"]:
        missing = deal["summary"][review.MISSING]
        raise Conflict(f"{missing} {'field needs' if missing == 1 else 'fields need'} a value before the deal can be approved.")

    at = at or datetime.now(UTC)
    message_id = uuid.uuid4()
    payload = {
        "schema": "aurora.deal-approved.v1",
        "messageId": str(message_id),
        # The edition of the field list this deal was approved against. It changes whenever a field
        # is added, renamed, moved, retired or restored, so the receiver can tell without guessing.
        "fieldListVersion": fields.version(conn),
        "deal": {"id": deal["id"], "name": deal["name"], "borrower": deal["borrower"]},
        "approvedBy": actor,
        "approvedAt": at.isoformat(),
        "fields": [
            {
                "id": f["id"],
                "label": f["label"],
                "value": f["value"],
                "origin": f["state"],  # extracted | edited | not-in-documents
                "extractedValue": f["extractedValue"],
                "source": f["source"],
            }
            for f in deal["fields"]
        ],
    }
    # The snapshot and the message are built from the same fields, so the approved record
    # shown in the app always matches what was sent.
    conn.execute(
        "UPDATE deals SET approved_at = %s, approved_by = %s, approved_fields = %s WHERE id = %s",
        (at, actor, Jsonb(deal["fields"]), deal_id),
    )
    conn.execute("INSERT INTO outbox (id, deal_id, payload) VALUES (%s, %s, %s)", (message_id, deal_id, Jsonb(payload)))
    audit.record(conn, deal_id, "approved", actor)
    return message_id
