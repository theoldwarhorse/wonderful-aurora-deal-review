# Project Halyard

Kestrel Renewables Holdings Ltd. USD 250,000,000 term loan, English law. All names and documents are fictional.

Not everything was found. Three fields the agent missed, a maturity date changed by an amendment the agent did not apply, swapped digits in a fee, and a source with no page.

Initial review status: **To review**.

## Documents

| Document | Type | Dated | Pages | PDF | LaTeX |
|---|---|---|---|---|---|
| Facility Agreement | Original agreement | 14 March 2024 | 6 | [facility-agreement.pdf](documents/facility-agreement.pdf) | [facility-agreement.tex](latex/facility-agreement.tex) |
| Schedule 1: Repayment and Fees | Schedule | 14 March 2024 | 2 | [schedule-1.pdf](documents/schedule-1.pdf) | [schedule-1.tex](latex/schedule-1.tex) |
| Schedule 2: Financial Covenants | Schedule | 14 March 2024 | 1 | [schedule-2.pdf](documents/schedule-2.pdf) | [schedule-2.tex](latex/schedule-2.tex) |
| First Amendment Agreement | Amendment | 2 June 2025 | 2 | [amendment-1.pdf](documents/amendment-1.pdf) | [amendment-1.tex](latex/amendment-1.tex) |
| Certificate of Incorporation | Supporting document | 8 January 2019 | 1 | [certificate-of-incorporation.pdf](documents/certificate-of-incorporation.pdf) | [certificate-of-incorporation.tex](latex/certificate-of-incorporation.tex) |

## Deliberate extraction errors

Use this answer key to check corrections during the demo. All other fields match the generated documents.

| Field | Documents say | Agent extracted | Note |
|---|---|---|---|
| Borrower registration number | 11834527 | 11834527 | Correct, but no page reference |
| Guarantor | Kestrel Energy Group plc | (empty) | Not extracted |
| Security agent | Aurora Trustee Company Ltd | (empty) | Not extracted |
| Final maturity date | 14 March 2030 | 14 March 2029 | Wrong value |
| Commitment fee | 0.35% per annum | 0.53% per annum | Wrong value |
| Minimum voluntary prepayment | USD 5,000,000 | (empty) | Not extracted |

## Sample checking-agent point

These points are preloaded sample data. They demonstrate the review workflow without a connected checking agent.

| Field | Point | Where to look |
|---|---|---|
| Final maturity date | The First Amendment Agreement replaces "14 March 2029" with "14 March 2030". The extracted date is the one from the original agreement. | First Amendment Agreement, page 1, cl. 2 |

To change this deal, edit [definition.mjs](definition.mjs) and run the generator. This README is generated and will be overwritten.
