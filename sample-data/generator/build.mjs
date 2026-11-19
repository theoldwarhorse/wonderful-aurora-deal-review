// Builds each sample deal in ../deals from the definition.mjs in its folder.
//
// For every document it writes a LaTeX file, typesets it to a PDF, and records which
// clause landed on which page. From that it writes the deal's mock extraction (deal.json)
// and its README, which lists what the mock agent got wrong. See ../README.md.
//
// Run with `node sample-data/generator/build.mjs`. Needs tectonic and pdfinfo installed.
// Everything it writes is committed, so this is only needed when a definition changes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // sample-data/
const fields = JSON.parse(readFileSync(join(root, 'fields.json'), 'utf8'));

// A deal is any folder in deals/ that holds a definition.mjs. Adding a deal is adding a folder.
const dealsDir = join(root, 'deals');
const deals = [];
for (const folder of readdirSync(dealsDir).sort()) {
  const definition = join(dealsDir, folder, 'definition.mjs');
  if (existsSync(definition)) deals.push((await import(pathToFileURL(definition))).default);
}

const lower = (s) => s[0].toLowerCase() + s.slice(1);

// How each field reads as a clause: [heading, text given the value].
const CLAUSE = {
  borrower: ['Borrower', (v) => `${v} as borrower (the "Borrower").`],
  borrower_reg_no: ['Company number', (v) => `The Borrower is registered under company number ${v}.`],
  borrower_jurisdiction: ['Status', (v) => `The Borrower is duly incorporated and validly existing under the laws of ${v}.`],
  guarantor: ['Guarantor', (v) => `${v} as guarantor (the "Guarantor"), which irrevocably and unconditionally guarantees to each Finance Party punctual performance by the Borrower of its obligations under the Finance Documents.`],
  arranger: ['Arranger', (v) => `${v} as mandated lead arranger (the "Arranger").`],
  original_lender: ['Original Lender', (v) => `${v} as original lender (the "Original Lender").`],
  facility_agent: ['Agent', (v) => `${v} as agent of the other Finance Parties (the "Agent").`],
  security_agent: ['Security Agent', (v) => `${v} as security trustee for the Secured Parties (the "Security Agent").`],
  facility_type: ['The Facility', (v) => `Subject to the terms of this Agreement, the Lenders make available to the Borrower a ${lower(v)} facility (the "Facility").`],
  facility_amount: ['Total Commitments', (v) => `The aggregate of the Commitments at the date of this Agreement is ${v} (the "Total Commitments").`],
  currency: ['Currency', (v) => `Each Loan shall be denominated in ${v}, and each payment under the Finance Documents shall be made in ${v}.`],
  purpose: ['Purpose', (v) => `The Borrower shall apply all amounts borrowed by it under the Facility towards ${lower(v)}.`],
  ranking: ['Ranking', (v) => `The payment obligations of the Borrower under the Finance Documents rank as ${lower(v)} obligations of the Borrower.`],
  agreement_date: ['Date of Agreement', (v) => `This Agreement is dated ${v}.`],
  availability_end: ['Availability Period', (v) => `The Facility may be utilised during the period from and including the date of this Agreement to and including ${v} (the "Availability Period").`],
  first_repayment_date: ['First Repayment Date', (v) => `The first Repayment Instalment shall fall due on ${v} (the "First Repayment Date").`],
  final_maturity_date: ['Final Maturity Date', (v) => `All amounts outstanding under the Facility shall be repaid in full on ${v} (the "Final Maturity Date").`],
  interest_basis: ['Calculation of interest', (v) => `The rate of interest on each Loan for each Interest Period is a ${lower(v)} rate, being the percentage rate per annum which is the aggregate of the Margin and the Reference Rate.`],
  benchmark: ['Reference Rate', (v) => `"Reference Rate" means ${v} for the relevant Interest Period.`],
  margin: ['Margin', (v) => `"Margin" means ${v}.`],
  benchmark_floor: ['Reference Rate floor', (v) => `If the Reference Rate is less than ${v}, the Reference Rate shall be deemed to be ${v}.`],
  interest_period: ['Interest Periods', (v) => `Each Interest Period shall have a duration of ${lower(v)}.`],
  day_count: ['Day count convention', (v) => `Any interest or fee accruing under a Finance Document accrues from day to day and is calculated on the basis of the actual number of days elapsed and a year of ${v.split('/')[1]} days (${v}).`],
  default_interest: ['Default interest', (v) => `If the Borrower fails to pay any amount on its due date, interest shall accrue on the overdue amount at a rate which is ${v} higher than the rate otherwise payable.`],
  arrangement_fee: ['Arrangement fee', (v) => `The Borrower shall pay to the Arranger an arrangement fee of ${v}.`],
  commitment_fee: ['Commitment fee', (v) => `The Borrower shall pay to the Agent a commitment fee computed at the rate of ${v} on the undrawn Commitments during the Availability Period.`],
  agency_fee: ['Agency fee', (v) => `The Borrower shall pay to the Agent, for its own account, an agency fee of ${v}, payable annually in advance.`],
  prepayment_fee: ['Prepayment fee', (v) => `Any voluntary prepayment made on or before the second anniversary of this Agreement shall be accompanied by a prepayment fee of ${v}.`],
  repayment_profile: ['Repayment', (v) => `The Borrower shall repay the Loans by way of ${lower(v)}.`],
  repayment_frequency: ['Repayment Dates', (v) => `Repayment Instalments shall fall due ${lower(v)}, on each Repayment Date.`],
  instalment_amount: ['Repayment Instalments', (v) => `Each Repayment Instalment shall be in an amount of ${v}.`],
  balloon: ['Final repayment', (v) => `The balance of the Loans, being ${v}, shall be repaid on the Final Maturity Date.`],
  min_prepayment: ['Voluntary prepayment', (v) => `The Borrower may, on not less than five Business Days' prior notice, prepay the whole or any part of a Loan, in a minimum amount of ${v}.`],
  max_leverage: ['Leverage', (v) => `The Borrower shall ensure that the ratio of Total Net Debt to EBITDA in respect of any Relevant Period shall not exceed ${v}.`],
  min_interest_cover: ['Interest cover', (v) => `The Borrower shall ensure that the ratio of EBITDA to Net Finance Charges in respect of any Relevant Period shall not be less than ${v}.`],
  covenant_testing: ['Financial testing', (v) => `The financial covenants shall be tested ${lower(v)}, by reference to each Compliance Certificate delivered to the Agent.`],
  financials_deadline: ['Financial statements', (v) => `The Borrower shall supply to the Agent its audited consolidated financial statements ${lower(v)}.`],
  security: ['Transaction Security', (v) => `The obligations of the Borrower under the Finance Documents shall be secured by ${lower(v)}.`],
  governing_law: ['Governing law', (v) => `This Agreement and any non-contractual obligations arising out of or in connection with it are governed by ${v}.`],
  jurisdiction: ['Jurisdiction', (v) => `The ${lower(v)} have exclusive jurisdiction to settle any dispute arising out of or in connection with this Agreement.`],
  majority_lenders: ['Majority Lenders', (v) => `"Majority Lenders" means a Lender or Lenders whose Commitments aggregate ${lower(v)}.`],
  transfer_consent: ['Transfers by Lenders', (v) => `The consent of the Borrower is ${lower(v)}.`],
};

