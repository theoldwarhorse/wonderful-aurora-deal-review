"""Pushing approved deals to the downstream system.

An approval writes its message to the `outbox` table in the same transaction.
Delivery is a separate step that can fail and be retried without touching the
approval. The receiver gets an Idempotency-Key, so a repeat is safe.

shortcut: delivery is attempted once after approval and again on a manual retry.
A real deployment needs a worker that retries pending messages on a schedule.
"""

import uuid

import httpx

from . import config, db


def deliver(message_id: uuid.UUID) -> None:
    with db.connect() as conn:
        # SKIP LOCKED: if another instance is already sending this message, leave it alone.
        message = conn.execute(
            "SELECT payload FROM outbox WHERE id = %s AND status <> 'delivered' FOR UPDATE SKIP LOCKED", (message_id,)
        ).fetchone()
        if not message:
            return

        error: str | None = None
        if not config.DOWNSTREAM_URL:
            error = "No downstream system is configured."
        else:
            try:
                response = httpx.post(
                    config.DOWNSTREAM_URL, json=message["payload"], headers={"Idempotency-Key": str(message_id)}, timeout=5
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as failure:
                error = f"The downstream system answered {failure.response.status_code}."
            except httpx.HTTPError:
                error = "The downstream system could not be reached."

        conn.execute(
            """UPDATE outbox SET attempts = attempts + 1, last_error = %s,
                   status = CASE WHEN %s::text IS NULL THEN 'delivered' ELSE 'failed' END,
                   delivered_at = CASE WHEN %s::text IS NULL THEN now() END
               WHERE id = %s""",
            (error, error, error, message_id),
        )


def deliver_for_deal(deal_id: str) -> None:
    with db.connect() as conn:
        message = conn.execute("SELECT id FROM outbox WHERE deal_id = %s", (deal_id,)).fetchone()
    if message:
        deliver(message["id"])
