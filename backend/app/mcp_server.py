"""An MCP server, so AI agents can work with the review system through tools.

It is mounted at /mcp/ on the same service, and it exists for one job: a final check.
An agent reads a deal and its documents, then points the deal manager at any field that
deserves a second look before approval, with its reason.

That is all it can do. It cannot put a value in, change one, mark a point as checked, or
approve a deal. The brief puts a deal manager between the extraction agent and the
downstream system, and this keeps them there: an agent here can advise, never decide.
The extraction itself arrives by its own endpoint (see intake.py), not through this door.
"""

import hmac

from fastapi.encoders import jsonable_encoder
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from starlette.responses import JSONResponse

from . import config, db, deals, errors, fields, points
from .schemas import SourceIn

server = MCPServer(
    "Aurora Deal Review",
    instructions=(
        "Read a loan deal and its documents, then use raise_point to tell the deal manager which "
        "fields deserve a second look before approval, and why. You advise; the deal manager decides. "
        "You cannot change a value, mark a point as checked, or approve a deal, and there is no way "
        "to report that a deal is fine: raising no points is not an assurance."
    ),
)


def _run(action):
    """Run one read or write in a transaction. A refusal reaches the agent with its reason, as a ToolError."""
    try:
        with db.connect() as conn:
            return jsonable_encoder(action(conn))
    except (errors.NotFound, errors.Conflict, errors.Invalid) as error:
        raise ToolError(str(error)) from error


@server.tool()
def list_deals() -> list[dict]:
    """List every deal with its review status, field counts, and whether it can be approved."""
    return _run(deals.list_deals)


@server.tool()
def get_deal(deal_id: str) -> dict:
    """Get one deal: its documents, and each field's current value, extracted value, state and source."""
    return _run(lambda conn: deals.get_deal(conn, deal_id))


@server.tool()
def list_field_definitions() -> list[dict]:
    """List the fields the extraction agent is asked for today: id, group and label."""
    return _run(fields.active)


@server.tool()
def get_audit_trail(deal_id: str) -> list[dict]:
    """List every recorded change to a deal, oldest first: who did what, and the value before and after."""
    return _run(lambda conn: deals.audit_trail(conn, deal_id))


@server.tool()
def get_downstream_message(deal_id: str) -> dict:
    """Get the message sent to the downstream system for an approved deal."""
    return _run(lambda conn: deals.sent_payload(conn, deal_id))


@server.tool()
def raise_point(deal_id: str, field_id: str, reason: str, source: SourceIn | None = None) -> dict:
    """Ask the deal manager to look at one field again before approving, and say why.

    Use it when the documents disagree with the value, with each other, or with a later
    amendment. Give the document, page and clause to look at when you can. The value is
    not changed and approval is not held up: the deal manager decides what to do.
    """

    def point(conn):
        points.raise_point(conn, deal_id, field_id, reason, source.model_dump() if source else None, actor="Checking agent (MCP)")
        return deals.get_deal(conn, deal_id)

    return _run(point)


def _require_token(app):
    """Every MCP request must carry the shared token. Without one configured, MCP is closed."""

    async def guarded(scope, receive, send):
        if scope["type"] == "http":
            given = dict(scope["headers"]).get(b"authorization", b"").decode()
            expected = f"Bearer {config.MCP_TOKEN}"
            if not config.MCP_TOKEN or not hmac.compare_digest(given, expected):
                response = JSONResponse({"detail": "A valid Authorization: Bearer token is required."}, status_code=401)
                return await response(scope, receive, send)
        await app(scope, receive, send)

    return guarded


# Stateless JSON responses: each tool call is one ordinary HTTP request, which suits several app instances.
http_app = _require_token(server.streamable_http_app(streamable_http_path="/", stateless_http=True, json_response=True))
