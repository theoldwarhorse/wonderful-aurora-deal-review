// One field in the panel: its label and value, and when selected its source, confidence and an edit box.
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Deal, Field, Point } from '../api';

// Each action resolves to true when the server accepted it.
export type FieldActions = {
  save: (field: Field, value: string) => Promise<boolean>;
  markNotInDocuments: (field: Field) => Promise<boolean>;
  undo: (field: Field) => Promise<boolean>;
  markChecked: (point: Point) => Promise<boolean>;
};

type RowProps = {
  field: Field;
  deal: Deal;
  points: Point[]; // what a final check raised on this field
  selected: boolean;
  readOnly: boolean;
  draft: string | null; // what has been typed into this field's box; null when nothing has
  nudge: number;
  actions: FieldActions;
  onDraft: (text: string | null) => void;
  onSelect: () => void;
  onOpenSource: (source: Field['source']) => void;
};

export function FieldRow({
  field,
  deal,
  points,
  selected,
  readOnly,
  draft,
  nudge,
  actions,
  onDraft,
  onSelect,
  onOpenSource,
}: RowProps) {
  const input = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const [saving, setSaving] = useState(false);
  const warned = draft !== null && nudge > 0;

  // The unsaved edit may be scrolled out of sight when the reviewer clicks elsewhere.
  useEffect(() => {
    if (!warned) return;
    input.current?.scrollIntoView({ block: 'nearest' });
    input.current?.focus();
  }, [warned, nudge]);

  // When the edit box closes it takes keyboard focus with it. Put focus back on the field,
  // unless the reviewer has already moved it somewhere else.
  useEffect(() => {
    if (wasEditing.current && draft === null && document.activeElement === document.body) head.current?.focus();
    wasEditing.current = draft !== null;
  }, [draft]);

  const { state, value, source } = field;
  const open = points.filter((point) => !point.checkedAt);

  // "Facility Agreement, page 4, cl. 24", as a link that shows that page.
  function sourceLink(from: Field['source']) {
    const doc = from && deal.documents.find((d) => d.id === from.documentId);
    if (!doc) return null;
    return (
      <button className="link source-link" title="Show this page" onClick={() => onOpenSource(from)}>
        {[doc.title, from.page ? `page ${from.page}` : 'page not given, check the document', from.clause]
          .filter(Boolean)
          .join(', ')}
      </button>
    );
  }

  // A selected field is edited where it stands: the box holds the value, and Save appears once it differs.
  const editable = selected && !readOnly;
  const changed = draft !== null && draft.trim() !== (value ?? '');

  async function save() {
    if (!changed || draft.trim() === '' || saving) return;
    setSaving(true);
    const saved = await actions.save(field, draft);
    setSaving(false);
    if (saved) onDraft(null); // on failure the text stays so it can be tried again
  }

  return (
    <div className={`field ${selected ? 'is-selected' : ''} state-${state}`}>
      <button ref={head} className="field-head" aria-expanded={selected} onClick={onSelect}>
        <span className="field-label">{field.label}</span>
        <ChevronDown size={14} className={`field-chevron ${selected ? 'is-open' : ''}`} aria-hidden />
        {!editable && (
          <span className={`field-value ${value === null ? 'is-empty' : ''}`}>
            {value ?? (state === 'missing' ? 'Needs a value' : 'Not in the documents')}
          </span>
        )}
        {state === 'edited' && <span className="field-state">Edited</span>}
        {open.length > 0 && <span className="field-state point-flag">Check again</span>}
      </button>

      {selected && (
        <div className="field-detail">
          {points.map((point) => (
            <div key={point.id} className={`point ${point.checkedAt ? 'is-checked' : ''}`}>
              <p className="point-title">
                {point.checkedAt ? 'Checked' : 'Check again'} · {point.raisedBy}
              </p>
              <p>{point.reason}</p>
              {sourceLink(point.source)}
              {!point.checkedAt && !readOnly && (
                <button className="btn btn-small" onClick={() => actions.markChecked(point)}>
                  Mark as checked
                </button>
              )}
            </div>
          ))}

          {editable && (
            <form
              className="edit"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                ref={input}
                aria-label={`${field.label}, value`}
                placeholder={state === 'missing' ? 'Type the value from the documents' : 'Not in the documents'}
                value={draft ?? value ?? ''}
                onChange={(e) => onDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onDraft(null)}
              />
              {changed && (
                <>
                  <button type="submit" className="btn btn-primary btn-small" disabled={draft.trim() === '' || saving}>
                    Save
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => onDraft(null)}>
                    Cancel
                  </button>
                </>
              )}
              {warned && (
                <p className="error" role="alert">
                  Save or cancel this change before moving on.
                </p>
              )}
            </form>
          )}

          <dl>
            <dt>Source</dt>
            <dd>{sourceLink(source) ?? 'No source reference. Check the documents.'}</dd>
            {field.confidence && (
              <>
                <dt>Confidence</dt>
                <dd className="capitalise">{field.confidence}</dd>
              </>
            )}
            {state !== 'extracted' && field.extractedValue !== null && (
              <>
                <dt>Extracted</dt>
                <dd>
                  <s>{field.extractedValue}</s>
                </dd>
              </>
            )}
          </dl>

          {editable && !changed && (
            <div className="field-actions">
              {state !== 'not-in-documents' && (
                <button className="btn btn-small" onClick={() => actions.markNotInDocuments(field)}>
                  Not in the documents
                </button>
              )}
              {(state === 'edited' || state === 'not-in-documents') && (
                <button className="btn btn-small btn-quiet" onClick={() => actions.undo(field)}>
                  Undo change
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
