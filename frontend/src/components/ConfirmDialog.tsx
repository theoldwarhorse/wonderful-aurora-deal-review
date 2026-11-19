import { useEffect, useRef, useState } from 'react';
import type { Deal } from '../api';

// onConfirm resolves to null when the deal was approved, or to the reason it was not.
type Props = { deal: Deal; onCancel: () => void; onConfirm: () => Promise<string | null> };

export function ConfirmDialog({ deal, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const counts = deal.summary;
  const edited = deal.fields.filter((f) => f.state === 'edited');
  const absent = deal.fields.filter((f) => f.state === 'not-in-documents');
  const unchecked = deal.points.filter((point) => !point.checkedAt);

  async function confirm() {
    if (approving) return;
    setApproving(true);
    setError('');
    const failure = await onConfirm();
    // On success the dialog has been closed by its owner; only a failure brings us back here.
    if (failure) {
      setError(failure);
      setApproving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      onClose={onCancel}
      // Once the approval has been sent it cannot be called back, so the summary stays until it is answered.
      onCancel={(event) => {
        if (approving) event.preventDefault();
      }}
    >
      <h2 id="confirm-title">Approve {deal.name}?</h2>
      <p className="muted">
        {counts.total} fields will be released for capture: {counts.extracted} as extracted, {counts.edited} edited,{' '}
        {counts['not-in-documents']} marked not in the documents.
      </p>

      {edited.length > 0 && (
        <>
          <h3 className="group-title">Edited</h3>
          <table className="change-table">
            <tbody>
              {edited.map((f) => (
                <tr key={f.id}>
                  <th scope="row">{f.label}</th>
                  <td>
                    {f.extractedValue === null ? (
                      <span className="muted">Not extracted</span>
                    ) : (
                      <s>{f.extractedValue}</s>
                    )}
                  </td>
                  <td>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {absent.length > 0 && (
        <>
          <h3 className="group-title">Not in the documents</h3>
          <p>{absent.map((f) => f.label).join(', ')}</p>
        </>
      )}

      {unchecked.length > 0 && (
        <>
          <h3 className="group-title">Raised by the final check, not yet marked as checked</h3>
          <ul className="unchecked-points">
            {unchecked.map((point) => (
              <li key={point.id}>
                <strong>{deal.fields.find((f) => f.id === point.fieldId)?.label ?? point.fieldId}.</strong>{' '}
                {point.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="muted small">
        {deal.fieldsOpened} of {counts.total} fields were opened during this review.
      </p>
      <p className="note">After approval the deal is read-only and its values are sent to the downstream system.</p>
      {error && (
        <p className="error" role="alert">
          The deal was not approved. {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn" disabled={approving} onClick={onCancel}>
          Keep reviewing
        </button>
        <button className="btn btn-primary" disabled={approving} onClick={confirm}>
          {approving ? 'Approving…' : 'Approve deal'}
        </button>
      </div>
    </dialog>
  );
}
