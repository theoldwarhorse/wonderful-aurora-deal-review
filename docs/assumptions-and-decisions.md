# Assumptions and key decisions

This is the short submission note requested in [the brief](brief.md). What I would improve with more time is in the [README](../README.md#what-i-would-improve-with-more-time). The deliverable is a runnable prototype for gathering feedback from deal managers on the review experience.

## Scope

The main workflow is to compare extracted loan details with several source PDFs, correct mistakes, and approve the deal before downstream capture. The interface keeps the reviewer responsible for interpreting the evidence and making the decision.

A working API, database, mock downstream service, administration screens, and an optional agent-checking interface support the demonstration. These go beyond the brief and are secondary to the review UI. The prototype was built with Claude Code and Codex, with ChatGPT used for review.

## Assumptions

These choices would be validated with deal managers:

- **Intake:** deals normally arrive with their PDFs uploaded and extraction complete. The prototype also supports uploads, but does not run extraction itself.
- **Extracted data:** the agent returns an agreed field list, with optional confidence and document, page, and clause references. Missing values and missing source references are supported. The initial 42 fields are an illustrative term-loan schema.
- **Review:** one deal manager works on a wide desktop screen and corrects incorrect or missing values directly. The prototype does not route issues to another team.
- **Completion:** every field must have a value or an explicit **Not in the documents** decision. Approval applies to the whole deal, without requiring a sign-off on every field.
- **Conflicting evidence:** the reviewer decides which document governs a value. The app does not assume that the latest amendment overrides every earlier term.
- **Identity:** there is no sign-in. Human actions are recorded under the title **Deal manager**, rather than attributed to an individual.
- **After approval:** values are sent to one downstream system. The approved deal is final and cannot be reopened in this prototype.

## Key decisions

**Keep comparison easy.** Documents and fields sit side by side. Selecting a field opens its source page when available, and the document pack remains visible so amendments are easy to find. Field rows stay quiet until selected, when their source, confidence, and controls appear.

**Make corrections straightforward.** The selected value is editable in place; Enter saves it. Original extraction values are preserved alongside corrections, and navigation guards protect unsaved changes.

**Keep approval consistent.** The server owns the review rules. Extraction replacement is blocked once review starts. Approval saves a snapshot of the fields and an outbound message in one transaction; delivery can fail and be retried without losing the approval.

**Record actions without overstating them.** Changes and opened items are recorded separately. Opening a field is evidence of an interaction, not proof that its source was read or understood.

**Keep an optional AI check advisory.** An external agent can use MCP to read a deal and raise points for a second look. It cannot supply values, edit them, resolve its own points, or approve through those tools. Points sit beside the reviewed data and are excluded from the downstream message. Unresolved points appear in the approval summary but do not block the reviewer. No checking agent is included; Halyard has one preloaded example. An absence of points is not presented as a successful check.

The prototype uses synthetic data and is not ready for real loan documents. See [Architecture](architecture.md) for integration details and known limitations.
