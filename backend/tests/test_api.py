"""The API end to end, against Postgres."""

import json

import httpx

from app import outbox

MISSING_IN_HALYARD = ["guarantor", "security_agent", "min_prepayment"]


def field(deal: dict, field_id: str) -> dict:
    return next(f for f in deal["fields"] if f["id"] == field_id)


def fill_missing(client) -> None:
    for field_id in MISSING_IN_HALYARD:
        client.put(f"/api/deals/halyard/fields/{field_id}", json={"notInDocuments": True})


def test_the_sample_deals_cover_every_status(client):
    statuses = {d["id"]: d["status"] for d in client.get("/api/deals").json()}
    assert statuses == {"halyard": "to-review", "marlow": "in-review", "tern": "approved"}


def test_an_edit_keeps_the_extracted_value_and_can_be_undone(client):
    url = "/api/deals/halyard/fields/final_maturity_date"
    edited = field(client.put(url, json={"value": " 14 March 2030 "}).json(), "final_maturity_date")
    assert (edited["value"], edited["extractedValue"], edited["state"]) == ("14 March 2030", "14 March 2029", "edited")

    undone = field(client.delete(url + "/edit").json(), "final_maturity_date")
    assert (undone["value"], undone["state"]) == ("14 March 2029", "extracted")


def test_an_empty_value_is_refused(client):
    assert client.put("/api/deals/halyard/fields/margin", json={"value": "  "}).status_code == 422


def test_approval_is_refused_while_a_field_has_no_value(client):
    response = client.post("/api/deals/halyard/approval")
    assert response.status_code == 409
    assert "3 fields need a value" in response.json()["detail"]
    assert client.get("/api/deals/halyard").json()["approved"] is None


def test_approval_queues_a_message_and_survives_a_failed_delivery(client):
    fill_missing(client)
    deal = client.post("/api/deals/halyard/approval").json()

    # No downstream system is configured in tests, so delivery fails. The approval stands.
    assert deal["status"] == "approved"
    assert deal["delivery"]["status"] == "failed"

    sent = client.get("/api/deals/halyard/export").json()
    assert sent["schema"] == "aurora.deal-approved.v1"
    assert {f["id"]: f["origin"] for f in sent["fields"]}["guarantor"] == "not-in-documents"


def test_a_failed_delivery_can_be_retried(client, monkeypatch):
    fill_missing(client)
    client.post("/api/deals/halyard/approval")

    calls = []

    def accept(url, json, headers, timeout):
        calls.append(headers["Idempotency-Key"])
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(outbox.config, "DOWNSTREAM_URL", "http://downstream.test/deals")
    monkeypatch.setattr(outbox.httpx, "post", accept)

    assert client.post("/api/deals/halyard/delivery").json()["delivery"]["status"] == "delivered"
    client.post("/api/deals/halyard/delivery")  # already delivered: nothing is sent twice
    assert len(calls) == 1


def test_an_approved_deal_cannot_be_changed(client):
    response = client.put("/api/deals/tern/fields/margin", json={"value": "9%"})
    assert response.status_code == 409


def test_every_change_is_recorded(client):
    client.put("/api/deals/halyard/fields/margin", json={"value": "1.90% per annum"})
    last = client.get("/api/deals/halyard/audit").json()[-1]
    assert (last["action"], last["fieldId"], last["oldValue"], last["newValue"]) == (
        "edited",
        "margin",
        "2.00% per annum",
        "1.90% per annum",
    )


PDF = b"%PDF-1.4 minimal"


def upload(client, content=PDF):
    return client.post(
        "/api/deals",
        data={"name": "Project Test", "borrower": "Test Ltd", "types": ["agreement"]},
        files=[("files", ("Loan Agreement.pdf", content, "application/pdf"))],
    )


def test_an_uploaded_deal_starts_empty_and_serves_its_pdf(client):
    deal = upload(client).json()
    assert deal["awaitingExtraction"] and deal["summary"]["missing"] == deal["summary"]["total"]
    assert deal["documents"][0]["title"] == "Loan Agreement"
    assert client.get(deal["documents"][0]["file"]).content == PDF


def test_a_file_that_is_not_a_pdf_is_refused(client):
    assert upload(client, b"not a pdf").status_code == 422


