import { FileText, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, messageOf, type Deal, type DocumentType } from '../api';

const TYPES: [DocumentType, string][] = [
  ['agreement', 'Original agreement'],
  ['schedule', 'Schedule'],
  ['amendment', 'Amendment'],
  ['supporting', 'Supporting document'],
];

function guessType(name: string): DocumentType {
  if (/amend/i.test(name)) return 'amendment';
  if (/sched/i.test(name)) return 'schedule';
  if (/agreement/i.test(name)) return 'agreement';
  return 'supporting';
}

export function NewDealDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (deal: Deal) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [borrower, setBorrower] = useState('');
  const [docs, setDocs] = useState<{ file: File; type: DocumentType }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector('input')?.focus();
  }, []);

  function addFiles(list: FileList | null) {
    const chosen = [...(list ?? [])];
    const pdfs = chosen.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    setError(pdfs.length < chosen.length ? 'Only PDF files can be added.' : '');
    setDocs((d) => [...d, ...pdfs.map((file) => ({ file, type: guessType(file.name) }))]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (docs.length === 0) return setError('Add at least one PDF.');

    const form = new FormData();
    form.append('name', name);
    form.append('borrower', borrower);
    for (const doc of docs) {
      form.append('files', doc.file);
      form.append('types', doc.type);
    }
    setSaving(true);
    try {
      onCreated(await api.createDeal(form));
    } catch (failure) {
      setError(messageOf(failure));
      setSaving(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="new-deal-title">
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="new-deal-title">New deal</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="form-row">
          <span>Deal name</span>
          <input
            required
            pattern=".*\S.*"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
          />
        </label>
        <label className="form-row">
          <span>Borrower</span>
          <input
            required
            pattern=".*\S.*"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            placeholder="Legal name of the borrower"
          />
        </label>
        <div className="form-row">
          <span>Documents</span>
          <div className="upload-control">
            {/* The browser's own file control cannot be styled and reports "no file chosen" once its
                files have been taken, so it is hidden and this button stands in for it. */}
            <label className="btn">
              <Upload size={15} aria-hidden /> Add PDFs
              <input
                className="visually-hidden"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <span className="muted" aria-live="polite">
              {docs.length === 0
                ? 'No documents added yet'
                : `${docs.length} ${docs.length === 1 ? 'document' : 'documents'} added`}
            </span>
          </div>
        </div>

        {docs.length > 0 && (
          <ul className="upload-list">
            {docs.map((doc, i) => (
              <li key={i}>
                <FileText size={16} className="muted" aria-hidden />
                <span className="upload-name">{doc.file.name}</span>
                <select
                  aria-label={`Document type for ${doc.file.name}`}
                  value={doc.type}
                  onChange={(e) =>
                    setDocs(docs.map((d, j) => (j === i ? { ...d, type: e.target.value as DocumentType } : d)))
                  }
                >
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${doc.file.name}`}
                  onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create deal'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