// Three house styles so the document packs do not look like one template. The look of
// each is a LaTeX file in styles/. Here: how each numbers its clauses, and how a
// clause number is cited in a source reference.
const STYLE = {
  classic: { number: (page, i, n) => `${n}.`, cite: (num) => `cl. ${num.replace(/\.$/, '')}` },
  modern: { number: (page, i) => `${page}.${i}`, cite: (num) => `cl. ${num}` },
  us: { number: (page, i) => `Section ${page}.${String(i).padStart(2, '0')}`, cite: (num) => `s. ${num.replace('Section ', '')}` },
};

// Escape LaTeX's special characters and turn straight quotes into typeset ones.
const tex = (s) => s.replace(/([%&$#_])/g, '\\$1').replace(/"([^"]*)"/g, "``$1''");

// One document as LaTeX. Also records, in `sources`, the page and clause of every field it holds.
function renderDoc(deal, doc, sources) {
  const style = STYLE[deal.style];
  let n = 0;
  const pages = doc.pages.map((items, p) =>
    items
      .map((item, i) => {
        const f = typeof item === 'string' ? item : item.f;
        const [heading, text] = f ? CLAUSE[f] : [];
        const body = item.t ?? text(item.v ?? deal.values[f]);
        const num = style.number(p + 1, i + 1, ++n);
        if (f) (sources[f] ??= []).push({ documentId: doc.id, page: p + 1, clause: style.cite(num) });
        return `\\clause{${tex(num)}}{${tex(item.h ?? heading)}}{%\n${tex(body)}}`;
      })
      .join('\n\n'),
  );
  return `% ${doc.title} (${deal.name}). Synthetic, for demonstration only.
% Generated from ../definition.mjs by sample-data/generator/build.mjs. Edit the definition, not this file.
\\input{../../../generator/styles/${deal.style}}
\\input{../../../generator/styles/shared}
\\footertitle{${tex(doc.title)}}

\\begin{document}

\\doctitle{${tex(doc.title)}}{${tex(deal.name)}}{${tex(deal.values.borrower)}}{${tex(doc.dated)}}

${pages.join('\n\n\\newpage\n\n')}

\\end{document}
`;
}

const TYPE = { agreement: 'Original agreement', schedule: 'Schedule', amendment: 'Amendment', supporting: 'Supporting document' };
const work = mkdtempSync(join(tmpdir(), 'aurora-sample-'));

for (const deal of deals) {
  const texDir = join(dealsDir, deal.id, 'latex');
  const pdfDir = join(dealsDir, deal.id, 'documents');
  mkdirSync(texDir, { recursive: true });
  mkdirSync(pdfDir, { recursive: true });
  const sources = {};

  const documents = deal.docs.map((doc) => {
    writeFileSync(join(texDir, `${doc.id}.tex`), renderDoc(deal, doc, sources));
    // Typeset into a scratch folder so only the PDF is kept, not LaTeX's working files.
    execFileSync('tectonic', ['--outdir', work, `${doc.id}.tex`], { cwd: texDir, stdio: 'pipe' });
    const pdfFile = join(work, `${doc.id}.pdf`);
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdfFile], { encoding: 'utf8' }))[1]);
    if (pages !== doc.pages.length) {
      // Source references are built from the page layout in the definition, so an overflow would make them wrong.
      throw new Error(`${deal.id}/${doc.id}: expected ${doc.pages.length} pages, PDF has ${pages}`);
    }
    writeFileSync(join(pdfDir, `${doc.id}.pdf`), readFileSync(pdfFile));
    const { id, short, title, type, dated } = doc;
    return { id, short, title, type, dated, file: `${doc.id}.pdf` };
  });

  const mistakes = [];
  const extractedFields = fields.map(({ id, label }) => {
    if (!(id in deal.values) || !sources[id]) throw new Error(`${deal.id}: field ${id} is missing a value or a clause`);
    const o = deal.extracted[id] ?? {};
    const value = 'value' in o ? o.value : deal.values[id];
    const found = sources[id].find((s) => s.documentId === (o.doc ?? sources[id][0].documentId));
    const source = value === null ? null : o.noPage ? { documentId: found.documentId } : found;
    const note = value === null ? 'Not extracted' : value !== deal.values[id] ? 'Wrong value' : o.noPage ? 'Correct, but no page reference' : null;
    if (note) mistakes.push(`| ${label} | ${deal.values[id]} | ${value ?? '(empty)'} | ${note} |`);
    return { id, value, confidence: value === null ? null : o.confidence ?? 'high', source };
  });

  // The mock extraction, in the shape the app loads.
  // What a checking agent would point out, each with the clause that prompts it.
  const points = (deal.points ?? []).map(({ field, doc, reason }) => {
    const source = sources[field]?.find((s) => s.documentId === doc);
    if (!source) throw new Error(`${deal.id}: point on ${field} cites ${doc}, which has no clause for it`);
    return { fieldId: field, reason, source };
  });

  const { id, name, receivedAt, seedReview } = deal;
  const facility = `${deal.values.facility_amount} ${lower(deal.values.facility_type)}`;
  const json = {
    id, name,
    receivedAt: `${receivedAt}T12:00:00Z`, // noon UTC shows as the same day in every timezone
    borrower: deal.values.borrower,
    facility,
    documents,
    fields: extractedFields,
    ...(points.length && { points }),
    ...(seedReview && { seedReview }),
  };
  writeFileSync(join(dealsDir, deal.id, 'deal.json'), JSON.stringify(json, null, 2) + '\n');

  // The deal's own README: what it is, its documents, and the answer key.
  const startsAs = seedReview?.approved ? 'Approved' : seedReview ? 'In review' : 'To review';
  writeFileSync(join(dealsDir, deal.id, 'README.md'), `# ${name}

${deal.values.borrower.replace(/\.$/, '')}. ${facility}, ${deal.values.governing_law}. Invented, for demonstration only.

${deal.shows}

Starts as: **${startsAs}**.

## Documents

| Document | Type | Dated | Pages | PDF | LaTeX |
|---|---|---|---|---|---|
${deal.docs.map((d) => `| ${d.title} | ${TYPE[d.type]} | ${d.dated} | ${d.pages.length} | [${d.id}.pdf](documents/${d.id}.pdf) | [${d.id}.tex](latex/${d.id}.tex) |`).join('\n')}

## What the mock agent got wrong

The answer key for this deal. Every other field was extracted correctly.

| Field | Documents say | Agent extracted | Note |
|---|---|---|---|
${mistakes.join('\n')}
${points.length ? `
## What the sample final check points out

Raised as a checking agent would raise them, so the feature can be seen without an agent connected.

| Field | Point | Where to look |
|---|---|---|
${points.map((p) => `| ${fields.find((f) => f.id === p.fieldId).label} | ${p.reason} | ${deal.docs.find((d) => d.id === p.source.documentId).title}, page ${p.source.page}, ${p.source.clause} |`).join('\n')}
` : ''}
Generated from [definition.mjs](definition.mjs). Edit that file and run the generator, not this one.
`);
  console.log(`${name}: ${documents.length} PDFs, ${extractedFields.length} fields, ${mistakes.length} planted ${mistakes.length === 1 ? 'mistake' : 'mistakes'}`);
}

rmSync(work, { recursive: true });
