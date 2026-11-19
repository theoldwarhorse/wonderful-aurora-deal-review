// The document tabs must work from the keyboard the way tabs are expected to.
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import type { DealDocument } from '../api';
import { DocumentViewer } from './DocumentViewer';

// Drawing a PDF needs a real browser. These tests are about the tabs above it.
vi.mock('react-pdf', () => ({ Document: () => null, Page: () => null, pdfjs: { GlobalWorkerOptions: {} } }));

const documents: DealDocument[] = [
  {
    id: 'agreement',
    short: 'FA',
    title: 'Facility Agreement',
    type: 'agreement',
    dated: '14 March 2024',
    file: '/a.pdf',
  },
  { id: 'schedule', short: 'S1', title: 'Schedule 1', type: 'schedule', dated: '14 March 2024', file: '/s.pdf' },
  {
    id: 'amendment',
    short: 'AM1',
    title: 'First Amendment Agreement',
    type: 'amendment',
    dated: '2 June 2025',
    file: '/m.pdf',
  },
];

function Viewer() {
  const [docId, setDocId] = useState('agreement');
  return <DocumentViewer documents={documents} docId={docId} page={1} request={0} onNavigate={(id) => setDocId(id)} />;
}

const selected = () => screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')!;

test('only the open document is a stop for the Tab key, and it names the panel it controls', () => {
  render(<Viewer />);
  const tabs = screen.getAllByRole('tab');

  expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  expect(selected().textContent).toContain('Facility Agreement');
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(selected().id);
});

test('the arrow keys, Home and End move between documents and take the focus with them', () => {
  render(<Viewer />);
  const strip = screen.getByRole('tablist');
  const press = (key: string) => fireEvent.keyDown(strip, { key });

  press('ArrowRight');
  expect(selected().textContent).toContain('Schedule 1');
  expect(document.activeElement).toBe(selected());

  press('End');
  expect(selected().textContent).toContain('First Amendment Agreement');

  press('ArrowRight'); // past the last document, back to the first
  expect(selected().textContent).toContain('Facility Agreement');

  press('ArrowLeft'); // and before the first, round to the last
  expect(selected().textContent).toContain('First Amendment Agreement');

  press('Home');
  expect(selected().textContent).toContain('Facility Agreement');
});
