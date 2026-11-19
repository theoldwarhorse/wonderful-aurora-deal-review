# Assumptions, decisions, and next steps

[The brief](brief.md) asks for a short note on assumptions, key decisions, and what I would improve with more time. This is that note.

## What this is

A prototype of the screen a deal manager uses to review extracted loan details against the source PDFs. That screen is the submission. Behind it is a small working service (a Python API, a database, delivery to a downstream system, an admin page, and a door through which an AI agent can run a final check). It goes beyond the brief on purpose, to show how the screen would sit in a real system, and it is secondary. It was built with agentic coding tools, as the brief invites: Claude Code, Codex, and ChatGPT for review.

## How I read the brief

The brief describes a human in the loop. An AI agent extracts, and a deal manager must review and approve before anything reaches the downstream system. The deal manager is there because the agent can be wrong. So the screen has two jobs: make their check quick, and keep the decision theirs.

Everything here follows from that.

- **The deal manager makes every decision.** Only they can change a value, and only they can approve.
- **The agent's work is never taken on trust.** Each value shows the document, page, and clause it came from, and a correction is kept beside the original.
- **Where AI appears a second time, it advises.** An agent can run a final check on a deal and point at fields worth a second look. It cannot change a value, settle its own point, hold up an approval, or approve.

## Assumptions

Each would be checked with deal managers first.

1. A deal arrives with its PDFs uploaded and extraction finished.
2. The agent returns an agreed list of fields. The 42 here are a plausible set for a term loan, not a bank's schema.
3. For each field the agent can say where it found the value (document, page, clause) and how confident it is. The screen is better with both and works without either.
4. The agent may find nothing for a field.
5. One deal manager reviews a deal. There is no sign-in, so nobody is named: actions are recorded under the job title.
6. Approval is for the whole deal, not field by field.
7. The deal manager corrects what is wrong or missing directly. Nothing goes back to another team.
8. Every field needs a value, or an explicit "Not in the documents", before approval.
9. The deal manager decides which document prevails. The app does not assume the latest amendment wins.
10. Deal managers work on a wide desktop screen.
11. Approval releases the values to one downstream system.
12. An approved deal is final and is not reopened.

## Key decisions

**The review screen**

- **Documents and fields side by side.** Selecting a field opens its source page, so checking a value is one click and a glance.
- **The whole document pack stays visible.** Finding the amendment is the point of the exercise, so documents are never hidden behind a scroll.
- **Quiet by default.** A field shows its label and value. Source, confidence, and actions appear only on the selected field.
- **Correcting is typing.** The selected field's value is an edit box. Type and press Enter; there is no separate edit mode.
- **The extraction is never overwritten.** A correction is stored beside the original, so both are always shown.
- **Unsaved work is never dropped silently.** While a changed value is unsaved, every way of moving on is refused with the same message.

**Behind the screen**

- **The rules live in one place, on the server**, so the screen, the API, and agents cannot disagree.
- **An approved deal is a snapshot.** What the reviewer approved, what the app shows afterwards, and what was sent downstream are the same record.
- **The extraction is locked once review starts**, so a reviewer's work cannot be replaced underneath them.
- **Approval and hand-off are one transaction.** Delivery is a separate step that can fail and be retried.
- **Everything changed or opened is recorded.** The record shows what was opened, not that it was read.

**The final check**

The service has one door for AI agents, an MCP server, and it exists for one task. Before a deal is approved, an agent can read it against its documents and raise points: "check this field again, here is why, here is the page". On Project Halyard a sample point tells the deal manager that an amendment changed the maturity date.

- **A second reader, not a second decider.** Raising a point is the only thing an agent can do through that door. It cannot put a value in, change one, or approve.
- **Advice sits beside the values, never in them.** A point is not part of what is approved and is not sent downstream.
- **A point cannot hold up a deal, and an agent cannot clear one.** Open points are listed in the approval summary and the deal manager decides. There is no way for an agent to say a deal is fine, so silence is never read as assurance.
- **Only the deal manager settles a point.** Raising it and marking it checked are both in the audit trail.
- **The extraction does not come through this door.** The upstream extraction service has its own endpoint, so an agent connected for the check has no way to supply values.

## With more time

1. **Watch deal managers use it.** Whether they work field by field or document by document would shape the layout more than anything else.
2. **Amendment awareness.** Show the original clause and the amending clause together. Today a final check can point at the amendment, but the screen does not show the two clauses side by side.
3. **A real checking agent.** The door, the rules, and the screen for the final check are built, and one sample point is preloaded. No agent ships with this. It should not be the extraction agent asked the same question again, because that agent tends to agree with itself.
4. **Sign-in, roles, and a second approver**, through the bank's own identity system.
5. **Validation.** Typed dates, amounts, and percentages, with checks across fields.
6. **Highlight the source text** on the page, using positions from the agent.
7. **Retry failed deliveries automatically**, with an alert.
8. **Feed corrections back** to improve the extraction agent.

[architecture.md](architecture.md) has the detail, including a table of known gaps.
