"""Database connection and schema."""

import time
from pathlib import Path

import psycopg
from psycopg.rows import DictRow, dict_row

from . import config

# Every query returns its rows as dictionaries keyed by column name.
type Connection = psycopg.Connection[DictRow]


def connect() -> Connection:
    """Use as `with connect() as conn:`. Commits on success, rolls back on error, then closes.

    shortcut: one connection per request, add a pool (psycopg_pool) under real load.
    """
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


def wait_and_migrate(attempts: int = 30) -> None:
    """Wait for Postgres to accept connections, then create any missing tables."""
    schema = (Path(__file__).parent / "schema.sql").read_text()
    for attempt in range(attempts):
        try:
            with connect() as conn:
                conn.execute(schema)
            return
        except psycopg.OperationalError:
            if attempt == attempts - 1:
                raise
            time.sleep(1)
