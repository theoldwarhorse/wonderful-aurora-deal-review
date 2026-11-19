"""The three sample deals. Loaded when the database is empty, and on a demo reset."""

import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from . import config, intake, points, reviewing, usage
from .db import Connection


def seed_if_empty(conn: Connection) -> None:
    if not conn.execute("SELECT 1 FROM field_definitions LIMIT 1").fetchone():
        seed(conn)


def reset(conn: Connection) -> None:
    conn.execute("TRUNCATE deals, field_definitions, audit_log CASCADE")
    shutil.rmtree(config.DOCUMENTS_DIR, ignore_errors=True)
    seed(conn)


def seed(conn: Connection) -> None:
    config.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    _load_field_list(conn)
    # One folder per sample deal: its mock extraction (deal.json) beside its PDFs (documents/).
    for path in sorted(config.SEED_DIR.glob("deals/*/deal.json")):
        deal = json.loads(path.read_text())
        _load_deal(conn, deal, path.parent / "documents")
        _load_sample_history(conn, deal)


def _load_field_list(conn: Connection) -> None:
    """The starting list of fields to extract."""
    for position, field in enumerate(json.loads((config.SEED_DIR / "fields.json").read_text()), start=1):
        conn.execute(
            "INSERT INTO field_definitions (id, field_group, label, position) VALUES (%s, %s, %s, %s)",
            (field["id"], field["group"], field["label"], position),
        )


def _load_deal(conn: Connection, deal: dict, pdfs: Path) -> None:
    """A deal, its documents, and its extraction."""
    conn.execute(
        "INSERT INTO deals (id, name, borrower, facility, received_at) VALUES (%s, %s, %s, %s, %s)",
        (deal["id"], deal["name"], deal["borrower"], deal["facility"], deal["receivedAt"]),
    )
    for position, document in enumerate(deal["documents"], start=1):
        stored_as = f"{deal['id']}/{document['file']}"
        target = config.DOCUMENTS_DIR / stored_as
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pdfs / document["file"], target)
        conn.execute(
            "INSERT INTO documents (deal_id, id, position, short, title, type, dated, path) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                deal["id"],
                document["id"],
                position,
                document["short"],
                document["title"],
                document["type"],
                document["dated"],
                stored_as,
            ),
        )
    # The sample extraction goes through the same code as a real delivery from the agent.
    intake.receive_extraction(conn, deal["id"], deal["fields"])
    # So does the sample final check: what a checking agent would have raised on this deal.
    for point in deal.get("points", []):
        points.raise_point(conn, deal["id"], point["fieldId"], point["reason"], point["source"], "Checking agent (sample)")


def _load_sample_history(conn: Connection, deal: dict) -> None:
    """Some sample deals start part-way through a review, or finished, so every status is on show."""
    review = deal.get("seedReview")
    if not review:
        return

    for field_id, edit in review.get("edits", {}).items():
        reviewing.save_edit(conn, deal["id"], field_id, config.REVIEWER_TITLE, edit.get("value"), edit.get("notInDocuments", False))

    approved = review.get("approved")
    approved_at = datetime.fromisoformat(approved["at"].replace("Z", "+00:00")) if approved else None
    if approved_at:
        message_id = reviewing.approve(conn, deal["id"], config.REVIEWER_TITLE, approved_at)
        # Recorded as delivered, though nothing was sent.
        conn.execute("UPDATE outbox SET status = 'delivered', attempts = 1, delivered_at = %s WHERE id = %s", (approved_at, message_id))

    # A matching record of what was opened, so the activity view is not empty on first start:
    # every field of the approved deal, and only the changed field of the deal in review.
    looked_at = approved_at - timedelta(minutes=35) if approved_at else None
    opened = [f["id"] for f in deal["fields"]] if approved_at else list(review.get("edits", {}))
    viewed = deal["documents"] if approved_at else deal["documents"][:1]
    usage.record(conn, config.REVIEWER_TITLE, "deal-opened", deal["id"], at=looked_at)
    for document in viewed:
        usage.record(conn, config.REVIEWER_TITLE, "document-viewed", deal["id"], document_id=document["id"], at=looked_at)
    for field_id in opened:
        usage.record(conn, config.REVIEWER_TITLE, "field-viewed", deal["id"], field_id=field_id, at=looked_at)
