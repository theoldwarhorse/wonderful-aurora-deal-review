"""Points to check again: advice from a checking agent to the deal manager.

A point names one field of an open deal and says why it deserves a second look. It never
changes a value and never holds up approval. Only the deal manager settles it, by marking
it checked. There is deliberately no way for an agent to say a deal is fine.
"""

from . import audit, deals, fields
from .db import Connection
from .errors import Invalid, NotFound

MAX_REASON = 500


def raise_point(conn: Connection, deal_id: str, field_id: str, reason: str, source: dict | None, actor: str) -> None:
    deals.lock_open_deal(conn, deal_id)
    reason = (reason or "").strip()
    if not reason:
        raise Invalid("A point needs a reason.")
    if len(reason) > MAX_REASON:
        raise Invalid(f"Keep the reason under {MAX_REASON} characters.")
    if not any(f["id"] == field_id for f in fields.active(conn)):
        raise NotFound("Field not found.")
    if source and not conn.execute("SELECT 1 FROM documents WHERE deal_id = %s AND id = %s", (deal_id, source["documentId"])).fetchone():
        raise Invalid("The point cites a document this deal does not have.")

    # Raising the same point twice changes nothing, so an agent can run its check again safely.
    same = "SELECT 1 FROM points_to_check WHERE deal_id = %s AND field_id = %s AND reason = %s AND checked_at IS NULL"
    if conn.execute(same, (deal_id, field_id, reason)).fetchone():
        return

    source = source or {}
    conn.execute(
        """INSERT INTO points_to_check (deal_id, field_id, reason, source_document_id, source_page, source_clause, raised_by)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (deal_id, field_id, reason, source.get("documentId"), source.get("page"), source.get("clause"), actor),
    )
    audit.record(conn, deal_id, "point-raised", actor, field_id, None, reason)


def mark_checked(conn: Connection, deal_id: str, point_id: int, actor: str) -> None:
    """The deal manager has looked again. What they did about it, if anything, is their own edit."""
    deals.lock_open_deal(conn, deal_id)
    point = conn.execute(
        """UPDATE points_to_check SET checked_by = %s, checked_at = now()
           WHERE id = %s AND deal_id = %s AND checked_at IS NULL RETURNING field_id, reason""",
        (actor, point_id, deal_id),
    ).fetchone()
    if not point:
        raise NotFound("Point not found, or already checked.")
    audit.record(conn, deal_id, "point-checked", actor, point["field_id"], point["reason"], None)
