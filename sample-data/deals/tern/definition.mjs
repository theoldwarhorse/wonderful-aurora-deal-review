// The definition of this deal. The only file in this folder edited by hand: the generator
// writes everything else from it (see ../../README.md).
//
// `values` is what the documents say (the truth). `extracted` lists only where the mock
// agent's output differs from the truth. Each page of a document is a list of items: a
// field id, { f, v } to print a different value (for example a term later amended), or
// { h, t } for a clause holding no field.
import { FILLER } from '../../generator/boilerplate.mjs';

export default {
  id: 'tern',
  shows: 'Every field was found. One value was wrong and was corrected before approval, so the deal starts approved and read-only.',
  name: 'Project Tern',
  style: 'us',
  receivedAt: '2026-11-12',
  values: {
    borrower: 'Ashby Water Utilities, Inc.',
    borrower_reg_no: '5521908',
    borrower_jurisdiction: 'Delaware',
    guarantor: 'Ashby Infrastructure Holdings, LLC',
    arranger: 'Aurora Bank plc, New York Branch',
    original_lender: 'Aurora Bank plc, New York Branch',
    facility_agent: 'Aurora Bank plc, New York Branch',
    security_agent: 'Hollis Trust Company, N.A.',
    facility_type: 'Term loan',
    facility_amount: 'USD 120,000,000',
    currency: 'USD',
    purpose: 'Refinancing existing indebtedness and funding capital expenditure on water treatment facilities',
    ranking: 'Senior secured',
    agreement_date: '22 September 2025',
    availability_end: '22 December 2025',
    first_repayment_date: '31 March 2026',
    final_maturity_date: '22 September 2030',
    interest_basis: 'Floating',
    benchmark: 'Term SOFR',
    margin: '1.75% per annum',
    benchmark_floor: '0.50%',
    interest_period: 'Three months',
    day_count: 'Actual/360',
    default_interest: '2.00% per annum',
    arrangement_fee: '0.75% of the Total Commitments',
    commitment_fee: '0.25% per annum',
    agency_fee: 'USD 30,000 per annum',
    prepayment_fee: '1.00% of the amount prepaid',
    repayment_profile: 'Quarterly amortisation with a final balloon payment',
    repayment_frequency: 'Quarterly',
    instalment_amount: 'USD 1,500,000',
    balloon: 'USD 93,000,000',
    min_prepayment: 'USD 2,000,000',
    max_leverage: '5.00:1',
    min_interest_cover: '2.50:1',
    covenant_testing: 'Quarterly',
    financials_deadline: 'Within 90 days of each fiscal year end',
    security: 'A first-priority security interest in substantially all assets of the Borrower',
    governing_law: 'New York law',
    jurisdiction: 'Courts of the State of New York sitting in New York County',
    majority_lenders: 'More than 50% of the Total Commitments',
    transfer_consent: 'Required for any assignment, unless an Event of Default is continuing',
  },
  docs: [
    {
      id: 'credit-agreement', short: 'CA', title: 'Credit Agreement', type: 'agreement', dated: '22 September 2025',
      pages: [
        ['agreement_date', 'borrower', 'guarantor', 'arranger', 'original_lender', 'facility_agent', 'security_agent'],
        [FILLER.interpretation, 'facility_type', 'facility_amount', 'currency', 'purpose', 'ranking', 'availability_end'],
        ['interest_basis', 'benchmark', 'margin', 'benchmark_floor', 'interest_period', 'day_count', 'default_interest'],
        ['arrangement_fee', 'commitment_fee', 'agency_fee', 'prepayment_fee', FILLER.taxes],
        ['repayment_profile', 'repayment_frequency', 'first_repayment_date', 'instalment_amount', 'balloon', 'final_maturity_date', 'min_prepayment'],
        [FILLER.reps, 'max_leverage', 'min_interest_cover', 'covenant_testing', 'financials_deadline', 'security'],
        [FILLER.eod, 'majority_lenders', 'transfer_consent', FILLER.notices, 'governing_law', 'jurisdiction'],
      ],
    },
    {
      id: 'secretarys-certificate', short: 'SC', title: "Secretary's Certificate", type: 'supporting', dated: '22 September 2025',
      pages: [[
        { h: 'Certification', t: 'The undersigned, being the duly elected Secretary of Ashby Water Utilities, Inc. (the "Company"), hereby certifies on behalf of the Company as follows.' },
        'borrower_jurisdiction', 'borrower_reg_no',
        { h: 'Authorization', t: 'The resolutions of the Board of Directors of the Company authorizing the execution, delivery and performance of the Credit Agreement have not been amended or rescinded and remain in full force and effect.' },
      ]],
    },
  ],
  extracted: {
    benchmark_floor: { value: '0.00%', confidence: 'low' },   // wrong, corrected in the seeded review
    purpose: { confidence: 'medium' },
  },
  seedReview: {
    edits: { benchmark_floor: { value: '0.50%' } },
    approved: { at: '2026-11-17T14:32:00Z' },
  },
};
