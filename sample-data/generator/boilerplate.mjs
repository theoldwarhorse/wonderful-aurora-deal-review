// Clauses that hold no extracted field. They pad the documents so that finding a
// field takes some reading, as it does in a real agreement.
export const FILLER = {
  interpretation: { h: 'Interpretation', t: 'In this Agreement, unless the context otherwise requires, words importing the singular include the plural and vice versa, and a reference to a Finance Document is a reference to that document as amended, novated, supplemented or restated from time to time.' },
  cp: { h: 'Conditions precedent', t: 'The Borrower may not deliver a Utilisation Request unless the Agent has received all of the documents and other evidence required as conditions precedent, in form and substance satisfactory to the Agent.' },
  reps: { h: 'Representations', t: 'The Borrower makes the representations and warranties set out in this Agreement to each Finance Party on the date of this Agreement and on the first day of each Interest Period.' },
  taxes: { h: 'Tax gross-up', t: 'All payments to be made by the Borrower under the Finance Documents shall be made free and clear of any deduction or withholding for or on account of Tax, unless such deduction or withholding is required by law.' },
  eod: { h: 'Events of Default', t: 'Each of the events or circumstances customarily described as an event of default, including non-payment, breach of a financial covenant, misrepresentation, cross-default and insolvency, is an Event of Default.' },
  notices: { h: 'Notices', t: 'Any communication to be made under or in connection with the Finance Documents shall be made in writing and, unless otherwise stated, may be made by letter or electronic mail.' },
  counterparts: { h: 'Counterparts', t: 'Each Finance Document may be executed in any number of counterparts, and this has the same effect as if the signatures on the counterparts were on a single copy of the Finance Document.' },
};
