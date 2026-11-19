"""How a deal arrives: its documents are uploaded, then the extraction service delivers what it read."""

import shutil
import uuid
from pathlib import Path

from . import audit, config, deals, fields
from .db import Connection
from .errors import Conflict, Invalid

DOCUMENT_TYPES = {"agreement", "schedule", "amendment", "supporting"}


def create_deal(conn: Connection, name: str, borrower: str, uploads: list[tuple[str, str, bytes]], actor: str) -> str:
    """Create a deal from uploaded PDFs. `uploads` is (file name, document type, content)."""
    name, borrower = name.strip(), borrower.strip()
    if not name or not borrower:
        raise Invalid("A deal needs a name and a borrower.")
    if not 1 <= len(uploads) <= config.MAX_UPLOAD_FILES:
        raise Invalid(f"Add between 1 and {config.MAX_UPLOAD_FILES} PDFs.")
    for filename, doc_type, content in uploads:
        if doc_type not in DOCUMENT_TYPES:
            raise Invalid(f'"{doc_type}" is not a document type.')
        if len(content) > config.MAX_UPLOAD_BYTES:
            raise Invalid(f'"{filename}" is larger than {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB.')
        if not content.startswith(b"%PDF-"):
            raise Invalid(f'"{filename}" is not a PDF.')

    deal_id = f"deal-{uuid.uuid4().hex[:8]}"
    conn.execute("INSERT INTO deals (id, name, borrower) VALUES (%s, %s, %s)", (deal_id, name, borrower))
    folder = config.DOCUMENTS_DIR / deal_id
    folder.mkdir(parents=True)
    try:
        for position, (filename, doc_type, content) in enumerate(uploads, start=1):
            # The client's file name is used for the title only, never as a path.
            document_id = f"doc-{position}"
            title = Path(filename).stem.replace("-", " ").replace("_", " ").strip() or f"Document {position}"
            short = "".join(word[0] for word in title.split())[:3].upper()
            (folder / f"{document_id}.pdf").write_bytes(content)
            conn.execute(
                "INSERT INTO documents (deal_id, id, position, short, title, type, path) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (deal_id, document_id, position, short, title, doc_type, f"{deal_id}/{document_id}.pdf"),
            )
        audit.record(conn, deal_id, "created", actor)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    return deal_id


def receive_extraction(conn: Connection, deal_id: str, extracted: list[dict], actor: str = "extraction-service") -> None:
    """Store the extraction agent's output for a deal. Refused once a review has started.

    Review starts when a reviewer first opens a field of an extracted deal, or first changes a
    value. That moment is recorded on the deal and never cleared, so undoing a change does not
    reopen the door.
    """
    deal = deals.lock_open_deal(conn, deal_id)
    if deal["review_started_at"] is not None:
        raise Conflict("A reviewer has started on this deal, so its extraction cannot be replaced.")

    document_ids = {r["id"] for r in conn.execute("SELECT id FROM documents WHERE deal_id = %s", (deal_id,))}
    known = {d["id"] for d in fields.all_definitions(conn)}
    seen: set[str] = set()
    for field in extracted:
        if field["id"] not in known:
            raise Invalid(f'Unknown field "{field["id"]}".')
        if field["id"] in seen:
            raise Invalid(f'Field "{field["id"]}" is given twice.')
        seen.add(field["id"])
        source = field.get("source")
        if source and source["documentId"] not in document_ids:
            raise Invalid(f'Field "{field["id"]}" cites a document this deal does not have.')

    conn.execute("DELETE FROM extracted_fields WHERE deal_id = %s", (deal_id,))
    for field in extracted:
        source = field.get("source") or {}
        conn.execute(
            """INSERT INTO extracted_fields (deal_id, field_id, value, confidence, source_document_id, source_page, source_clause)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                deal_id,
                field["id"],
                # Blank is not a value. "   " from the agent is the same as nothing found.
                (field.get("value") or "").strip() or None,
                field.get("confidence"),
                source.get("documentId"),
                source.get("page"),
                source.get("clause"),
            ),
        )
    conn.execute("UPDATE deals SET extraction_received = true WHERE id = %s", (deal_id,))
    audit.record(conn, deal_id, "extraction-received", actor)