def test_the_extraction_service_can_deliver_results_until_review_starts(client):
    deal_id = upload(client).json()["id"]
    url = f"/api/deals/{deal_id}/extraction"
    body = {
        "fields": [
            {"id": "borrower", "value": "Test Ltd", "confidence": "high", "source": {"documentId": "doc-1", "page": 1, "clause": "cl. 2"}}
        ]
    }

    assert client.put(url, json=body).status_code == 401
    token = {"X-Extraction-Token": "test-token"}

    deal = client.put(url, json=body, headers=token).json()
    assert not deal["awaitingExtraction"]
    assert field(deal, "borrower")["source"] == {"documentId": "doc-1", "page": 1, "clause": "cl. 2"}
    # A field the service did not return counts as not extracted.
    assert field(deal, "guarantor")["state"] == "missing"

    bad = {"fields": [{"id": "borrower", "value": "x", "source": {"documentId": "no-such-document"}}]}
    assert client.put(url, json=bad, headers=token).status_code == 422

    client.put(f"/api/deals/{deal_id}/fields/margin", json={"value": "2%"})
    assert client.put(url, json=body, headers=token).status_code == 409


def mcp_call(client, tool: str, arguments: dict, token: str = "test-mcp-token", url: str = "/mcp/"):
    return client.post(
        url,
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": arguments}},
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json, text/event-stream"},
    )


def test_the_admin_page_is_told_which_tools_agents_have(client):
    agents = client.get("/api/admin/agents").json()
    assert agents["token"] == "test-mcp-token"  # demo mode; outside it the token is never sent to the page
    assert [tool["name"] for tool in agents["tools"]] == [
        "list_deals",
        "get_deal",
        "list_field_definitions",
        "get_audit_trail",
        "get_downstream_message",
        "raise_point",
    ]
    assert all(tool["description"] for tool in agents["tools"])


def test_agents_can_read_deals_over_mcp_but_need_the_token(client):
    assert mcp_call(client, "list_deals", {}, token="wrong").status_code == 401
    assert mcp_call(client, "list_deals", {}, url="/mcp").status_code == 200  # no trailing slash

    result = mcp_call(client, "get_deal", {"deal_id": "halyard"}).json()["result"]
    assert not result["isError"]
    assert json.loads(result["content"][0]["text"])["summary"]["missing"] == 3


def test_an_agent_is_told_why_a_call_was_refused(client):
    result = mcp_call(client, "get_deal", {"deal_id": "no-such-deal"}).json()["result"]
    assert result["isError"]
    assert "Deal not found." in result["content"][0]["text"]


# ---------------------------------------------------------------- the final check


def test_a_sample_point_shows_what_a_final_check_looks_like(client):
    halyard = client.get("/api/deals/halyard").json()
    [point] = halyard["points"]
    assert (point["fieldId"], point["raisedBy"], point["checkedAt"]) == ("final_maturity_date", "Checking agent (sample)", None)
    assert point["source"] == {"documentId": "amendment-1", "page": 1, "clause": "cl. 2"}
    # A point is advice. It does not start the review or stand in the way of anything.
    assert (halyard["status"], halyard["pointsOpen"]) == ("to-review", 1)


def test_an_agent_can_point_at_a_field_but_the_value_and_the_decision_stay_with_the_deal_manager(client):
    before = client.get("/api/deals/marlow").json()
    point = {
        "deal_id": "marlow",
        "field_id": "margin",
        "reason": "The fee letter quotes a different margin.",
        "source": {"documentId": "fee-letter", "page": 1},
    }

    result = mcp_call(client, "raise_point", point).json()["result"]
    assert not result["isError"]
    mcp_call(client, "raise_point", point)  # the agent runs its check again: nothing is added

    marlow = client.get("/api/deals/marlow").json()
    [raised] = marlow["points"]
    assert (raised["fieldId"], raised["raisedBy"], raised["source"]["documentId"]) == ("margin", "Checking agent (MCP)", "fee-letter")
    assert marlow["fields"] == before["fields"]  # no value moved
    assert (marlow["canApprove"], marlow["status"]) == (before["canApprove"], before["status"])

    # Only the deal manager settles a point, and both steps are on the record.
    checked = client.post(f"/api/deals/marlow/points/{raised['id']}/checked").json()
    assert (checked["pointsOpen"], checked["points"][0]["checkedAt"] is not None) == (0, True)
    assert client.post(f"/api/deals/marlow/points/{raised['id']}/checked").status_code == 404
    assert [(e["action"], e["actor"]) for e in client.get("/api/deals/marlow/audit").json()][-2:] == [
        ("point-raised", "Checking agent (MCP)"),
        ("point-checked", "Deal manager"),
    ]


