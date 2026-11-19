"""The HTTP API. Routes stay thin: open a transaction, call a function, return the deal."""

import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response as StarletteResponse
from starlette.types import Scope

from . import activity, config, db, deals, errors, fields, intake, mcp_server, outbox, points, reviewing, seed, usage
from .schemas import EditIn, EventIn, ExtractionIn, FieldCreateIn, FieldUpdateIn


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.wait_and_migrate()
    with db.connect() as conn:
        seed.seed_if_empty(conn)
    async with mcp_server.server.session_manager.run():
        logging.getLogger("uvicorn.error").info("Deal Review is ready at %s", config.PUBLIC_URL)
        yield


app = FastAPI(title="Aurora Deal Review API", version="0.1.0", lifespan=lifespan)


@app.exception_handler(errors.NotFound)
def not_found(_: Request, error: errors.NotFound):
    return JSONResponse({"detail": str(error)}, status_code=404)


@app.exception_handler(errors.Conflict)
def conflict(_: Request, error: errors.Conflict):
    return JSONResponse({"detail": str(error)}, status_code=409)


@app.exception_handler(errors.Invalid)
def invalid(_: Request, error: errors.Invalid):
    return JSONResponse({"detail": str(error)}, status_code=422)


def current(deal_id: str) -> dict:
    with db.connect() as conn:
        return deals.get_deal(conn, deal_id)


# ---------------------------------------------------------------- for the review screen


@app.get("/api/health")
def health():
    with db.connect() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.get("/api/me")
def me():
    return {"title": config.REVIEWER_TITLE, "demoMode": config.DEMO_MODE}


@app.get("/api/fields")
def list_fields():
    """The fields to extract today. The extraction service reads this before it starts."""
    with db.connect() as conn:
        return fields.active(conn)


@app.get("/api/deals")
def list_deals():
    with db.connect() as conn:
        return deals.list_deals(conn)


@app.post("/api/deals", status_code=201)
def create_deal(name: str = Form(), borrower: str = Form(), types: list[str] = Form(), files: list[UploadFile] = File()):
    if len(files) != len(types):
        raise errors.Invalid("Each PDF needs a document type.")
    # Read one byte past the limit so an oversized file is detected without loading all of it.
    uploads = [(f.filename or "document.pdf", t, f.file.read(config.MAX_UPLOAD_BYTES + 1)) for f, t in zip(files, types, strict=True)]
    with db.connect() as conn:
        deal_id = intake.create_deal(conn, name, borrower, uploads, config.REVIEWER_TITLE)
    # This is where a real system would tell the extraction service that documents are waiting.
    return current(deal_id)


@app.get("/api/deals/{deal_id}")
def get_deal(deal_id: str):
    return current(deal_id)


@app.get("/api/deals/{deal_id}/documents/{document_id}/file")
def document_file(deal_id: str, document_id: str):
    with db.connect() as conn:
        path = deals.document_path(conn, deal_id, document_id)
    if not path.is_file():
        raise errors.NotFound("The file for this document is missing.")
    return FileResponse(path, media_type="application/pdf")


@app.put("/api/deals/{deal_id}/fields/{field_id}")
def save_edit(deal_id: str, field_id: str, body: EditIn):
    if body.notInDocuments == (body.value is not None):
        raise errors.Invalid("Send either a value or notInDocuments.")
    with db.connect() as conn:
        reviewing.save_edit(conn, deal_id, field_id, config.REVIEWER_TITLE, body.value, body.notInDocuments)
    return current(deal_id)


@app.delete("/api/deals/{deal_id}/fields/{field_id}/edit")
def undo_edit(deal_id: str, field_id: str):
    with db.connect() as conn:
        reviewing.undo_edit(conn, deal_id, field_id, config.REVIEWER_TITLE)
    return current(deal_id)


@app.post("/api/deals/{deal_id}/points/{point_id}/checked")
def mark_point_checked(deal_id: str, point_id: int):
    """The deal manager has looked again at something a checking agent raised."""
    with db.connect() as conn:
        points.mark_checked(conn, deal_id, point_id, config.REVIEWER_TITLE)
    return current(deal_id)


@app.post("/api/deals/{deal_id}/approval")
def approve(deal_id: str):
    with db.connect() as conn:
        message_id = reviewing.approve(conn, deal_id, config.REVIEWER_TITLE)
    # The approval is committed. Delivery is a separate step that may fail without undoing it.
    outbox.deliver(message_id)
    return current(deal_id)


