import { ArrowUpRight, BookOpen, Plus, RotateCcw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type DealStatus, type DealSummary } from '../api';
import { useLoad } from '../useLoad';
import { formatDate } from '../format';
import { NewDealDialog } from './NewDealDialog';
import { StatusBadge } from './StatusBadge';

const STATUSES: [DealStatus, string][] = [
  ['to-review', 'To review'],
  ['in-review', 'In review'],
  ['approved', 'Approved'],
];

function progress(deal: DealSummary): { text: string; attention: boolean } {
  if (deal.approved) {
    const unsent = deal.delivery?.status !== 'delivered';
    return { text: `Approved ${formatDate(deal.approved.at)}${unsent ? ', not yet sent' : ''}`, attention: unsent };
  }
  const missing = deal.summary.missing;
  if (missing) return { text: `${missing} ${missing === 1 ? 'field needs' : 'fields need'} a value`, attention: true };
  return { text: 'Ready for your review', attention: false };
}

export function DealsPage({ demoMode }: { demoMode: boolean }) {
  const { data: deals, error: loadError, reload } = useLoad(api.listDeals, 'deals');
  // The statuses to show. None chosen means all of them.
  const [statuses, setStatuses] = useState<DealStatus[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<'help' | 'reset' | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog) ref.current?.showModal();
  }, [dialog]);

  const rows = deals ?? [];
  // A deal is shown when it has one of the chosen statuses and every word typed appears in its name, borrower or facility.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((deal) => {
    const text = [deal.name, deal.borrower, deal.facility ?? ''].join(' ').toLowerCase();
    return (statuses.length === 0 || statuses.includes(deal.status)) && words.every((word) => text.includes(word));
  });

  async function reset() {
    setResetting(true);
    setError('');
    try {
      await api.reset();
      reload();
      setStatuses([]);
      setQuery('');
      setDialog(null);
    } catch {
      setError('The demo could not be reset. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="page deals-page">
      <div className="page-head">
        <h1>Deals</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden /> New deal
        </button>
      </div>

      <div className="search-row">
        <div className="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            aria-label="Search deals"
            placeholder="Search by deal, borrower or facility"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="status-pills" role="group" aria-label="Filter by status">
          {STATUSES.map(([id, label]) => (
            <button
              key={id}
              className={`status-pill badge-${id}`}
              aria-pressed={statuses.includes(id)}
              onClick={() => setStatuses(statuses.includes(id) ? statuses.filter((s) => s !== id) : [...statuses, id])}
            >
              <span className="status-dot" aria-hidden />
              {label} <span className="count">{rows.filter((deal) => deal.status === id).length}</span>
            </button>
          ))}
        </div>
        <span className="page-total muted small" aria-live="polite">
          {shown.length === rows.length ? `${rows.length} deals` : `${shown.length} of ${rows.length} deals`}
        </span>
      </div>

      <div className="deal-grid">
        {shown.map((deal) => {
          const { text, attention } = progress(deal);
          return (
            <a key={deal.id} href={`#/deal/${deal.id}`} className="deal-card">
              <div className="card-top">
                <StatusBadge status={deal.status} />
                <ArrowUpRight size={18} aria-hidden />
              </div>
              <h2>{deal.name}</h2>
              <p className="card-borrower">{deal.borrower}</p>
              <p className="card-facility">{deal.facility || 'Facility details not provided'}</p>
              <dl className="card-facts">
                <div>
                  <dt>Documents</dt>
                  <dd>{deal.documentCount}</dd>
                </div>
                <div>
                  <dt>Extracted fields</dt>
                  <dd>{deal.summary.total}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatDate(deal.receivedAt)}</dd>
                </div>
              </dl>
              <div className="card-bottom">
                <span className={attention ? 'attention' : 'muted'}>{text}</span>
                <span className="card-action">
                  {deal.approved ? 'View deal' : deal.status === 'in-review' ? 'Continue review' : 'Review deal'}{' '}
                  <span aria-hidden>→</span>
                </span>
              </div>
            </a>
          );
        })}
        {!deals && !loadError && (
          <p className="page-empty" role="status">
            Loading deals…
          </p>
        )}
        {!deals && loadError && (
          <p className="page-empty" role="alert">
            The deals could not be loaded. {loadError}{' '}
            <button className="link" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {deals && shown.length === 0 && (
          <p className="page-empty">
            No deals match.{' '}
            <button
              className="link"
              onClick={() => {
                setQuery('');
                setStatuses([]);
              }}
            >
              Show all deals
            </button>
          </p>
        )}
      </div>

      <footer className="page-foot">
        <div className="page-actions">
          {demoMode && (
            <button
              className="btn"
              onClick={() => {
                setError('');
                setDialog('reset');
              }}
            >
              <RotateCcw size={15} aria-hidden /> Reset demo
            </button>
          )}
          <button className="btn" onClick={() => setDialog('help')}>
            <BookOpen size={15} aria-hidden /> How to use
          </button>
        </div>
      </footer>

      {dialog && (
        <dialog
          ref={ref}
          className="dialog"
          aria-labelledby="deals-dialog-title"
          onClose={() => setDialog(null)}
          onCancel={(event) => {
            if (resetting) event.preventDefault();
          }}
        >
          <p className="eyebrow">{dialog === 'help' ? 'Quick guide' : 'Demo workspace'}</p>
          <h2 id="deals-dialog-title">{dialog === 'help' ? 'Review a deal with confidence.' : 'Reset the demo?'}</h2>
          {dialog === 'help' ? (
            <>
              <ol className="help-steps">
                <li>
                  <strong>Open a deal.</strong>
                  <p>Choose a tile to see its documents and extracted details side by side.</p>
                </li>
                <li>
                  <strong>Check the evidence.</strong>
                  <p>
                    Select a field to open its source. Use the document tabs to check schedules and amendments too. A
                    field marked “Check again” carries a note from a final check by an AI agent.
                  </p>
                </li>
                <li>
                  <strong>Resolve missing or incorrect values.</strong>
                  <p>
                    Type a correction and save it, or mark a field “Not in the documents” after checking. Use the filter
                    to focus your review.
                  </p>
                </li>
                <li>
                  <strong>Approve the completed review.</strong>
                  <p>
                    Once you have checked all details and resolved missing values, approve the deal. Approved deals are
                    read-only and are sent to the downstream system.
                  </p>
                </li>
              </ol>
              <p className="note">
                Sample deals are fictional. New uploads are stored but not read by an AI agent, so their fields start
                empty. The downstream system is a stand-in service.
              </p>
              <div className="dialog-actions">
                <button className="btn btn-primary" onClick={() => setDialog(null)}>
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                This removes uploaded deals and saved changes, and restores the original sample deals.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button className="btn" disabled={resetting} onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={resetting} onClick={reset}>
                  {resetting ? 'Resetting…' : 'Reset demo'}
                </button>
              </div>
            </>
          )}
        </dialog>
      )}
      {creating && (
        <NewDealDialog onClose={() => setCreating(false)} onCreated={(deal) => (location.hash = `#/deal/${deal.id}`)} />
      )}
    </main>
  );
}