def test_a_point_does_not_hold_up_approval_and_none_can_be_raised_afterwards(client):
    fill_missing(client)
    approved = client.post("/api/deals/halyard/approval").json()
    assert (approved["status"], approved["pointsOpen"]) == ("approved", 1)  # approved with the sample point still open
    assert "points" not in client.get("/api/deals/halyard/export").json()  # advice is not sent downstream

    late = mcp_call(client, "raise_point", {"deal_id": "halyard", "field_id": "margin", "reason": "Too late."}).json()["result"]
    assert late["isError"] and "approved" in late["content"][0]["text"]


def test_a_point_must_name_a_real_field_a_reason_and_a_document_of_the_deal(client):
    def refused(**change):
        point = {"deal_id": "marlow", "field_id": "margin", "reason": "Look again."} | change
        return mcp_call(client, "raise_point", point).json()["result"]["isError"]

    assert refused(field_id="no_such_field")
    assert refused(reason="   ")
    assert refused(reason="x" * 501)
    assert refused(source={"documentId": "facility-agreement"})  # a Halyard document, not one of Marlow's
    assert client.get("/api/deals/marlow").json()["points"] == []


def test_mcp_offers_no_way_to_edit_or_approve(client):
    listed = client.post(
        "/mcp/",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Authorization": "Bearer test-mcp-token", "Accept": "application/json, text/event-stream"},
    ).json()["result"]["tools"]
    assert {tool["name"] for tool in listed} == {
        "list_deals",
        "get_deal",
        "list_field_definitions",
        "get_audit_trail",
        "get_downstream_message",
        "raise_point",
    }


def test_a_new_field_reaches_open_deals_and_leaves_approved_ones_alone(client):
    assert client.get("/api/deals/marlow").json()["canApprove"]

    added = client.post("/api/admin/fields", json={"label": "Hedging requirement", "group": "Interest"})
    assert added.status_code == 201
    assert "hedging_requirement" in [f["id"] for f in client.get("/api/fields").json()]

    marlow = client.get("/api/deals/marlow").json()
    assert field(marlow, "hedging_requirement")["state"] == "missing"
    assert not marlow["canApprove"]

    tern = client.get("/api/deals/tern").json()
    assert tern["summary"]["total"] == 42
    assert "hedging_requirement" not in [f["id"] for f in tern["fields"]]


def test_a_retired_field_leaves_open_deals_and_can_be_restored_with_its_values(client):
    client.patch("/api/admin/fields/guarantor", json={"active": False})

    halyard = client.get("/api/deals/halyard").json()
    assert "guarantor" not in [f["id"] for f in halyard["fields"]]
    assert halyard["summary"]["missing"] == 2
    assert client.put("/api/deals/halyard/fields/guarantor", json={"value": "x"}).status_code == 404
    # Tern was approved while the field existed, so it still shows it.
    assert field(client.get("/api/deals/tern").json(), "guarantor")["value"] == "Ashby Infrastructure Holdings, LLC"

    client.patch("/api/admin/fields/guarantor", json={"active": True})
    assert field(client.get("/api/deals/marlow").json(), "guarantor")["value"] == "Dunmore Freight (Holdings) Ltd"


def test_a_field_can_be_renamed_but_its_id_is_fixed(client):
    renamed = client.patch("/api/admin/fields/margin", json={"label": "Interest margin"}).json()["fields"]
    assert next(f for f in renamed if f["id"] == "margin")["label"] == "Interest margin"
    assert field(client.get("/api/deals/halyard").json(), "margin")["label"] == "Interest margin"

    assert client.post("/api/admin/fields", json={"label": "Margin", "group": "Interest"}).status_code == 422
    assert client.post("/api/admin/fields", json={"label": "  ", "group": "Interest"}).status_code == 422
    assert client.patch("/api/admin/fields/no_such_field", json={"label": "x"}).status_code == 404


def test_activity_reports_how_the_extraction_held_up(client):
    client.put("/api/deals/halyard/fields/margin", json={"value": "1.90% per annum"})
    client.patch("/api/admin/fields/margin", json={"label": "Interest margin"})
    overview = client.get("/api/admin/activity").json()

    assert overview["deals"] == {"total": 3, "to-review": 0, "in-review": 2, "approved": 1}
    # Tern is the one approved deal: 41 values stood and 1 was corrected.
    assert overview["approvedValues"] == {"total": 42, "extracted": 41, "edited": 1, "not-in-documents": 0, "corrected": 1, "filled": 0}
    assert {"id": "margin", "label": "Interest margin", "deals": 1} in overview["mostChanged"]
    assert [(e["action"], e["fieldLabel"]) for e in overview["recent"][:2]] == [
        ("field-renamed", "Interest margin"),
        ("edited", "Interest margin"),
    ]


