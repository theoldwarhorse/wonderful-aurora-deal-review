// The Fields tab of the Admin page: the list of fields to extract, and the controls to change it.
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { api, messageOf, type FieldDefinition, type FieldList } from '../api';
import { formatDateTime } from '../format';
import { useLoad } from '../useLoad';
import { FieldDialog } from './FieldDialog';

const NEW_GROUP = '__new__';

// One field, edited where it stands: type a new name, pick another group, or switch it off.
function FieldRow({
  field,
  groups,
  onChange,
  onNewGroup,
}: {
  field: FieldDefinition;
  groups: string[];
  onChange: (change: { label?: string; group?: string; active?: boolean }) => Promise<boolean>;
  onNewGroup: () => void;
}) {
  const [label, setLabel] = useState(field.label);

  // Saved on leaving the box or pressing Enter. An empty or refused name goes back to what it was.
  async function rename() {
    const wanted = label.trim();
    if (wanted === field.label) return setLabel(field.label);
    if (!wanted || !(await onChange({ label: wanted }))) setLabel(field.label);
  }

  return (
    <tr className={field.active ? '' : 'is-retired'}>
      <td>
        <input
          className="inline-edit"
          aria-label={`Name of ${field.label}`}
          disabled={!field.active}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setLabel(field.label);
          }}
        />
      </td>
      <td>
        <select
          className="inline-edit"
          aria-label={`Group of ${field.label}`}
          disabled={!field.active}
          value={field.group}
          onChange={(e) => (e.target.value === NEW_GROUP ? onNewGroup() : onChange({ group: e.target.value }))}
        >
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
          <option value={NEW_GROUP}>New group…</option>
        </select>
      </td>
      <td>
        <button
          className="switch"
          role="switch"
          aria-checked={field.active}
          aria-label={`${field.label} is extracted`}
          onClick={() => onChange({ active: !field.active })}
        >
          <span className="switch-track" aria-hidden />
          {field.retiredAt ? `Retired ${formatDateTime(field.retiredAt)}` : 'Active'}
        </button>
      </td>
    </tr>
  );
}

export function AdminFields() {
  const { data: list, error: loadError, setData } = useLoad(api.adminFields, 'admin-fields');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FieldDefinition | 'new' | null>(null);
  const [error, setError] = useState('');

  // Every change returns the whole list as the server now has it.
  async function apply(change: Promise<FieldList>) {
    try {
      setData(await change);
      setError('');
      return true;
    } catch (failure) {
      setError(messageOf(failure));
      return false;
    }
  }

  async function save(label: string, group: string) {
    const change = editing === 'new' ? api.addField(label, group) : api.updateField(editing!.id, { label, group });
    if (await apply(change)) setEditing(null);
  }

  if (!list)
    return (
      <p className="page-empty" role={loadError ? 'alert' : 'status'}>
        {loadError || 'Loading fields…'}
      </p>
    );
  const { fields, version } = list;
  const groups = [...new Set(fields.map((f) => f.group))];
  const wanted = query.trim().toLowerCase();
  const shown = fields.filter((f) => `${f.label} ${f.group}`.toLowerCase().includes(wanted));

  return (
    <section>
      <div className="search-row">
        <div className="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            aria-label="Search fields"
            placeholder="Search by field or group"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="page-total muted small" aria-live="polite">
          {shown.length === fields.length ? `${fields.length} fields` : `${shown.length} of ${fields.length} fields`} ·
          version {version}
        </span>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden /> Add field
        </button>
      </div>
      {error && !editing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="page-empty">No fields match “{query.trim()}”.</p>
      ) : (
        <table className="data-table fields-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Group</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                groups={groups}
                onChange={(change) => apply(api.updateField(field.id, change))}
                onNewGroup={() => setEditing(field)}
              />
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <FieldDialog
          field={editing === 'new' ? undefined : editing}
          toNewGroup={editing !== 'new'}
          groups={groups}
          error={error}
          onClose={() => {
            setEditing(null);
            setError('');
          }}
          onSave={save}
        />
      )}
    </section>
  );
}
