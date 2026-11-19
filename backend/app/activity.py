"""What the tool can report about its own use, from data it already keeps."""

from collections import Counter

from . import deals, review
from .db import Connection


def overview(conn: Connection) -> dict:
    every_deal = deals.load_all(conn)
    approved = [d for d in every_deal if d["status"] == "approved"]

    # On approved deals the review is finished, so the split shows how much of the extraction stood.
    outcome: Counter[str] = Counter()
    for deal in approved:
        for state in (review.EXTRACTED, review.EDITED, review.NOT_IN_DOCUMENTS):
            outcome[state] += deal["summary"][state]
        # A changed value was either wrong, or missing and filled in. The two say different things about the agent.
        for field in deal["fields"]:
            if field["state"] == review.EDITED:
                outcome["filled" if field["extractedValue"] is None else "corrected"] += 1

    # Where reviewers most often overrule the agent, across every deal.
    changed: Counter[tuple[str, str]] = Counter()
    for deal in every_deal:
        for field in deal["fields"]:
            if field["state"] in (review.EDITED, review.NOT_IN_DOCUMENTS):
                changed[(field["id"], field["label"])] += 1

    statuses = Counter(d["status"] for d in every_deal)
    return {
        # Every count is always present, zero included, so the screen never has to guess.
        "deals": {"total": len(every_deal), **{s: statuses[s] for s in ("to-review", "in-review", "approved")}},
        "approvedValues": {
            "total": sum(outcome[s] for s in (review.EXTRACTED, review.EDITED, review.NOT_IN_DOCUMENTS)),
            **{s: outcome[s] for s in (review.EXTRACTED, review.EDITED, review.NOT_IN_DOCUMENTS, "corrected", "filled")},
        },
        "mostChanged": [{"id": i, "label": label, "deals": n} for (i, label), n in changed.most_common(8)],
        "coverage": _coverage(conn, every_deal),
        "recent": _recent(conn),
    }


def _coverage(conn: Connection, every_deal: list[dict]) -> list[dict]:
    """For each deal, how much of it was opened before approval, and how long the review took.

    Opening is all that is measured. It shows what was looked at, not that it was read.
    """
    looked = {
        r["deal_id"]: r
        for r in conn.execute(
            """SELECT e.deal_id,
                      MIN(e.at) FILTER (WHERE e.event = 'deal-opened') AS first_opened,
                      COUNT(DISTINCT e.document_id) FILTER (WHERE e.event = 'document-viewed') AS documents_viewed
               FROM usage_events e JOIN deals d ON d.id = e.deal_id
               WHERE d.approved_at IS NULL OR e.at <= d.approved_at   -- what happened after approval is not part of the review
               GROUP BY e.deal_id"""
        )
    }
    coverage = []
    for deal in every_deal:
        seen = looked.get(deal["id"])
        first_opened = seen["first_opened"] if seen else None
        approved_at = deal["approved"]["at"] if deal["approved"] else None
        coverage.append(
            {
                "id": deal["id"],
                "name": deal["name"],
                "status": deal["status"],
                "fieldsOpened": deal["fieldsOpened"],
                "fieldsTotal": deal["summary"]["total"],
                "documentsViewed": seen["documents_viewed"] if seen else 0,
                "documentsTotal": len(deal["documents"]),
                "valuesChanged": deal["summary"][review.EDITED] + deal["summary"][review.NOT_IN_DOCUMENTS],
                "firstOpened": first_opened,
                # How long the deal sat before anyone opened it.
                "minutesWaiting": max(0, round((first_opened - deal["receivedAt"]).total_seconds() / 60)) if first_opened else None,
                "minutesToApprove": round((approved_at - first_opened).total_seconds() / 60) if approved_at and first_opened else None,
            }
        )
    return coverage


def _recent(conn: Connection, limit: int = 50) -> list[dict]:
    rows = conn.execute(
        """SELECT a.action, a.actor, a.at, a.old_value, a.new_value, a.deal_id, d.name AS deal_name, a.field_id, f.label AS field_label
           FROM audit_log a
           LEFT JOIN deals d ON d.id = a.deal_id
           LEFT JOIN field_definitions f ON f.id = a.field_id
           ORDER BY a.id DESC LIMIT %s""",
        (limit,),
    ).fetchall()
    return [
        {
            "action": r["action"],
            "actor": r["actor"],
            "at": r["at"],
            "dealId": r["deal_id"],
            "dealName": r["deal_name"],
            "fieldLabel": r["field_label"] or r["field_id"],
            "oldValue": r["old_value"],
            "newValue": r["new_value"],
        }
        for r in rows
    ]