def test_actions_are_recorded_under_the_job_title_not_a_persons_name(client):
    assert client.get("/api/me").json()["title"] == "Deal manager"

    client.put("/api/deals/halyard/fields/margin", json={"value": "1.90% per annum"})
    assert client.get("/api/deals/halyard/audit").json()[-1]["actor"] == "Deal manager"
    assert client.get("/api/deals/tern").json()["approved"]["by"] == "Deal manager"


def test_opening_fields_is_tracked_and_counts_each_field_once(client):
    url = "/api/deals/halyard/events"
    assert client.get("/api/deals/halyard").json()["fieldsOpened"] == 0

    assert client.post(url, json={"event": "deal-opened"}).status_code == 204
    for field_id in ("margin", "margin", "final_maturity_date"):
        client.post(url, json={"event": "field-viewed", "fieldId": field_id})
    assert client.get("/api/deals/halyard").json()["fieldsOpened"] == 2

    assert client.post(url, json={"event": "deal-deleted"}).status_code == 422
    assert client.post("/api/deals/no-such-deal/events", json={"event": "deal-opened"}).status_code == 404


def test_what_is_opened_after_approval_does_not_improve_the_record_of_the_review(client):
    fill_missing(client)
    client.post("/api/deals/halyard/events", json={"event": "field-viewed", "fieldId": "margin"})
    client.post("/api/deals/halyard/approval")

    for field_id in ("borrower", "currency", "purpose"):
        client.post("/api/deals/halyard/events", json={"event": "field-viewed", "fieldId": field_id})
    client.post("/api/deals/halyard/events", json={"event": "document-viewed", "documentId": "amendment-1"})

    assert client.get("/api/deals/halyard").json()["fieldsOpened"] == 1
    coverage = {c["id"]: c for c in client.get("/api/admin/activity").json()["coverage"]}
    assert (coverage["halyard"]["fieldsOpened"], coverage["halyard"]["documentsViewed"]) == (1, 0)


def test_activity_reports_what_was_opened_and_changed_on_each_deal(client):
    client.post("/api/deals/halyard/events", json={"event": "deal-opened"})
    client.post("/api/deals/halyard/events", json={"event": "document-viewed", "documentId": "amendment-1"})
    client.post("/api/deals/halyard/events", json={"event": "field-viewed", "fieldId": "margin"})
    client.put("/api/deals/halyard/fields/margin", json={"value": "1.90% per annum"})

    coverage = {c["id"]: c for c in client.get("/api/admin/activity").json()["coverage"]}
    assert (coverage["halyard"]["fieldsOpened"], coverage["halyard"]["documentsViewed"], coverage["halyard"]["valuesChanged"]) == (1, 1, 1)
    # The seeded approved deal had every field opened, 35 minutes before it was approved.
    assert (coverage["tern"]["fieldsOpened"], coverage["tern"]["fieldsTotal"], coverage["tern"]["minutesToApprove"]) == (42, 42, 35)
    # It was received on 12 November and first opened five days, one hour and 57 minutes later.
    assert coverage["tern"]["minutesWaiting"] == 5 * 24 * 60 + 117


# ---------------------------------------------------------------- an approved deal never changes


def approved_record(client, deal_id: str):
    """The approved deal as the app shows it, and as it was sent downstream."""
    shown = [(f["id"], f["label"], f["value"]) for f in client.get(f"/api/deals/{deal_id}").json()["fields"]]
    sent = [(f["id"], f["label"], f["value"]) for f in client.get(f"/api/deals/{deal_id}/export").json()["fields"]]
    return shown, sent


def test_an_approved_deal_is_untouched_by_later_changes_to_the_field_list(client):
    # Retire a field, then approve: the deal is approved with 41 fields.
    client.patch("/api/admin/fields/margin", json={"active": False})
    assert client.post("/api/deals/marlow/approval").json()["summary"]["total"] == 41
    shown, sent = approved_record(client, "marlow")
    assert shown == sent and len(shown) == 41

    # Restore it, rename a field, retire another, add one. None of it reaches the approved deal.
    client.patch("/api/admin/fields/margin", json={"active": True})
    client.patch("/api/admin/fields/borrower", json={"label": "Obligor"})
    client.patch("/api/admin/fields/guarantor", json={"active": False})
    client.post("/api/admin/fields", json={"label": "Hedging requirement", "group": "Interest"})

    assert approved_record(client, "marlow") == (shown, sent)
    assert client.get("/api/deals/marlow").json()["summary"]["total"] == 41

    # An open deal does follow the list: margin is back, guarantor gone, borrower renamed, one new field.
    halyard = client.get("/api/deals/halyard").json()
    assert halyard["summary"]["total"] == 42
    assert field(halyard, "borrower")["label"] == "Obligor"
    assert {"margin", "hedging_requirement"} <= {f["id"] for f in halyard["fields"]}


