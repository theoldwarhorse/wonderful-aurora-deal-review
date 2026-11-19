// The definition of this deal. The only file in this folder edited by hand: the generator
// writes everything else from it (see ../../README.md).
//
// `values` is what the documents say (the truth). `extracted` lists only where the mock
// agent's output differs from the truth. Each page of a document is a list of items: a
// field id, { f, v } to print a different value (for example a term later amended), or
// { h, t } for a clause holding no field.
import { FILLER } from '../../generator/boilerplate.mjs';

export default {
  id: 'halyard',
  shows: 'Not everything was found. Three fields the agent missed, a maturity date changed by an amendment the agent did not apply, swapped digits in a fee, and a source with no page.',
  name: 'Project Halyard',
  style: 'classic',
  receivedAt: '2026-11-18',
  values: {
    borrower: 'Kestrel Renewables Holdings Ltd',
    borrower_reg_no: '11834527',
    borrower_jurisdiction: 'England and Wales',
    guarantor: 'Kestrel Energy Group plc',
    arranger: 'Aurora Bank plc',
    original_lender: 'Aurora Bank plc',
    facility_agent: 'Aurora Agency Services Ltd',
    security_agent: 'Aurora Trustee Company Ltd',
    facility_type: 'Term loan',
    facility_amount: 'USD 250,000,000',
    currency: 'USD',
    purpose: 'Financing the construction of the Halyard offshore wind project',
    ranking: 'Senior secured',
    agreement_date: '14 March 2024',
    availability_end: '14 September 2024',
    first_repayment_date: '14 September 2025',
    final_maturity_date: '14 March 2030',
    interest_basis: 'Floating',
    benchmark: 'Term SOFR',
    margin: '2.00% per annum',
    benchmark_floor: '0.00%',
    interest_period: 'Three months',
    day_count: 'Actual/360',
    default_interest: '2.00% per annum',
    arrangement_fee: '1.25% of the Total Commitments',
    commitment_fee: '0.35% per annum',
    agency_fee: 'USD 40,000 per annum',
    prepayment_fee: '1.00% of the amount prepaid',
    repayment_profile: 'Amortising instalments with a final balloon payment',
    repayment_frequency: 'Semi-annually',
    instalment_amount: 'USD 12,500,000',
    balloon: 'USD 137,500,000',
    min_prepayment: 'USD 5,000,000',
    max_leverage: '4.50:1',
    min_interest_cover: '3.00:1',
    covenant_testing: 'Quarterly',
    financials_deadline: 'Within 120 days of each financial year end',
    security: 'First-ranking security over the project assets, the project accounts and the shares in the Borrower',
    governing_law: 'English law',
    jurisdiction: 'Courts of England',
    majority_lenders: 'At least 66.67% of the Total Commitments',
    transfer_consent: 'Required for any transfer, unless an Event of Default is continuing',
  },
  docs: [
    {
      id: 'facility-agreement', short: 'FA', title: 'Facility Agreement', type: 'agreement', dated: '14 March 2024',
      pages: [
        ['agreement_date', 'borrower', 'guarantor', 'arranger', 'original_lender', 'facility_agent', 'security_agent'],
        [FILLER.interpretation, 'facility_type', 'facility_amount', 'currency', 'purpose', 'ranking'],
        ['availability_end', FILLER.cp, 'interest_basis', 'benchmark', { f: 'margin', v: '2.25% per annum' }, 'benchmark_floor', 'interest_period'],
        ['day_count', 'default_interest', { h: 'Repayment', t: 'The Borrower shall repay the Loans in accordance with Schedule 1 (Repayment and Fees).' }, { f: 'final_maturity_date', v: '14 March 2029' }, 'min_prepayment', 'prepayment_fee', FILLER.taxes],
        [FILLER.reps, 'borrower_jurisdiction', { h: 'Financial covenants', t: 'The Borrower shall comply with the financial covenants set out in Schedule 2 (Financial Covenants).' }, 'security', FILLER.eod],
        ['majority_lenders', 'transfer_consent', FILLER.notices, 'governing_law', 'jurisdiction', FILLER.counterparts],
      ],
    },
    {
      id: 'schedule-1', short: 'S1', title: 'Schedule 1: Repayment and Fees', type: 'schedule', dated: '14 March 2024',
      pages: [
        ['repayment_profile', 'repayment_frequency', 'first_repayment_date', 'instalment_amount', 'balloon'],
        ['arrangement_fee', 'commitment_fee', 'agency_fee'],
      ],
    },
    {
      id: 'schedule-2', short: 'S2', title: 'Schedule 2: Financial Covenants', type: 'schedule', dated: '14 March 2024',
      pages: [['max_leverage', 'min_interest_cover', 'covenant_testing', 'financials_deadline']],
    },
    {
      id: 'amendment-1', short: 'AM1', title: 'First Amendment Agreement', type: 'amendment', dated: '2 June 2025',
      pages: [
        [
          { h: 'Background', t: 'This Amendment Agreement is dated 2 June 2025 and is supplemental to the Facility Agreement dated 14 March 2024 between, among others, Kestrel Renewables Holdings Ltd as Borrower and Aurora Agency Services Ltd as Agent (the "Facility Agreement").' },
          { f: 'final_maturity_date', h: 'Amendment to Final Maturity Date', t: 'With effect from the date of this Amendment Agreement, the clause of the Facility Agreement headed "Final Maturity Date" is amended by deleting "14 March 2029" and replacing it with "14 March 2030".' },
          { f: 'margin', h: 'Amendment to Margin', t: 'With effect from the date of this Amendment Agreement, the definition of Margin in the Facility Agreement is deleted and replaced with the following: "Margin" means 2.00% per annum.' },
        ],
        [
          { h: 'No other amendments', t: 'The Repayment Instalments and the final repayment amount set out in Schedule 1 (Repayment and Fees) are unchanged. Save as amended by this Amendment Agreement, the Facility Agreement continues in full force and effect.' },
          { h: 'Governing law', t: 'This Amendment Agreement and any non-contractual obligations arising out of or in connection with it are governed by English law.' },
          FILLER.counterparts,
        ],
      ],
    },
    {
      id: 'certificate-of-incorporation', short: 'CI', title: 'Certificate of Incorporation', type: 'supporting', dated: '8 January 2019',
      pages: [[
        { h: 'Certificate', t: 'The Registrar of Companies for England and Wales hereby certifies that KESTREL RENEWABLES HOLDINGS LTD is this day incorporated under the Companies Act 2006 as a private company, that the company is limited by shares, and that the situation of its registered office is in England and Wales.' },
        'borrower_reg_no',
        { h: 'Registered office', t: 'The registered office of the company is at 40 Harbour Exchange, London E14 9GE.' },
      ]],
    },
  ],
  extracted: {
    final_maturity_date: { value: '14 March 2029', confidence: 'medium' },  // amendment missed
    margin: { doc: 'amendment-1' },                                          // amendment read correctly
    commitment_fee: { value: '0.53% per annum', confidence: 'low' },         // digits swapped
    guarantor: { value: null },                                              // missed, it is on FA p.1
    security_agent: { value: null },                                         // missed, it is on FA p.1
    min_prepayment: { value: null },                                         // missed, it is on FA p.4
    borrower_reg_no: { noPage: true, confidence: 'medium' },                 // document known, page unknown
    purpose: { confidence: 'medium' },
    transfer_consent: { confidence: 'low' },                                 // low confidence but correct
  },
  // The sample final check: what a checking agent would raise on this deal.
  points: [
    {
      field: 'final_maturity_date', doc: 'amendment-1',
      reason: 'The First Amendment Agreement replaces "14 March 2029" with "14 March 2030". The extracted date is the one from the original agreement.',
    },
  ],
};
