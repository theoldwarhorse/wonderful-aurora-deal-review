# Sample data

Invented loan deals for demonstrating the app.

## Layout

| Path | Holds |
|---|---|
| `deals/` | The three deals, one folder each: `halyard/`, `marlow/`, `tern/` |
| `fields.json` | The 42 fields an agent is asked to extract |
| `generator/` | The script that builds each deal folder, and the three LaTeX house styles |

Inside each deal folder:

| File | Holds |
|---|---|
| `definition.mjs` | The deal, written by hand: its true values, which clause sits on which page, the agent's mistakes, and any point a final check would raise |
| `README.md` | What the deal shows, its documents, and the answer key |
| `deal.json` | The mock extraction, and any sample points, as the app loads them |
| `documents/` | The PDFs |
| `latex/` | The LaTeX source of each PDF |

Only `definition.mjs` is edited by hand. The generator writes the rest.

## The three deals

| Deal | Facility | PDFs | House style | Shows |
|---|---|---|---|---|
| [Project Halyard](deals/halyard/README.md) | USD 250m term loan, English law | 5 | Classic: serif, clauses 1, 2, 3 | Missed fields, and an amendment the agent did not apply, which a sample final check points out |
| [Project Marlow](deals/marlow/README.md) | GBP 85m term loan, English law | 4 | Modern: sans-serif, clauses 3.1, 3.2 | Every field found, two wrong. Starts in review |
| [Project Tern](deals/tern/README.md) | USD 120m term loan, New York law | 2 | US: letter paper, Section 3.01 | Every field found, one wrong. Starts approved |

Each deal's README lists every mistake planted in its extraction. The house styles differ on purpose, so the packs do not look like one template.

## How a deal is generated

1. **Define it** in `definition.mjs`.
2. **Write the LaTeX.** Each document becomes a title and a list of clauses, in the deal's house style.
3. **Typeset the PDFs** with [tectonic](https://tectonic-typesetting.github.io/). The generator stops if a document's page count differs from its definition.
4. **Write the extraction and the answer key.** The generator placed every clause, so it knows the page and clause of every field.

Because the documents and the extraction come from one definition, a source reference can never point at the wrong page.

To regenerate after editing a definition:

```
node sample-data/generator/build.mjs
```

It needs `tectonic` and `pdfinfo` (from poppler). Everything it writes is committed.

## Limits

- The documents are short, one to seven pages, with one field per clause. A real facility agreement runs to hundreds of pages and buries several terms in one clause.
- All three are term loans, so one field list fits them all.
- The mistakes are planted by hand. They are plausible, not the output of a real model.
- Marlow and Tern start with sample history, so every status is on show. Tern is marked as delivered, but nothing was sent for it.
- Halyard starts with one sample point from a final check. It was written by hand, not raised by an agent.