def test_the_message_says_which_version_of_the_field_list_it_was_built_from(client):
    assert client.get("/api/admin/fields").json()["version"] == 1

    # Marlow is approved against the list as first loaded.
    client.post("/api/deals/marlow/approval")
    assert client.get("/api/deals/marlow/export").json()["fieldListVersion"] == 1

    # Two changes later, the next approval says so. The earlier message does not change.
    client.patch("/api/admin/fields/guarantor", json={"active": False})
    assert client.post("/api/admin/fields", json={"label": "Hedging requirement", "group": "Interest"}).json()["version"] == 3
    client.put("/api/deals/halyard/fields/hedging_requirement", json={"notInDocuments": True})
    for field_id in ("security_agent", "min_prepayment"):
        client.put(f"/api/deals/halyard/fields/{field_id}", json={"notInDocuments": True})
    client.post("/api/deals/halyard/approval")

    sent = client.get("/api/deals/halyard/export").json()
    assert sent["fieldListVersion"] == 3
    assert "guarantor" not in {f["id"] for f in sent["fields"]} and "hedging_requirement" in {f["id"] for f in sent["fields"]}
    assert client.get("/api/deals/marlow/export").json()["fieldListVersion"] == 1

    client.post("/api/reset")
    assert client.get("/api/admin/fields").json()["version"] == 1


# ---------------------------------------------------------------- blank is not a value


def test_a_blank_extracted_value_counts_as_missing_and_blocks_approval(client):
    deal_id = upload(client).json()["id"]
    token = {"X-Extraction-Token": "test-token"}
    every_field = [f["id"] for f in client.get("/api/fields").json()]
    blanks = ["   ", "\t", "\n", " \t\n "]
    body = {"fields": [{"id": field_id, "value": blanks[i % len(blanks)]} for i, field_id in enumerate(every_field)]}

    deal = client.put(f"/api/deals/{deal_id}/extraction", json=body, headers=token).json()
    assert deal["summary"]["missing"] == deal["summary"]["total"] == len(every_field)
    assert client.post(f"/api/deals/{deal_id}/approval").status_code == 409

    padded = {"fields": [{"id": "borrower", "value": "  Test Ltd  "}]}
    assert field(client.put(f"/api/deals/{deal_id}/extraction", json=padded, headers=token).json(), "borrower")["value"] == "Test Ltd"


# ---------------------------------------------------------------- the extraction is locked once review starts

REPLACEMENT = {"fields": [{"id": "borrower", "value": "Someone Else Ltd"}]}
TOKEN = {"X-Extraction-Token": "test-token"}


def test_review_starts_when_a_field_is_opened_even_if_nothing_is_changed(client):
    assert client.get("/api/deals/halyard").json()["status"] == "to-review"
    client.post("/api/deals/halyard/events", json={"event": "deal-opened"})
    assert client.get("/api/deals/halyard").json()["status"] == "to-review"  # opening the deal is not reviewing it

    client.post("/api/deals/halyard/events", json={"event": "field-viewed", "fieldId": "margin"})
    assert client.get("/api/deals/halyard").json()["status"] == "in-review"
    assert client.put("/api/deals/halyard/extraction", json=REPLACEMENT, headers=TOKEN).status_code == 409
    assert client.get("/api/deals/halyard").json()["summary"]["missing"] == 3  # nothing was replaced


def test_undoing_a_change_does_not_reopen_the_deal_to_a_new_extraction(client):
    url = "/api/deals/halyard/fields/margin"
    client.put(url, json={"value": "1.90% per annum"})
    client.delete(url + "/edit")
    assert client.get("/api/deals/halyard").json()["summary"]["edited"] == 0

    assert client.get("/api/deals/halyard").json()["status"] == "in-review"
    assert client.put("/api/deals/halyard/extraction", json=REPLACEMENT, headers=TOKEN).status_code == 409


def test_looking_at_a_deal_that_awaits_its_extraction_does_not_lock_it(client):
    deal_id = upload(client).json()["id"]
    client.post(f"/api/deals/{deal_id}/events", json={"event": "deal-opened"})
    client.post(f"/api/deals/{deal_id}/events", json={"event": "field-viewed", "fieldId": "borrower"})

    assert client.put(f"/api/deals/{deal_id}/extraction", json=REPLACEMENT, headers=TOKEN).status_code == 200
