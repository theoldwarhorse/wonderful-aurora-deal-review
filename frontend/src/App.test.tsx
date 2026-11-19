// The two places where the review screen must not lose the reviewer's work or mislead them:
// leaving with an unsaved change, and approving when a request fails.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { api, type Deal } from './api';
import { App } from './App';

// The PDF viewer needs a real browser to draw. These tests are about the fields beside it.
vi.mock('./components/DocumentViewer', () => ({ DocumentViewer: () => null }));

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  api: {
    me: vi.fn(),
    listDeals: vi.fn(),
    getDeal: vi.fn(),
    saveValue: vi.fn(),
    approve: vi.fn(),
    track: vi.fn(),
  },
}));

const deal: Deal = {
  id: 'halyard',
  name: 'Project Halyard',
  borrower: 'Kestrel Renewables Holdings Ltd',
  facility: 'USD 250,000,000 term loan',
  receivedAt: '2026-11-18T12:00:00Z',
  awaitingExtraction: false,
  status: 'in-review',
  reviewStartedAt: '2026-11-19T09:00:00Z',
  approved: null,
  summary: { total: 1, extracted: 1, edited: 0, missing: 0, 'not-in-documents': 0 },
  canApprove: true,
  fieldsOpened: 1,
  pointsOpen: 0,
  points: [],
  delivery: null,
  documents: [
    { id: 'fa', short: 'FA', title: 'Facility Agreement', type: 'agreement', dated: '14 March 2024', file: '/fa.pdf' },
  ],
  fields: [
    {
      id: 'final_maturity_date',
      group: 'Key dates',
      label: 'Final maturity date',
      value: '14 March 2029',
      extractedValue: '14 March 2029',
      state: 'extracted',
      confidence: 'medium',
      source: { documentId: 'fa', page: 4, clause: 'cl. 24' },
    },
  ],
};

const mocked = vi.mocked(api);

beforeEach(async () => {
  vi.resetAllMocks();
  mocked.me.mockResolvedValue({ title: 'Deal manager', demoMode: true });
  mocked.listDeals.mockResolvedValue([]);
  mocked.getDeal.mockResolvedValue(deal);
  mocked.track.mockResolvedValue();
  location.hash = '#/deal/halyard';
  // Let the address change settle before the app starts listening for the next one.
  await new Promise((resolve) => setTimeout(resolve));
});

async function openTheDeal() {
  render(<App />);
  return screen.findByRole('button', { name: /Final maturity date/ });
}

async function typeACorrection(text: string) {
  fireEvent.click(await openTheDeal());
  fireEvent.change(screen.getByRole('textbox', { name: /Final maturity date/ }), { target: { value: text } });
}

test('leaving the deal with an unsaved correction is refused, and the correction is kept', async () => {
  await typeACorrection('14 March 2030');

  location.hash = '#/'; // the Deals link, or the browser's back button

  await screen.findByText('Save or cancel this change before moving on.');
  expect(location.hash).toBe('#/deal/halyard');
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Final maturity date/ }).value).toBe('14 March 2030');

  // Closing or reloading the tab is put to the reviewer by the browser.
  const closing = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(closing);
  expect(closing.defaultPrevented).toBe(true);
});

test('once the correction is cancelled, leaving works and the browser no longer warns', async () => {
  await typeACorrection('14 March 2030');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  const closing = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(closing);
  expect(closing.defaultPrevented).toBe(false);

  location.hash = '#/';
  await screen.findByRole('heading', { name: 'Deals' });
});

test('an edit that was opened but not changed does not hold the reviewer back', async () => {
  await typeACorrection('14 March 2029'); // the same value as before

  location.hash = '#/';
  await screen.findByRole('heading', { name: 'Deals' });
});

test('if the deal cannot be refreshed, no approval summary opens', async () => {
  fireEvent.click(await openTheDeal());
  mocked.getDeal.mockRejectedValueOnce(new Error('The review service could not be reached.'));

  fireEvent.click(screen.getByRole('button', { name: 'Approve deal' }));

  await screen.findByText('The review service could not be reached.');
  expect(screen.queryByRole('heading', { name: /Approve Project Halyard/ })).toBeNull();
});

test('a refused approval keeps the summary open and says why; a successful one closes it', async () => {
  fireEvent.click(await openTheDeal());
  fireEvent.click(screen.getByRole('button', { name: 'Approve deal' }));
  const summary = (await screen.findByRole('heading', { name: /Approve Project Halyard/ })).closest('dialog')!;
  const confirm = () => fireEvent.click(summary.querySelector<HTMLButtonElement>('.btn-primary')!);

  mocked.approve.mockRejectedValueOnce(new Error('1 field needs a value before the deal can be approved.'));
  confirm();
  await waitFor(() => expect(summary.textContent).toContain('The deal was not approved. 1 field needs a value'));
  expect(summary.isConnected).toBe(true);

  mocked.approve.mockResolvedValueOnce({
    ...deal,
    status: 'approved',
    approved: { at: '2026-11-19T10:00:00Z', by: 'Deal manager' },
    canApprove: false,
  });
  confirm();
  await waitFor(() => expect(summary.isConnected).toBe(false));
  await screen.findByText(/Approved on 19 Nov 2026/);
});

test('the deals page narrows the list by search and by status, and can be cleared', async () => {
  const summary = ({ documents: _documents, fields: _fields, ...rest }: Deal) => ({ ...rest, documentCount: 5 });
  mocked.listDeals.mockResolvedValue([
    summary(deal),
    summary({
      ...deal,
      id: 'marlow',
      name: 'Project Marlow',
      borrower: 'Dunmore Freight Group plc',
      status: 'approved',
    }),
  ]);
  location.hash = '#/';
  render(<App />);
  await screen.findByRole('heading', { name: 'Project Halyard' });
  const names = () => screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search deals' }), { target: { value: 'dunmore freight' } });
  expect(names()).toEqual(['Project Marlow']);

  // The status pills: one pressed narrows to that status, two pressed shows either, pressing again releases.
  const approved = screen.getByRole('button', { name: /^Approved/ });
  fireEvent.click(approved);
  expect(approved.getAttribute('aria-pressed')).toBe('true');
  expect(names()).toEqual(['Project Marlow']);

  fireEvent.click(approved);
  fireEvent.click(screen.getByRole('button', { name: /^To review/ }));
  expect(names()).toEqual([]);

  fireEvent.click(screen.getByRole('button', { name: 'Show all deals' }));
  expect(names()).toEqual(['Project Halyard', 'Project Marlow']);
});

test('a point from a final check is shown as advice, on the field and again before approval', async () => {
  const point = {
    id: 7,
    fieldId: 'final_maturity_date',
    reason: 'The First Amendment Agreement changes this date.',
    source: { documentId: 'fa', page: 1, clause: 'cl. 2' },
    raisedBy: 'Checking agent (MCP)',
    raisedAt: '2026-11-19T10:00:00Z',
    checkedAt: null,
  };
  mocked.getDeal.mockResolvedValue({ ...deal, pointsOpen: 1, points: [point] });

  const field = await openTheDeal();
  expect(field.textContent).toContain('Check again');
  fireEvent.click(field);
  screen.getByText('The First Amendment Agreement changes this date.');
  screen.getByRole('button', { name: 'Mark as checked' });

  // The point does not stand in the way: approval is still offered, with the point listed in the summary.
  fireEvent.click(screen.getByRole('button', { name: 'Approve deal' }));
  await screen.findByRole('heading', { name: 'Raised by the final check, not yet marked as checked' });
});
