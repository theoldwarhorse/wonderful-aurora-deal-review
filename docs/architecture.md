# Architecture

This document explains the system boundaries, integration contracts, administrative features, and known limitations. Start with the [README](../README.md) to run the prototype or the [submission note](assumptions-and-decisions.md) for its assumptions and design decisions.

## How it fits together

```
Document intake -> Extraction service -> Review service -> Downstream system
                                               ^
                                               |
                                  Review screen / Checking agent
                                  (approval)      (advice only)
```

| Part | Responsibility | Implementation |
|---|---|---|
| Document intake | Receives a deal's PDFs | Built as an upload |
| Extraction service | The AI agent: reads the PDFs and returns the fields | Not built. Sample results are preloaded, and the endpoint a real one would call is built |
| Review service | Holds deals, changes, and approvals; applies the rules; records actions under a role or service label | **Built.** Python (FastAPI) with Postgres |
| Review screen | Where the deal manager checks, corrects, and approves | **Built.** React |
| Checking agent | Optional. Before approval, reads a deal against its documents and points at fields worth a second look | Not built. The MCP interface and the screen for its points are built, and one sample point is preloaded |
| Downstream system | Receives the approved values | Not built. A small stand-in service receives them |

The backend computes review counts, statuses, and allowed workflow actions. The frontend manages display state and draft edits. There is no authentication or role-based access control in this prototype.

### Receiving extracted values

`PUT /api/deals/{id}/extraction`, with the header `X-Extraction-Token`. The sample deals are loaded through this same code.

| Per field | Required | Used for | If absent |
|---|---|---|---|
| Field id | Yes | Matching the value to a field in the list from `GET /api/fields` | A field left out is shown as needing a value |
| Value, or empty | No | The value under review | An omitted or empty value needs review before approval. A value of only spaces, tabs, or line breaks counts as empty |
| Confidence: high, medium, or low | No | Shown with the source | Not shown |
| Source document | No | Opening the right document | "No source reference"; the reviewer browses the documents |
| Source page | No | Opening the right page | The document opens at page 1 and the detail says the page was not given |
| Source clause | No | Shown beside the page | Left out |

Confidence and source position are assumptions about what the agent can provide, so each is optional. An extraction can be replaced until review starts, and is refused after that. Review starts when a reviewer first opens a field of an extracted deal, or first changes a value. That moment is stored on the deal and never cleared, so undoing a change does not reopen it. It is also what moves a deal from "To review" to "In review".

To try the endpoint, upload a new deal and take its id from the address bar. Replace `DEAL_ID` and `DOCUMENT_ID` below with the deal id and a document id from its API response. This example supplies only the borrower; the remaining fields will need review:

```sh
curl -X PUT http://localhost:8080/api/deals/DEAL_ID/extraction \
  -H 'X-Extraction-Token: demo-extraction-token' -H 'Content-Type: application/json' \
  -d '{"fields": [{"id": "borrower", "value": "Example Ltd", "confidence": "high", "source": {"documentId": "DOCUMENT_ID", "page": 1}}]}'
```

### Sending approved values

Approving a deal writes the approval and an outbound message in one database transaction, so a deal is never approved without its message. The message is then posted to `DOWNSTREAM_URL` with an `Idempotency-Key`. The receiver must honour that key to prevent duplicate processing; the demo receiver does. If delivery fails, the approval stands and the message can be sent again.

Each field in the message carries its final value, whether it was extracted, edited, or marked not in the documents, the original extracted value, and its source. The message also carries `fieldListVersion`: 1 for the list as first loaded, and one more for every change an administrator has made since. A receiver that sees a new number knows the set of fields may have changed. `GET /api/deals/{id}/export` returns the message.

### Optional checking agent

The optional MCP interface lets a checking agent read a deal and raise advisory points before approval. Each point identifies a field, explains the concern, and can reference a document, page, and clause. This extends the prototype beyond the brief; no checking agent is included.

The MCP tools cannot edit values, resolve points, or approve a deal. These are workflow boundaries, not a substitute for authentication on the wider HTTP API.

| Step | Who | What happens |
|---|---|---|
| 1 | Agent | Reads the deal with `get_deal` and its documents from the `file` address of each |
| 2 | Agent | Calls `raise_point` for a field, with a reason and, if it can, a source |
| 3 | Deal manager | Sees "Check again" on the field, the reason, and a link to the page |
| 4 | Deal manager | Corrects the value or leaves it, and marks the point as checked |
| 5 | Deal manager | Approves. Any point still open is listed in the approval summary |

The checking workflow follows these rules:

