"""Tests run against a separate database on the same Postgres server, never the app's own."""

import os
import tempfile

import psycopg
import pytest

server_url = os.environ.get("DATABASE_URL", "postgresql://aurora:aurora@localhost:5432/aurora")
test_url = server_url.rsplit("/", 1)[0] + "/aurora_test"

with psycopg.connect(server_url, autocommit=True) as server:
    if not server.execute("SELECT 1 FROM pg_database WHERE datname = 'aurora_test'").fetchone():
        server.execute("CREATE DATABASE aurora_test")

# Set before the app is imported, because it reads its settings at import time.
os.environ.update(
    DATABASE_URL=test_url,
    DATA_DIR=tempfile.mkdtemp(prefix="aurora-test-"),
    EXTRACTION_TOKEN="test-token",
    MCP_TOKEN="test-mcp-token",
    DOWNSTREAM_URL="",
    DEMO_MODE="1",
)

from fastapi.testclient import TestClient  # noqa: E402

from app import db, seed  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def running_app():
    # Started once: the MCP session manager cannot be restarted within one process.
    # The MCP endpoint only answers to a localhost host header with a port.
    with TestClient(app, base_url="http://localhost:8080") as test_client:
        yield test_client


@pytest.fixture()
def client(running_app):
    """A client on freshly seeded data."""
    with db.connect() as conn:
        seed.reset(conn)
    return running_app
