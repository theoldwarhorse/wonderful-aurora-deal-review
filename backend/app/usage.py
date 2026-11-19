"""What reviewers opened.

The audit log records every change. This records what was opened: deals,
documents, and the details of individual fields. It shows that something was
opened, by whom and when. It cannot show that it was read or understood.
"""

from datetime import datetime

from .db import Connection
from .errors import Invalid, NotFound

EVENTS = ("deal-opened", "document-viewed", "field-viewed")


def record(
    conn: Connection,
    actor: str,
    event: str,
    deal_id: str,
    field_id: str | None = None,
    document_id: str | None = None,
    at: datetime | None = None,  # only the seeded history sets this
) -> None:
    if event not in EVENTS:
        raise Invalid(f'"{event}" is not a usage event.')
    if not conn.execute("SELECT 1 FROM deals WHERE id = %s", (deal_id,)).fetchone():
        raise NotFound("Deal not found.")
    conn.execute(
        "INSERT INTO usage_events (deal_id, event, field_id, document_id, actor, at) VALUES (%s, %s, %s, %s, %s, COALESCE(%s, now()))",
        (deal_id, event, field_id, document_id, actor, at),
    )
    if event == "field-viewed":
        # Opening a field of an extracted deal is where review starts, even if nothing is changed.
        # A deal still waiting for its extraction is not under review just because someone looked at it.
        conn.execute(
            """UPDATE deals SET review_started_at = COALESCE(review_started_at, %s, now())
               WHERE id = %s AND extraction_received AND approved_at IS NULL""",
            (at, deal_id),
        )


def opened_fields(conn: Connection, deal_id: str | None = None) -> dict[str, set[str]]:
    """For each deal, the fields whose details were opened. One deal, or all when deal_id is None.

    For an approved deal only what was opened up to the approval counts, so looking
    afterwards cannot make the review seem more thorough than it was.
    """
    opened: dict[str, set[str]] = {}
    rows = conn.execute(
        """SELECT DISTINCT e.deal_id, e.field_id
           FROM usage_events e JOIN deals d ON d.id = e.deal_id
           WHERE e.event = 'field-viewed' AND e.field_id IS NOT NULL
             AND (%(id)s::text IS NULL OR e.deal_id = %(id)s)
             AND (d.approved_at IS NULL OR e.at <= d.approved_at)""",
        {"id": deal_id},
    )
    for row in rows:
        opened.setdefault(row["deal_id"], set()).add(row["field_id"])
    return opened
