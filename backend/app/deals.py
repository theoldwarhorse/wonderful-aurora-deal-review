"""Deals: reading them.

Every deal the app shows is assembled here, from what was extracted, what the reviewer
changed, and the rules in review.py. Changing a deal is in reviewing.py, and creating one
or receiving its extraction is in intake.py.

Every function takes an open connection and runs inside the caller's transaction.
"""

from pathlib import Path

from . import config, fields, review, usage
from .db import Connection
from .errors import Conflict, NotFound


def _load(conn: Connection, deal_id: str | None = None) -> list[dict]:
    """All deals, or one, in a fixed number of queries."""
    p = {"id": deal_id}  # None selects every deal

    def by_deal(sql: str) -> dict[str, list[dict]]:
        grouped: dict[str, list[dict]] = {}
        for row in conn.execute(sql, p):
            grouped.setdefault(row["deal_id"], []).append(row)
        return grouped

    definitions = fields.all_definitions(conn)
    opened = usage.opened_fields(conn, deal_id)
    deals = conn.execute("SELECT * FROM deals WHERE %(id)s::text IS NULL OR id = %(id)s ORDER BY received_at DESC, id", p).fetchall()
    documents = by_deal("SELECT * FROM documents WHERE %(id)s::text IS NULL OR deal_id = %(id)s ORDER BY position")
    extracted = by_deal("SELECT * FROM extracted_fields WHERE %(id)s::text IS NULL OR deal_id = %(id)s")
    edits = by_deal("SELECT * FROM field_edits WHERE %(id)s::text IS NULL OR deal_id = %(id)s")
    messages = by_deal(
        "SELECT deal_id, status, attempts, last_error, delivered_at FROM outbox WHERE %(id)s::text IS NULL OR deal_id = %(id)s"
    )
    points = by_deal("SELECT * FROM points_to_check WHERE %(id)s::text IS NULL OR deal_id = %(id)s ORDER BY id")
    return [
        _assemble(
            d,
            definitions,
            documents.get(d["id"], []),
            extracted.get(d["id"], []),
            edits.get(d["id"], []),
            messages.get(d["id"]),
            opened.get(d["id"], set()),
            points.get(d["id"], []),
        )
        for d in deals
    ]


def _current_fields(definitions: list[dict], extracted: list[dict], edits: list[dict]) -> list[dict]:
    """The fields of an open deal: today's field list, with what was extracted and what the reviewer changed."""
    extracted_by_field = {row["field_id"]: row for row in extracted}
    edit_by_field = {row["field_id"]: review.Edit(value=row["value"], not_in_documents=row["not_in_documents"]) for row in edits}

    deal_fields = []
    for definition in definitions:
        if definition["retired_at"] is not None:
            continue
        # A field the agent did not return at all is treated as not extracted.
        found = extracted_by_field.get(definition["id"])
        edit = edit_by_field.get(definition["id"])
        extracted_value = found["value"] if found else None
        source = None
        if found and found["source_document_id"]:
            source = {"documentId": found["source_document_id"], "page": found["source_page"], "clause": found["source_clause"]}
        deal_fields.append(
            {
                **fields.public(definition),
                "value": review.current_value(extracted_value, edit),
                "extractedValue": extracted_value,
                "state": review.field_state(extracted_value, edit),
                "confidence": found["confidence"] if found else None,
                "source": source,
            }
        )
    return deal_fields


