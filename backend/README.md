# Backend

The backend stores deals, enforces review and approval rules, records changes, and sends approved values to the downstream system. The frontend uses its responses to display review status and available actions.

Python 3.12, FastAPI, and Postgres, with plain SQL and no ORM.

## Run the service

The service runs as part of the whole app, from the repository root:

```sh
docker compose up -d --wait
```

Explore and try the HTTP endpoints in the [API documentation](http://localhost:8080/docs).

## Code map

Start with `review.py` for the review rules and `schema.sql` for the data model. The remaining modules handle storage, integrations, and HTTP requests.

| File | Responsibility |
|---|---|
| `review.py` | The review rules, as plain functions with no database: what counts as missing, edited, or approvable |
| `schema.sql` | The nine database tables, each with a comment |
| `main.py` | The HTTP routes. Each one opens a transaction, calls a function below, and returns the deal |
| `deals.py` | Reading a deal: assembling what was extracted, what was changed, and the rules into what the screen shows |
| `reviewing.py` | Changing a value, undoing a change, and approving |
| `intake.py` | How a deal arrives: uploading its documents, and receiving its extraction |
| `fields.py` | The list of fields to extract, and the rules for changing it |
| `outbox.py` | Delivering approved deals to the downstream system |
| `audit.py` | The record of every change |
| `usage.py` | The record of what reviewers opened |
| `activity.py` | The admin report, built from those two records |
| `points.py` | The final check: points an agent asks the deal manager to look at again |
| `mcp_server.py` | The MCP server through which an agent runs that check. It can read deals and raise points, nothing else |
| `seed.py` | Loading the sample deals on first start |
| `schemas.py` | The shapes of what the API accepts |
| `db.py`, `config.py`, `errors.py` | The database connection, the settings, and the three kinds of refusal |

`mock_downstream.py`, beside `app/`, is a stand-in for the system that receives approved deals. It is not part of the product.

## The data

| Table | Contents |
|---|---|
| `deals` | Each deal, when its review started, and its approval. An approved deal also stores its fields exactly as approved |
| `documents` | The PDFs of each deal |
| `field_definitions` | The fields to extract. Changed from the Admin page |
| `extracted_fields` | What the extraction agent returned. Never updated by a review |
| `field_edits` | The reviewer's current change to a field. No row means the extracted value stands |
| `points_to_check` | Points raised by a final check, and when the deal manager marked each as checked |
| `audit_log` | Every change and approval. Only ever added to |
| `usage_events` | What reviewers opened: deals, documents, and fields |
| `outbox` | Messages for the downstream system, and whether each was delivered |

PDF files are stored on disk under `DATA_DIR`; the database stores their metadata.

## Settings

Configure the service through environment variables. The demo values are in `docker-compose.yml`.

| Variable | Purpose | Default behaviour |
|---|---|---|
| `DATABASE_URL` | The Postgres database | A local database named `aurora` |
| `DATA_DIR` | Where the PDFs are kept | `/data` |
| `DOWNSTREAM_URL` | Where approved deals are sent | Nothing is sent, and each delivery shows as failed |
| `EXTRACTION_TOKEN` | The secret the extraction service must send | The extraction endpoint refuses everything |
| `MCP_TOKEN` | The secret AI agents must send | The MCP server refuses everything |
| `REVIEWER_TITLE` | The job title a person's actions are recorded under. There is no sign-in, so nobody is named | "Deal manager" |
| `DEMO_MODE` | `1` allows "Reset demo", which wipes all data, and shows the agents' token on the Admin page | Reset is switched off and the token is never shown |
| `PUBLIC_URL` | The address printed in the log at start-up | `http://localhost:8080` |
| `SEED_DIR` | Where the sample deals are read from | The copy built into the image |

## Tests and checks

From the repository root:

```sh
docker compose run --rm --build tests
```

The suite tests the review rules and exercises the API against a real Postgres database.

The code is linted and formatted with ruff, and type-checked with mypy. These checks run in CI. To run the lint and format checks locally, from `backend/`:

```sh
uvx ruff@0.17.5 check .
uvx ruff@0.17.5 format --check .
```

## Further reading

[docs/architecture.md](../docs/architecture.md) covers how other systems connect to this service, the admin functions, sign-in, and known gaps.
