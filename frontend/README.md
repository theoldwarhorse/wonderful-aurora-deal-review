# Frontend

The frontend lets a deal manager compare extracted fields with the original PDFs, correct values, and approve a deal.

Built with React, TypeScript, and Vite. It manages display state and unsaved edits; the backend supplies the data and enforces review and approval rules.

## Run the app

The frontend is built into the app's image and served by the backend, so the usual way to run it is from the repository root:

```sh
docker compose up -d --wait
```

To work on it with live reload, start the app as above, then in this folder:

```sh
npm install
npm run dev
```

That serves the frontend on its own port and passes its `/api` and `/mcp` calls to the running backend.

## Code map

| File | Responsibility |
|---|---|
| `main.tsx` | Starts the app |
| `App.tsx` | Chooses the screen from the address |
| `api.ts` | The only file that calls the backend, and the shapes of the data it returns |
| `useLoad.ts` | Loads the data a screen needs |
| `navigation.ts` | Moving between screens, and refusing to leave one with unsaved work |
| `format.ts` | Date formatting |
| `styles.css` | All the styling. Every colour is a named value at the top |
| `components/` | The screens and their parts, below |

| Component | Responsibility |
|---|---|
| `AppHeader` | The bar across the top: the bank's name, the two sections, and the user's role |
| `DealsPage` | The list of deals, with search and a status filter |
| `NewDealDialog` | The form for a new deal and its PDFs |
| `ReviewWorkspace` | The review screen. It lays out the two halves below |
| `DocumentViewer` | The left half: the document tabs, and the PDF with all its pages one under the other |
| `FieldPanel` | The right half: the filter, the list of fields, and the approve button |
| `FieldRow` | One field: its value, and when selected an edit box, its source, and any point from a final check |
| `ConfirmDialog` | The summary shown before approval |
| `Admin`, `AdminFields`, `AdminActivity`, `AdminAgents` | The Admin page and its three tabs |
| `FieldDialog` | Adds a field, or changes the name and group of one |
| `StatusBadge`, `ErrorBoundary` | The status label, and the fallback if something fails |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Runs the frontend with live reload |
| `npm test` | Runs the tests |
| `npm run format` | Formats the code with Prettier |
| `npm run format:check` | Checks formatting without changing files |
| `npm run build` | Type-checks, then builds |

## Tests

The tests cover behaviours that could lose work or mislead a reviewer:

- an unsaved correction blocks every way of leaving the deal;
- the approval summary behaves correctly when a request fails;
- a point from a final check is shown as advice, on the field and again before approval;
- the document tabs work from the keyboard;
- the deals page narrows its list by search and by status.

The rest of the screen was checked by hand. An automated accessibility scan (axe) reported no violations on any screen before the Admin tabs and the final check were reworked; those have not been scanned since. There is no test that drives the whole app in a real browser.

## Further reading

[docs/architecture.md](../docs/architecture.md) covers the service behind the screen and known gaps.
