"""The append-only record of who did what. Written in the same transaction as the change it describes."""

from .db import Connection


def record(
    conn: Connection,
    deal_id: str | None,  # None for changes that are not about one deal, such as the field list
    action: str,
    actor: str,
    field_id: str | None = None,
    old: str | None = None,
    new: str | None = None,
) -> None:
    conn.execute(
        "INSERT INTO audit_log (deal_id, field_id, action, old_value, new_value, actor) VALUES (%s, %s, %s, %s, %s, %s)",
        (deal_id, field_id, action, old, new, actor),
    )
