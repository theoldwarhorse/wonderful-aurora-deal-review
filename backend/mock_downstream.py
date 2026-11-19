"""A stand-in for the system that captures approved deals. Not part of the product.

It accepts what the review API pushes and lets you see it. Run as its own
service so that delivery really crosses a network boundary: stop it, approve a
deal, and the delivery fails; start it and retry, and it goes through.
"""

from datetime import UTC, datetime

from fastapi import FastAPI, Header

app = FastAPI(title="Mock downstream system")
received: dict[str, dict] = {}  # by idempotency key; lost on restart


@app.post("/deals")
def receive(payload: dict, idempotency_key: str = Header()):
    duplicate = idempotency_key in received
    received.setdefault(idempotency_key, {"receivedAt": datetime.now(UTC), "payload": payload})
    return {"accepted": True, "duplicate": duplicate}


@app.get("/received")
def list_received():
    return list(received.values())
