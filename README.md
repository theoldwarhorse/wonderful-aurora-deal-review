# Aurora Bank: Deal Review

A workspace where a deal manager checks the loan details an AI agent extracted from a deal's PDFs, corrects them, and approves the deal.

The brief puts a person between an AI agent and the downstream system, and this is that person's screen. Every value shows where it came from, the deal manager corrects what is wrong, and only they can approve. An AI agent can also run a final check and point at fields worth a second look, but it cannot change or approve anything.

Author: Brian de Klerk. Take-home exercise for Wonderful. The task is in [docs/brief.md](docs/brief.md).

## Run it

Needs Docker, running. Nothing else.

```
docker compose up -d --wait && open http://localhost:8080
```

That builds everything, starts it, and opens the app. The first run takes a minute or two. On Linux or Windows, leave off the `open` part and visit the address yourself.

It uses ports 8080 and 8081. `docker compose down -v` stops it and deletes its data.

## A five-minute tour

1. **Open Project Halyard.** Its five documents are listed above the page; the 42 extracted fields are on the right.
2. **Select "Final maturity date".** The Facility Agreement opens at the clause it was read from: 14 March 2029. The field is marked **Check again**: a sample final check by an AI agent says an amendment changed the date.
3. **Follow the point's link to the First Amendment Agreement.** The date was extended to 14 March 2030. Type the new date into the field, press Enter, and choose **Mark as checked**.
4. **Press "Needs a value".** Three fields the agent missed. Find each in the documents and add it, or mark it **Not in the documents**.
5. **Approve deal.** A summary lists every change before you confirm. The deal becomes read-only and is sent to a stand-in downstream system.

Every mistake planted in this deal is listed in [sample-data/deals/halyard/README.md](sample-data/deals/halyard/README.md). **Reset demo** on the Deals page restores the starting state.

## Also in the app

- **Admin**, in the header. Change the list of fields the agent is asked to extract, see how the tool is being used and how long reviews take, and connect an AI agent, over MCP, to run a final check on a deal.
- **New deal**, on the Deals page. Name a deal and upload its PDFs.
- **How to use**, at the foot of the Deals page. A four-step guide for a deal manager.

## Tests

```
docker compose run --rm --build tests    # backend
cd frontend && npm install && npm test   # frontend
```

GitHub runs both on every push, along with the linters, a type check, and a build. The steps are in `.github/workflows/ci.yml`.

## Where things are

Each folder has its own README.

| Folder | Holds |
|---|---|
| [frontend/](frontend/README.md) | The review screen (React, TypeScript) |
| [backend/](backend/README.md) | The review service: the rules, the data, and the API (Python, Postgres) |
| [sample-data/](sample-data/README.md) | Three invented deals, and how their documents were generated |
| `docs/` | The three documents below |

## Read next

- [docs/brief.md](docs/brief.md): the task as it was set.
- [docs/assumptions-and-decisions.md](docs/assumptions-and-decisions.md): the short note the brief asks for. Assumptions, key decisions, and what I would improve.
- [docs/architecture.md](docs/architecture.md): how the parts fit together, how other systems connect, and known gaps.