| Rule | Why |
|---|---|
| A point never changes a value | The agent advises. A correction is the deal manager's own edit, recorded under their title |
| A point is kept beside the fields, not in them | It is not part of what is approved, and it is not in the message sent downstream |
| An open point does not block approval | Otherwise the agent would be deciding by holding the deal |
| Checking a point is a review-screen action | No MCP tool can resolve a point |
| An agent cannot say a deal is fine | There is no "passed" result. No points raised is not an assurance |
| Duplicate open points are ignored | Repeating the same field and reason does not add another open point. A point can be raised again after the earlier one is checked |
| No point can be raised on an approved deal | An approved deal is final |
| Raising and checking are both in the audit trail | Under "Checking agent (MCP)" and the deal manager's title |

Agents connect to `http://localhost:8080/mcp` with the header `Authorization: Bearer demo-mcp-token`. The **AI agents** tab of the Admin page explains the check and shows a ready command for Claude Code, a button that tests the connection, and the tools below. In demo mode the command includes the token; otherwise the token never reaches the browser.

| Tool | Does |
|---|---|
| `list_deals`, `get_deal` | Read deals, fields, points, and review status |
| `list_field_definitions` | The fields to extract today |
| `get_audit_trail` | Every recorded change to a deal |
| `get_downstream_message` | What was sent for an approved deal |
| `raise_point` | Ask the deal manager to look at one field again, with a reason and a source |

There is deliberately no tool to supply or edit a value, mark a point as checked, or approve a deal. The extraction arrives by its own endpoint, described above, and requires a separate extraction token.

The sample point on Project Halyard is preloaded through the same code a real agent's point goes through, under the name "Checking agent (sample)", so the check can be seen without an agent connected.

## The admin section

The Admin page, linked from the header, has three parts.

**Fields.** The list of fields to extract lives in the database, because the starting 42 are our guess. An administrator can add a field, rename it, move it to another group, or retire it. Three rules preserve field references and approved records:

| Rule | Why |
|---|---|
| A field's id never changes | It is the key the extraction service sends, and the key every stored value hangs on |
| A field is retired, never deleted | Values already extracted are kept, and the field can be restored with them |
| An approved deal is a snapshot | When a deal is approved, its fields are stored exactly as approved: ids, labels, groups, values. From then on the deal is read from that snapshot and never rebuilt from the field list, so renaming, retiring, restoring, or adding a field cannot change it. The message sent downstream is built from the same snapshot |

A change takes effect on open deals at once. Add a field, and every deal still in review needs a value for it before it can be approved. The extraction service reads the current list from `GET /api/fields`, and the review screen needed no change, because it already draws whatever fields the service returns.

The field list can now differ from the file it started from (`sample-data/fields.json`), and from what other systems expect. Where that matters:

| Affected area | Effect of a field-list change | Handling |
|---|---|---|
| Approved deals | Nothing. They are read from their snapshot | Preserved |
| Open deals | A new field needs a value; a retired field disappears | Reflected in the review requirements |
| An extraction service that reads `GET /api/fields` | It extracts the new list | Preserved |
| An extraction service with its own fixed list | It does not send a new field, and may send a retired one | The new field shows as needing a value, and the retired one is stored but hidden |
| The downstream system | The message gains or loses a field | Detectable: every message carries `fieldListVersion`, which goes up by one with each change to the list. Agreeing the change beforehand is still a matter of process. See known gaps |
| `sample-data/fields.json` | It is only read on first start and on "Reset demo" | A new environment, or a reset, starts from the original 42 again |

**AI agents.** How to connect an agent for the final check, a button that tests the connection, and what a connected agent can do. See “Optional checking agent” above for the workflow and tool restrictions.

**Activity.** The service keeps two records, and this page reads them back.

| Record | Holds | Written when |
|---|---|---|
| Audit log | Every change: values edited, fields marked not in the documents, points raised by a final check and marked as checked, approvals, changes to the field list | With the change itself, in the same transaction |
| Usage events | What was opened: deals, documents, and the details of individual fields | As the reviewer works |

From those it reports:

- **Time.** For each deal, how long it waited between being received and first being opened, and how long its review took from first opening to approval, with the averages across deals.
- **How the extraction held up.** On approved deals, how many extracted values were accepted, corrected, filled in, or marked not in the documents, and which fields are changed most often in review.
- **What was opened on each deal.** Fields opened, documents opened, and values changed.
- **The audit log.** The last 50 entries, each with a time, who acted, and the value before and after.

What these counts do and do not mean:

