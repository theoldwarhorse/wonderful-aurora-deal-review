// Adds a field to the list, or changes the label and group of one already on it.
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FieldDefinition } from '../api';

const NEW_GROUP = '__new__';

export function FieldDialog({
  field,
  toNewGroup,
  groups,
  error,
  onClose,
  onSave,
}: {
  field?: FieldDefinition; // absent when adding
  toNewGroup?: boolean; // open on a new group, for a field being moved to one
  groups: string[];
  error: string;
  onClose: () => void;
  onSave: (label: string, group: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(field?.label ?? '');
  const [group, setGroup] = useState(toNewGroup ? NEW_GROUP : (field?.group ?? groups[0] ?? NEW_GROUP));
  const [newGroup, setNewGroup] = useState('');

  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector('input')?.focus();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(label, group === NEW_GROUP ? newGroup : group);
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="field-dialog-title">
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="field-dialog-title">{field ? 'Move to a new group' : 'Add field'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="form-row">
          <span>Name</span>
          <input
            required
            pattern=".*\S.*"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="For example, Hedging requirement"
          />
        </label>
        <label className="form-row">
          <span>Group</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
            <option value={NEW_GROUP}>New group…</option>
          </select>
        </label>
        {group === NEW_GROUP && (
          <label className="form-row">
            <span>New group name</span>
            <input required pattern=".*\S.*" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
          </label>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {field ? 'Save' : 'Add field'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
