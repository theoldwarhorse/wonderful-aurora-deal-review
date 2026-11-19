# Sample data

Three fictional loan deals provide eleven PDFs, mock extractions, and answer keys for the review workflow. They cover a deal awaiting review, one in progress, and one already approved.

## The deals

| Deal | Facility | PDFs | Document style | Demonstrates |
|---|---|---|---|---|
| [Project Halyard](deals/halyard/README.md) | USD 250m term loan, English law | 5 | Classic: serif text, clauses 1, 2, 3 | Missing values, an overlooked amendment, and a sample checking-agent point |
| [Project Marlow](deals/marlow/README.md) | GBP 85m term loan, English law | 4 | Modern: sans-serif text, clauses 3.1, 3.2 | Two incorrect values, with one correction already saved |
| [Project Tern](deals/tern/README.md) | USD 120m term loan, New York law | 2 | US: letter paper, Section 3.01 | A completed review with one corrected value |

Each deal's README lists its documents and planted extraction issues. Different document styles make the packs more representative of material from different sources.

## Files and folders

| Path | Contents |
|---|---|
| `deals/` | One folder per deal: `halyard/`, `marlow/`, and `tern/` |
| `fields.json` | The initial 42 fields requested from the extraction service |
| `generator/` | The generator and shared LaTeX styles |

Each deal folder contains:

| Path | Contents |
|---|---|
| `definition.mjs` | Handwritten values, document layout, extraction mistakes, and optional checking points |
| `README.md` | Generated overview, document links, and answer key |
| `deal.json` | Generated mock extraction and sample review data loaded by the app |
| `documents/` | Generated PDFs |
| `latex/` | Generated LaTeX source for each PDF |

Edit a deal's `definition.mjs` to change its content. The generator writes the other files; shared styles and README wording are maintained in `generator/`.

## Generation

The generator reads each definition, writes its clauses in the chosen LaTeX style, and typesets the PDFs with [Tectonic](https://tectonic-typesetting.github.io/). It then writes the mock extraction and answer key using the same clause locations.

Page breaks are explicit. Generation stops if a PDF's page count differs from its definition, helping keep source references aligned with the documents.

To regenerate from the repository root:

```sh
node sample-data/generator/build.mjs
```

This requires `tectonic` and `pdfinfo` from Poppler. The generated files are committed, so these tools are not needed to run the app.

## Limitations

- Documents are one to seven pages long, usually with one field per clause. Real agreements can span hundreds of pages and combine several terms in one clause.
- All three deals are term loans and use the same field list.
- Extraction mistakes are deliberately planted, not produced by a model.
- Marlow and Tern include sample review history. Tern is marked as delivered, but no message was actually sent for it.
- Halyard's checking-agent point is handwritten sample data. No checking agent runs as part of the demo.