- Review time is elapsed time, from first opening a deal to approving it. It is not time spent working, so a deal left open over lunch counts the lunch.
- The sample deals' received dates are invented, so their waiting times are illustrative.
- A field counts as opened when it is selected. This records an interaction, not evidence that the value or its source was read. A field with no source reference still counts.
- For an approved deal, only what was opened up to the approval counts. Looking afterwards cannot improve the record of the review.
- The same count is shown at approval ("12 of 42 fields were opened during this review"). It informs and does not block.
- Nobody is named. There is no sign-in, so everything a person does is recorded under one job title, "Deal manager". The record tells a deal manager's actions apart from the extraction service's, but not one deal manager from another.
- The sample deals come with sample history. Project Tern shows as approved and delivered; nothing was actually sent for it, so it does not appear in the stand-in downstream system.

Recording what staff open is also something a bank would need to disclose and govern.

## Future identity and access control

There is no sign-in in this prototype. A bank would not want this tool to keep its own passwords; it would plug into the identity system the bank already runs.

| Need | How it would be met |
|---|---|
| Staff sign in once, with their bank account | The app becomes a client of the bank's identity provider (for example Microsoft Entra ID, Okta, or Ping) using OpenID Connect. The API accepts only requests carrying a valid token from it |
| Different people may do different things | Roles come from the directory groups in that token: deal manager, approver, administrator. The API checks the role on each call; today's `/api/admin` routes would require administrator |
| The audit trail identifies a person | Replace the shared `REVIEWER_TITLE` label with a verified user identity. Confirm the audit schema and identity retention requirements during implementation |
| One person prepares, another approves | With real identities the service can refuse an approval from the person who made the edits |
| Other systems connect securely | The extraction service and AI agents use shared tokens today. They would use service accounts from the same identity provider. The MCP library used here already supports checking such tokens |
| Leavers lose access | Integrate account removal with session expiry and token revocation policies; directory removal alone does not invalidate every issued token immediately |

## Where things are

Each folder has a README that maps its files:

- [backend/README.md](../backend/README.md): the service's modules, its tables, its settings, and its tests.
- [frontend/README.md](../frontend/README.md): the screens, the components, and the frontend tests.
- [sample-data/README.md](../sample-data/README.md): the three sample deals and how they were generated.

`docker-compose.yml` and `Dockerfile` at the root say how it is built and run. `.github/workflows/ci.yml` runs the linters, the type check, the tests, and a build on every push.

## Known gaps

This prototype is suitable for demonstrations and feedback using synthetic data. The following work is needed before handling real loan documents.

| Gap | Why it matters |
|---|---|
| No sign-in or roles | Anyone who can reach the address can read, approve, and change the field list. Every action is recorded under one job title, so the audit trail cannot say which person acted. See “Future identity and access control” above |
| No second approver | One person can prepare and approve |
| No checking agent ships | The prototype includes the MCP interface, workflow rules, and UI only. The one point on show is a preloaded sample. A real agent would need its own evaluation before a deal manager should give its points any weight |
| A checking agent can be wrong, or silent | A point can send a deal manager to a clause that says nothing new, and a missed problem raises nothing. The screen never presents the absence of points as a result, but people may still read it that way |
| Shared tokens for the extraction and MCP endpoints | Demo defaults in the Compose file, overridable by environment variable, with no rotation or per-client identity |
| Demo mode is on | `DEMO_MODE=1` enables "Reset demo", which wipes all data, and shows the agents' token on the Admin page. Turn it off anywhere real |
| Delivery is not retried automatically | A failed push waits for someone to choose "Send again" |
| Two people on one deal | Writes are serialised, but the screen does not show another reviewer's changes until it reloads |
| No date or amount validation | Values are free text, so a malformed date or amount can be approved and sent |
| No correction after approval | A mistake cannot be fixed or re-sent through the tool |
| Field-list changes are announced, not agreed | Each message carries the version of the field list it was built from, so the downstream system can tell. But nothing stops an administrator changing the list before the downstream owner is ready. Changes also stay in one environment's database: nothing carries them to another, and "Reset demo" discards them |
| Uploads are lightly checked | A size limit and a PDF signature check, no malware scan |
| PDFs are on a disk volume | The database can serve several app instances; the files cannot |
| No migrations, monitoring, or backups | The tables are created on first start |
| Few frontend tests | The rules and the API are tested against Postgres. On the frontend five behaviours are tested: unsaved changes on leaving, approval failures, how a point from a final check is shown, keyboard use of the document tabs, and searching the deals. The rest was checked by hand. An automated accessibility scan (axe) reported no violations before the Admin tabs and the final check were reworked; those have not been scanned since |
| Every page of a PDF is drawn at once | That is what lets a document scroll from start to end and be searched with the browser's find. It suits documents of tens of pages; an agreement of several hundred would be slow and would need only the pages near the view drawn |
| Built for a wide screen | Below 900px the fields stack under the document, which is cramped on a short window |
| No TLS | Meant to sit behind a proxy that provides it |
