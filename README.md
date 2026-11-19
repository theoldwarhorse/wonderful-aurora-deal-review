# Aurora Bank: Deal Review

A prototype for reviewing AI-extracted loan details against their source PDFs. Deal managers can check the evidence, correct values, and approve a deal before its details are sent downstream.

Built by Brian de Klerk for the Wonderful take-home exercise. All sample deals and documents are fictional.

## Run the app

Start Docker, then run this command from the repository root:

```sh
docker compose up -d --wait
```

Open [localhost:8080](http://localhost:8080). The first run builds the application and loads three sample deals. The demo uses ports **8080** and **8081**.

To stop the app and keep your data, run `docker compose down`. To stop it and delete its stored data, run `docker compose down -v`.

## Try the review workflow

1. **Open Project Halyard.** Its five PDFs appear on the left and 42 extracted fields on the right.
2. **Select Final maturity date.** The original agreement says **14 March 2029**. A sample checking-agent point marks the field **Check again** because an amendment changed it.
3. **Open the amendment from the point's source link.** It changes the date to **14 March 2030**. Enter that date, press Enter to save, then select **Mark as checked**.
4. **Select Needs a value.** Check the documents for the three missing values. Enter each value, or select **Not in the documents** if it is genuinely absent.
5. **Review the remaining fields, then select Approve deal.** Check the summary before confirming. The deal becomes read-only and its values are sent to the mock downstream service.

The [Halyard answer key](sample-data/deals/halyard/README.md) lists every planted extraction issue. **Reset demo** restores the sample deals and removes uploaded deals and saved changes.

## Other features

- **New deal:** upload a document pack. No extraction agent is included, so its fields start empty.
- **How to use:** a short guide for deal managers, available from the Deals page.
- **Admin:** manage field definitions, view activity, and connect an external AI agent for an advisory final check. The agent can raise points for review; its MCP tools cannot edit values or approve deals.

## Run the tests

Backend tests, from the repository root:

```sh
docker compose run --rm --build tests
```

Frontend tests:

```sh
cd frontend
npm install
npm test
```

[CI](.github/workflows/ci.yml) also runs linting, formatting checks, type checks, and the frontend build.

## Find your way around

| Location | Contents |
|---|---|
| [frontend/](frontend/README.md) | React screens, components, and frontend tests |
| [backend/](backend/README.md) | Python API, review rules, database, and backend tests |
| [sample-data/](sample-data/README.md) | Fictional deals, PDFs, answer keys, and generation scripts |
| [The brief](docs/brief.md) | Wonderful's original task |
| [Submission note](docs/assumptions-and-decisions.md) | Assumptions, key decisions, and improvements with more time |
| [Architecture](docs/architecture.md) | Integrations, system behaviour, and known limitations |
