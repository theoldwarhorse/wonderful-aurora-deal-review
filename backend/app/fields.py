"""The fields the extraction agent is asked for.

They are kept in the database so an administrator can change them without a
release. Three rules keep that safe:

- A field's id never changes. It is the key the extraction service uses.
- A field is retired, never deleted, so values already extracted are kept.
- Changes apply to deals that are still open. An approved deal is not
  rebuilt from this list at all: it is read from the snapshot taken when it
  was approved (see reviewing.approve).
"""

import re

from . import audit
from .db import Connection
from .errors import Invalid, NotFound


def all_definitions(conn: Connection) -> list[dict]:
    """Every definition, retired ones included, in display order."""
    return conn.execute("SELECT * FROM field_definitions ORDER BY position, id").fetchall()


def public(definition: dict) -> dict:
    return {"id": definition["id"], "group": definition["field_group"], "label": definition["label"]}


def active(conn: Connection) -> list[dict]:
    """What the extraction service should extract today."""
    return [public(d) for d in all_definitions(conn) if d["retired_at"] is None]


def version(conn: Connection) -> int:
    """Which edition of the field list this is: 1 as first loaded, and one more for every change since.

    It is sent with every approved deal, so the system receiving it can tell that the
    fields changed without comparing messages. The count comes from the audit log, which
    already records each change.
    """
    changes = conn.execute("SELECT COUNT(*) AS n FROM audit_log WHERE starts_with(action, 'field-')").fetchone()
    return 1 + (changes["n"] if changes else 0)


def for_admin(conn: Connection) -> dict:
    return {
        "version": version(conn),
        "fields": [
            {**public(d), "active": d["retired_at"] is None, "createdAt": d["created_at"], "retiredAt": d["retired_at"]}
            for d in all_definitions(conn)
        ],
    }


def _clean(text: str | None, what: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        raise Invalid(f"A field needs a {what}.")
    return cleaned


def add(conn: Connection, label: str, group: str, actor: str, field_id: str | None = None) -> str:
    label, group = _clean(label, "label"), _clean(group, "group")
    # Without an id, make one from the label: "Hedging requirement" becomes "hedging_requirement".
    field_id = (field_id or "").strip() or re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    if not re.fullmatch(r"[a-z][a-z0-9_]{1,59}", field_id):
        raise Invalid("A field id is lower-case letters, digits and underscores, starting with a letter.")
    if conn.execute("SELECT 1 FROM field_definitions WHERE id = %s", (field_id,)).fetchone():
        raise Invalid(f'A field with the id "{field_id}" already exists. Restore it if it was retired.')

    conn.execute(
        """INSERT INTO field_definitions (id, field_group, label, position)
           VALUES (%s, %s, %s, (SELECT COALESCE(MAX(position), 0) + 1 FROM field_definitions))""",
        (field_id, group, label),
    )
    audit.record(conn, None, "field-added", actor, field_id, None, label)
    return field_id


def update(
    conn: Connection, field_id: str, actor: str, label: str | None = None, group: str | None = None, active: bool | None = None
) -> None:
    current = conn.execute("SELECT * FROM field_definitions WHERE id = %s FOR UPDATE", (field_id,)).fetchone()
    if not current:
        raise NotFound("Field not found.")

    if label is not None and (label := _clean(label, "label")) != current["label"]:
        conn.execute("UPDATE field_definitions SET label = %s WHERE id = %s", (label, field_id))
        audit.record(conn, None, "field-renamed", actor, field_id, current["label"], label)
    if group is not None and (group := _clean(group, "group")) != current["field_group"]:
        conn.execute("UPDATE field_definitions SET field_group = %s WHERE id = %s", (group, field_id))
        audit.record(conn, None, "field-moved", actor, field_id, current["field_group"], group)
    if active is not None and active != (current["retired_at"] is None):
        conn.execute("UPDATE field_definitions SET retired_at = CASE WHEN %s THEN NULL ELSE now() END WHERE id = %s", (active, field_id))
        audit.record(conn, None, "field-restored" if active else "field-retired", actor, field_id)
