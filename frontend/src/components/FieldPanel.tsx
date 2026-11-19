import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Deal, Field } from '../api';
import { formatDate, formatDateTime } from '../format';
import { blockNavigation } from '../navigation';
import { FieldRow, type FieldActions } from './FieldRow';

type Filter = 'all' | 'points' | 'missing' | 'check' | 'changed';

// `flagged` holds the ids of fields with a point from a final check still to be looked at.
const FILTERS: Record<Filter, { label: string; test: (f: Field, flagged: Set<string>) => boolean }> = {
  all: { label: 'All fields', test: () => true },
  points: { label: 'Check again', test: (f, flagged) => flagged.has(f.id) },
  missing: { label: 'Needs a value', test: (f) => f.state === 'missing' },
  check: { label: 'Lower confidence', test: (f) => f.confidence === 'low' || f.confidence === 'medium' },
  changed: { label: 'Changed', test: (f) => f.state === 'edited' || f.state === 'not-in-documents' },
};

type Props = {
  deal: Deal;
  selectedId: string | null;
  error: string;
  actions: FieldActions;
  onSelect: (field: Field) => void;
  onOpenSource: (source: Field['source']) => void;
  onApprove: () => void;
  onRetryDelivery: () => void;
};

export function FieldPanel({
  deal,
  selectedId,
  error,
  actions,
  onSelect,
  onOpenSource,
  onApprove,
  onRetryDelivery,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  // One value is edited at a time. `nudge` counts attempts to leave it unsaved.
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [nudge, setNudge] = useState(0);

  const readOnly = deal.status === 'approved';
  const missing = deal.summary.missing;
  const flagged = new Set(deal.points.filter((point) => !point.checkedAt).map((point) => point.fieldId));
  const matches = (f: Field) => FILTERS[filter].test(f, flagged);
  // The final-check pill appears only on a deal where a check has raised something.
  const pills = (['points', 'missing', 'check', 'changed'] as const).filter(
    (id) => id !== 'points' || deal.points.length > 0,
  );
  const groups = [...new Set(deal.fields.map((f) => f.group))];
  const shown = (group: string) => deal.fields.filter((f) => f.group === group && matches(f));

  function stopEditing() {
    setEditing(null);
    setNudge(0);
  }

  // Typed text is never thrown away silently. While a changed value is unsaved, every way of
  // moving on is refused with the same message: another field, the filter, approval, a link
  // out of the deal, the browser's back button. The browser itself asks before closing the tab.
  const editedField = editing && deal.fields.find((f) => f.id === editing.id);
  const unsaved = !!editedField && editing!.text.trim() !== (editedField.value ?? '');
  useEffect(() => {
    if (unsaved) return blockNavigation(() => setNudge((n) => n + 1));
  }, [unsaved]);

  function leaveEdit(then: () => void) {
    if (unsaved) return setNudge((n) => n + 1);
    stopEditing();
    then();
  }

  return (
    <aside className="panel" aria-label="Extracted details">
      <div className="panel-head">
        <h2>Extracted details</h2>
        <p className="panel-intro muted small">Select a field to check its source or change its value.</p>
        {/* Press a pill to show only those fields; press it again to show them all. */}
        <div className="status-pills field-filter" role="group" aria-label="Show only">
          {pills.map((id) => (
            <button
              key={id}
              className="status-pill"
              aria-pressed={filter === id}
              onClick={() => leaveEdit(() => setFilter(filter === id ? 'all' : id))}
            >
              {FILTERS[id].label}{' '}
              <span className="count">{deal.fields.filter((f) => FILTERS[id].test(f, flagged)).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-body">
        {deal.awaitingExtraction && !readOnly && (
          <p className="note">
            No extraction has been received for this deal, so its fields start empty. Enter each value from the
            documents.
          </p>
        )}
        {groups.map((group) => {
          const fields = shown(group);
          if (fields.length === 0) return null;
          return (
            <section key={group} className="field-group">
              <h3 className="field-group-title">{group}</h3>
              {fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  deal={deal}
                  points={deal.points.filter((point) => point.fieldId === field.id)}
                  selected={selectedId === field.id}
                  readOnly={readOnly}
                  draft={editing?.id === field.id ? editing.text : null}
                  nudge={nudge}
                  actions={actions}
                  onDraft={(text) => (text === null ? stopEditing() : setEditing({ id: field.id, text }))}
                  onSelect={() => leaveEdit(() => onSelect(field))}
                  onOpenSource={onOpenSource}
                />
              ))}
            </section>
          );
        })}
        {groups.every((g) => shown(g).length === 0) && (
          <p className="panel-empty muted">
            No fields match this filter.{' '}
            <button className="link" onClick={() => setFilter('all')}>
              Show all fields
            </button>
          </p>
        )}
      </div>

      <div className="panel-foot">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {deal.approved ? (
          <>
            <p className="approved-note">
              <CheckCircle2 size={16} aria-hidden /> Approved on {formatDate(deal.approved.at)}. Read-only.
            </p>
            <DeliveryNote deal={deal} onRetry={onRetryDelivery} />
          </>
        ) : (
          <>
            <p className="muted small">
              {missing > 0
                ? `${missing} ${missing === 1 ? 'field needs' : 'fields need'} a value before approval.`
                : 'Approve after checking all values against the documents.'}
              {flagged.size > 0 &&
                ` The final check asks you to look again at ${flagged.size} ${flagged.size === 1 ? 'field' : 'fields'}.`}
            </p>
            <button
              className="btn btn-primary btn-block"
              disabled={!deal.canApprove}
              onClick={() => leaveEdit(onApprove)}
            >
              Approve deal
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function DeliveryNote({ deal, onRetry }: { deal: Deal; onRetry: () => void }) {
  const delivery = deal.delivery;
  if (!delivery) return null;
  const sent = (
    <a href={`/api/deals/${deal.id}/export`} target="_blank" rel="noreferrer">
      View the message
    </a>
  );

  if (delivery.status === 'delivered' && delivery.deliveredAt) {
    return (
      <p className="muted small">
        Sent to the downstream system on {formatDateTime(delivery.deliveredAt)}. {sent}
      </p>
    );
  }
  return (
    <div className="delivery-failed">
      <p className="small">
        <strong>Not yet sent to the downstream system.</strong> {delivery.error} The approval is saved and can be sent
        again. {sent}
      </p>
      <button className="btn btn-small" onClick={onRetry}>
        Send again
      </button>
    </div>
  );
}