def _assemble(
    deal: dict,
    definitions: list[dict],
    documents: list[dict],
    extracted: list[dict],
    edits: list[dict],
    messages: list[dict] | None,
    opened: set[str],
    points: list[dict],
) -> dict:
    approved = deal["approved_at"] is not None
    # An approved deal is not rebuilt. It is exactly what the reviewer approved and the downstream
    # system was sent, so later changes to the field list (renames, retirements, new fields) do not reach it.
    deal_fields = deal["approved_fields"] if approved else _current_fields(definitions, extracted, edits)
    summary = review.summarise([f["state"] for f in deal_fields])
    message = messages[0] if messages else None
    return {
        "id": deal["id"],
        "name": deal["name"],
        "borrower": deal["borrower"],
        "facility": deal["facility"],
        "receivedAt": deal["received_at"],
        "awaitingExtraction": not deal["extraction_received"],
        "status": review.deal_status(approved, deal["review_started_at"] is not None),
        "reviewStartedAt": deal["review_started_at"],
        "approved": {"at": deal["approved_at"], "by": deal["approved_by"]} if approved else None,
        "summary": summary,
        "canApprove": review.can_approve(approved, summary),
        # How many of this deal's fields have had their details opened during the review.
        "fieldsOpened": sum(1 for f in deal_fields if f["id"] in opened),
        "delivery": {
            "status": message["status"],
            "attempts": message["attempts"],
            "error": message["last_error"],
            "deliveredAt": message["delivered_at"],
        }
        if message
        else None,
        "documents": [
            {
                "id": d["id"],
                "short": d["short"],
                "title": d["title"],
                "type": d["type"],
                "dated": d["dated"],
                "file": f"/api/deals/{deal['id']}/documents/{d['id']}/file",
            }
            for d in documents
        ],
        "fields": deal_fields,
        # What a checking agent has asked the deal manager to look at again. Kept beside the fields,
        # not inside them, so advice is never part of what is approved or sent downstream.
        "pointsOpen": sum(1 for p in points if p["checked_at"] is None),
        "points": [
            {
                "id": p["id"],
                "fieldId": p["field_id"],
                "reason": p["reason"],
                "source": {"documentId": p["source_document_id"], "page": p["source_page"], "clause": p["source_clause"]}
                if p["source_document_id"]
                else None,
                "raisedBy": p["raised_by"],
                "raisedAt": p["raised_at"],
                "checkedAt": p["checked_at"],
            }
            for p in points
        ],
    }


def load_all(conn: Connection) -> list[dict]:
    """Every deal in full. Used for reporting."""
    return _load(conn)


def list_deals(conn: Connection) -> list[dict]:
    return [
        {**{k: v for k, v in deal.items() if k not in ("documents", "fields", "points")}, "documentCount": len(deal["documents"])}
        for deal in _load(conn)
    ]


def get_deal(conn: Connection, deal_id: str) -> dict:
    found = _load(conn, deal_id)
    if not found:
        raise NotFound("Deal not found.")
    return found[0]


def document_path(conn: Connection, deal_id: str, document_id: str) -> Path:
    row = conn.execute("SELECT path FROM documents WHERE deal_id = %s AND id = %s", (deal_id, document_id)).fetchone()
    if not row:
        raise NotFound("Document not found.")
    return config.DOCUMENTS_DIR / row["path"]


def audit_trail(conn: Connection, deal_id: str) -> list[dict]:
    get_deal(conn, deal_id)
    rows = conn.execute(
        "SELECT field_id, action, old_value, new_value, actor, at FROM audit_log WHERE deal_id = %s ORDER BY id", (deal_id,)
    ).fetchall()
    return [
        {
            "fieldId": r["field_id"],
            "action": r["action"],
            "oldValue": r["old_value"],
            "newValue": r["new_value"],
            "actor": r["actor"],
            "at": r["at"],
        }
        for r in rows
    ]


def sent_payload(conn: Connection, deal_id: str) -> dict:
    get_deal(conn, deal_id)
    row = conn.execute("SELECT payload FROM outbox WHERE deal_id = %s", (deal_id,)).fetchone()
    if not row:
        raise Conflict("This deal has not been approved, so there is nothing to send.")
    return row["payload"]


def lock_open_deal(conn: Connection, deal_id: str) -> dict:
    """Lock the deal for this transaction and refuse if it is already approved."""
    deal = conn.execute("SELECT * FROM deals WHERE id = %s FOR UPDATE", (deal_id,)).fetchone()
    if not deal:
        raise NotFound("Deal not found.")
    if deal["approved_at"] is not None:
        raise Conflict("This deal is approved and can no longer be changed.")
    return deal