@app.post("/api/deals/{deal_id}/delivery")
def retry_delivery(deal_id: str):
    current(deal_id)
    outbox.deliver_for_deal(deal_id)
    return current(deal_id)


@app.post("/api/deals/{deal_id}/events", status_code=204)
def track(deal_id: str, body: EventIn):
    """Record that a reviewer opened the deal, viewed a document, or opened a field's details."""
    with db.connect() as conn:
        usage.record(conn, config.REVIEWER_TITLE, body.event, deal_id, body.fieldId, body.documentId)
    return Response(status_code=204)


@app.get("/api/deals/{deal_id}/export")
def export(deal_id: str):
    """The message sent, or waiting to be sent, to the downstream system."""
    with db.connect() as conn:
        return deals.sent_payload(conn, deal_id)


@app.get("/api/deals/{deal_id}/audit")
def audit(deal_id: str):
    with db.connect() as conn:
        return deals.audit_trail(conn, deal_id)


# ---------------------------------------------------------------- for the extraction service


@app.put("/api/deals/{deal_id}/extraction")
def receive_extraction(deal_id: str, body: ExtractionIn, x_extraction_token: str = Header(default="")):
    """Called by the extraction service when it has finished reading a deal's documents."""
    if not config.EXTRACTION_TOKEN or not hmac.compare_digest(x_extraction_token, config.EXTRACTION_TOKEN):
        raise HTTPException(401, "A valid X-Extraction-Token header is required.")
    with db.connect() as conn:
        intake.receive_extraction(conn, deal_id, [f.model_dump() for f in body.fields])
    return current(deal_id)


# ---------------------------------------------------------------- administration
# Open to anyone who can reach the service, like the rest of the API: there is no sign-in yet.


@app.get("/api/admin/fields")
def admin_fields():
    """Every field definition, including retired ones, and the version of the list."""
    with db.connect() as conn:
        return fields.for_admin(conn)


@app.post("/api/admin/fields", status_code=201)
def add_field(body: FieldCreateIn):
    with db.connect() as conn:
        fields.add(conn, body.label, body.group, config.REVIEWER_TITLE, body.id)
        return fields.for_admin(conn)


@app.patch("/api/admin/fields/{field_id}")
def update_field(field_id: str, body: FieldUpdateIn):
    """Rename a field, move it to another group, or retire or restore it. Its id cannot change."""
    with db.connect() as conn:
        fields.update(conn, field_id, config.REVIEWER_TITLE, body.label, body.group, body.active)
        return fields.for_admin(conn)


@app.get("/api/admin/agents")
async def admin_agents():
    """What the Admin page shows about the MCP server: its tools, read from the server itself.

    The token is handed to the page only in demo mode, where it is the published demo default.
    """
    tools = await mcp_server.server.list_tools()
    return {
        "token": config.MCP_TOKEN if config.DEMO_MODE else None,
        "tools": [{"name": tool.name, "description": tool.description} for tool in tools],
    }


@app.get("/api/admin/activity")
def admin_activity():
    """Counts and recent activity, from the data the service already keeps."""
    with db.connect() as conn:
        return activity.overview(conn)


# ---------------------------------------------------------------- demo only


@app.post("/api/reset")
def reset():
    if not config.DEMO_MODE:
        raise HTTPException(404)
    with db.connect() as conn:
        seed.reset(conn)
    return {"reset": True}


class McpWithoutTrailingSlash:
    """Serve /mcp as /mcp/. A mounted app answers /mcp with a redirect, which MCP clients do not follow."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/mcp":
            scope = {**scope, "path": "/mcp/", "raw_path": b"/mcp/"}
        await self.inner(scope, receive, send)


# For AI agents. See mcp_server.py.
app.mount("/mcp", mcp_server.http_app)
app.add_middleware(McpWithoutTrailingSlash)


class Frontend(StaticFiles):
    """The built frontend.

    The page itself is re-checked on every visit, so an update shows on the next load. Its
    scripts and styles carry a fingerprint in their file names, so the browser may keep those.
    """

    async def get_response(self, path: str, scope: Scope) -> StarletteResponse:
        response = await super().get_response(path, scope)
        if response.headers.get("content-type", "").startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache"
        return response


# Present in the Docker image. Mounted last so /api wins.
if config.STATIC_DIR.is_dir():
    app.mount("/", Frontend(directory=config.STATIC_DIR, html=True), name="frontend")
