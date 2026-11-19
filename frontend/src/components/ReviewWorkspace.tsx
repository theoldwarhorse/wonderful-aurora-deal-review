import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, messageOf, type Deal, type Field } from '../api';
import { useLoad } from '../useLoad';
import { ConfirmDialog } from './ConfirmDialog';
import { DocumentViewer } from './DocumentViewer';
import { FieldPanel } from './FieldPanel';
import { StatusBadge } from './StatusBadge';

export function ReviewWorkspace({ dealId }: { dealId: string }) {
  const { data: deal, error: loadError, setData: setDeal } = useLoad(() => api.getDeal(dealId), dealId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The document and page on show. `request` goes up each time one is asked for.
  const [view, setView] = useState<{ docId: string; page: number; request: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  // Record what the reviewer opens: the deal, each document shown, and (in `select`) each field.
  const shownDocumentId = view?.docId ?? deal?.documents[0]?.id;
  useEffect(() => {
    void api.track(dealId, 'deal-opened');
  }, [dealId]);
  useEffect(() => {
    if (shownDocumentId) void api.track(dealId, 'document-viewed', { documentId: shownDocumentId });
  }, [dealId, shownDocumentId]);

  if (!deal) {
    return (
      <main className="message-page" role={loadError ? 'alert' : 'status'}>
        {loadError ? (
          <>
            <h1>This deal could not be opened</h1>
            <p className="muted">{loadError}</p>
            <div className="dialog-actions">
              <a className="btn btn-primary" href="#/">
                Back to deals
              </a>
            </div>
          </>
        ) : (
          <p className="muted">Loading deal…</p>
        )}
      </main>
    );
  }

  const selected = deal.fields.find((f) => f.id === selectedId);
  const shown = view ?? { docId: deal.documents[0]?.id ?? '', page: 1, request: 0 };
  const show = (docId: string, page: number) => setView({ docId, page, request: shown.request + 1 });

  // Every action returns the deal as the server now sees it, which replaces what is on screen.
  async function act(action: Promise<Deal>) {
    try {
      setDeal(await action);
      setError('');
      return true;
    } catch (failure) {
      setError(messageOf(failure));
      return false;
    }
  }

  function openSource(source: Field['source']) {
    if (source) show(source.documentId, source.page ?? 1);
  }

  // Selecting a field opens its source. Selecting it again closes the detail.
  function select(field: Field) {
    if (selectedId === field.id) return setSelectedId(null);
    setSelectedId(field.id);
    openSource(field.source);
    const opened = api.track(dealId, 'field-viewed', { fieldId: field.id });
    // Opening the first field is what starts the review, so the status changes now, not at the next save.
    if (deal?.status === 'to-review' && !deal.awaitingExtraction) {
      void opened.then(() => api.getDeal(dealId)).then(setDeal, () => {});
    }
  }

  return (
    <main className="workspace">
      <div className="deal-bar">
        <a href="#/" className="back">
          <ArrowLeft size={16} aria-hidden /> Deals
        </a>
        <div className="deal-heading">
          <h1>{deal.name}</h1>
          <p className="muted small">{[deal.borrower, deal.facility].filter(Boolean).join(' · ')}</p>
        </div>
        <StatusBadge status={deal.status} />
      </div>

      <div className="workspace-body">
        <DocumentViewer
          documents={deal.documents}
          docId={shown.docId}
          page={shown.page}
          request={shown.request}
          sourceDocId={selected?.source?.documentId}
          onNavigate={show}
        />
        <FieldPanel
          deal={deal}
          selectedId={selectedId}
          error={error}
          actions={{
            save: (field, value) => act(api.saveValue(deal.id, field.id, value)),
            markNotInDocuments: (field) => act(api.markNotInDocuments(deal.id, field.id)),
            undo: (field) => act(api.undo(deal.id, field.id)),
            markChecked: (point) => act(api.markPointChecked(deal.id, point.id)),
          }}
          onSelect={select}
          onOpenSource={openSource}
          // Reload first, so the summary is current. If that fails the error is shown and no summary opens.
          onApprove={async () => {
            if (await act(api.getDeal(deal.id))) setConfirming(true);
          }}
          onRetryDelivery={() => act(api.retryDelivery(deal.id))}
        />
      </div>

      {confirming && (
        <ConfirmDialog
          deal={deal}
          onCancel={() => setConfirming(false)}
          // The summary closes only when the approval went through. A failure is shown inside it.
          onConfirm={async () => {
            try {
              setDeal(await api.approve(deal.id));
              setError('');
              setConfirming(false);
              return null;
            } catch (failure) {
              return messageOf(failure);
            }
          }}
        />
      )}
    </main>
  );
}
