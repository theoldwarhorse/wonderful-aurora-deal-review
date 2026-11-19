import type { DealStatus } from '../api';

const STATUS = { 'to-review': 'To review', 'in-review': 'In review', approved: 'Approved' };

export function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="status-dot" aria-hidden />
      {STATUS[status]}
    </span>
  );
}
