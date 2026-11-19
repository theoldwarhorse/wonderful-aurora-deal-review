// The definition of this deal. The only file in this folder edited by hand: the generator
// writes everything else from it (see ../../README.md).
//
// `values` is what the documents say (the truth). `extracted` lists only where the mock
// agent's output differs from the truth. Each page of a document is a list of items: a
// field id, { f, v } to print a different value (for example a term later amended), or
// { h, t } for a clause holding no field.
import { FILLER } from '../../generator/boilerplate.mjs';

export default {
  id: 'marlow',
  shows: 'Every field was found. Two values are wrong, and one of them is already corrected, so the deal starts part-way through a review.',
  name: 'Project Marlow',
  style: 'modern',
  receivedAt: '2026-11-16',
  values: {
    borrower: 'Dunmore Freight Group plc',
    borrower_reg_no: 'SC417963',
    borrower_jurisdiction: 'Scotland',
    guarantor: 'Dunmore Freight (Holdings) Ltd',
    arranger: 'Aurora Bank plc',
    original_lender: 'Aurora Bank plc',
    facility_agent: 'Aurora Bank plc',
    security_agent: 'Calder Trust Corporation Ltd',
    facility_type: 'Term loan',
    facility_amount: 'GBP 85,000,000',
    currency: 'GBP',
    purpose: 'Financing the acquisition of rail freight rolling stock',
    ranking: 'Senior secured',
    agreement_date: '3 February 2025',
    availability_end: '3 May 2025',
    first_repayment_date: '3 February 2026',
    final_maturity_date: '3 February 2032',
    interest_basis: 'Floating',
    benchmark: 'Compounded SONIA',
    margin: '1.85% per annum',
    benchmark_floor: '0.00%',
    interest_period: 'Six months',
    day_count: 'Actual/365',
    default_interest: '1.00% per annum',
    arrangement_fee: '0.90% of the Total Commitments',
    commitment_fee: '0.30% per annum',
    agency_fee: 'GBP 25,000 per annum',
    prepayment_fee: '0.50% of the amount prepaid',
    repayment_profile: 'Equal annual instalments with a final balloon payment',
    repayment_frequency: 'Annually',
    instalment_amount: 'GBP 8,500,000',
    balloon: 'GBP 34,000,000',
    min_prepayment: 'GBP 1,000,000',
    max_leverage: '3.75:1',
    min_interest_cover: '4.00:1',
    covenant_testing: 'Semi-annually',
    financials_deadline: 'Within 150 days of each financial year end',
    security: 'First-ranking security over the financed rolling stock and an assignment of the related lease receivables',
    governing_law: 'English law',
    jurisdiction: 'Courts of England',
    majority_lenders: 'At least 66.67% of the Total Commitments',
    transfer_consent: 'Not required for a transfer to another bank or financial institution',
  },
  docs: [
    {
      id: 'term-facility-agreement', short: 'TFA', title: 'Term Facility Agreement', type: 'agreement', dated: '3 February 2025',
      pages: [
        ['agreement_date', 'borrower', 'guarantor', 'arranger', 'original_lender', 'facility_agent', 'security_agent'],
        ['facility_type', 'facility_amount', 'currency', 'purpose', 'ranking', 'availability_end', FILLER.cp],
        ['interest_basis', 'benchmark', 'margin', 'benchmark_floor', 'interest_period', 'day_count', 'default_interest'],
        [{ h: 'Repayment', t: 'The Borrower shall repay the Loans in accordance with the Repayment Schedule.' }, 'final_maturity_date', 'min_prepayment', 'prepayment_fee', 'commitment_fee', { h: 'Other fees', t: 'The Borrower shall pay the arrangement fee and the agency fee in the amounts and at the times agreed in the Fee Letter.' }],
        [FILLER.reps, 'max_leverage', 'min_interest_cover', 'covenant_testing', 'financials_deadline', 'security'],
        [FILLER.eod, 'majority_lenders', 'transfer_consent', 'governing_law', 'jurisdiction', FILLER.counterparts],
      ],
    },
    {
      id: 'repayment-schedule', short: 'RS', title: 'Repayment Schedule', type: 'schedule', dated: '3 February 2025',
      pages: [['repayment_profile', 'repayment_frequency', 'first_repayment_date', 'instalment_amount', 'balloon']],
    },
    {
      id: 'fee-letter', short: 'FL', title: 'Fee Letter', type: 'supporting', dated: '3 February 2025',
      pages: [[
        { h: 'Introduction', t: 'We refer to the Term Facility Agreement dated 3 February 2025 between, among others, Dunmore Freight Group plc as Borrower and Aurora Bank plc as Agent. This letter is the Fee Letter referred to in that agreement.' },
        'arrangement_fee', 'agency_fee',
      ]],
    },
    {
      id: 'company-extract', short: 'CE', title: 'Company Register Extract', type: 'supporting', dated: '20 January 2025',
      pages: [[
        { h: 'Company name', t: 'DUNMORE FREIGHT GROUP PLC, a public limited company.' },
        'borrower_reg_no', 'borrower_jurisdiction',
        { h: 'Registered office', t: 'The registered office of the company is at 12 Quayside Terrace, Leith, Edinburgh EH6 6QR.' },
      ]],
    },
  ],
  extracted: {
    interest_period: { value: 'Three months', confidence: 'medium' },   // wrong, documents say six months
    default_interest: { value: '2.00% per annum', confidence: 'low' },  // wrong, already corrected in the seeded review
    balloon: { confidence: 'medium' },
  },
  seedReview: { edits: { default_interest: { value: '1.00% per annum' } } },
};
