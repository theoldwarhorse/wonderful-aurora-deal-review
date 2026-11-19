// The Activity tab of the Admin page: what the recorded data says about how the tool is used.
// Headline figures first, time before everything else; the audit log they come from is at the foot.
import { api, type Activity } from '../api';
import { formatDateTime } from '../format';
import { useLoad } from '../useLoad';
import { StatusBadge } from './StatusBadge';

const ACTIONS: Record<string, string> = {
  created: 'Created the deal',
  'extraction-received': 'Extraction received',
  edited: 'Changed a value',
  'marked-not-in-documents': 'Marked not in the documents',
  reverted: 'Undid a change',
  approved: 'Approved the deal',
  'point-raised': 'Asked for a second look',
  'point-checked': 'Marked a point as checked',
  'field-added': 'Added a field',
  'field-renamed': 'Renamed a field',
  'field-moved': 'Moved a field to another group',
  'field-retired': 'Retired a field',
  'field-restored': 'Restored a field',
};

// From first opening a deal to approving it.
function duration(minutes: number) {
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`;
  return count(Math.round(minutes / (60 * 24)), 'day');
}

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);

// A filled track. The number it stands for is always written beside it, so the bar itself is decoration.
function Meter({ part, whole }: { part: number; whole: number }) {
  return (
    <span className="meter" aria-hidden>
      <span style={{ width: `${whole ? (part / whole) * 100 : 0}%` }} />
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <dd className="stat-note">{note}</dd>
    </div>
  );
}

export function AdminActivity() {
  const { data, error } = useLoad(api.activity, 'admin-activity');
  if (!data)
    return (
      <p className="page-empty" role={error ? 'alert' : 'status'}>
        {error || 'Loading activity…'}
      </p>
    );
  const { deals, approvedValues: values, mostChanged, coverage, recent }: Activity = data;

  const reviewTimes = coverage.flatMap((deal) => deal.minutesToApprove ?? []);
  const waits = coverage.flatMap((deal) => deal.minutesWaiting ?? []);
  const longestReview = Math.max(1, ...reviewTimes);
  const mostDeals = Math.max(1, ...mostChanged.map((field) => field.deals));
  const changed = values.edited + values['not-in-documents'];
  const onApproved = `on ${count(deals.approved, 'approved deal')}`;

  return (
    <div className="report">
      <h2>How the tool is being used</h2>
      <p className="report-about">
        Recorded across {count(deals.total, 'deal')}: {deals['to-review']} to review, {deals['in-review']} in review,{' '}
        {deals.approved} approved.
      </p>

      <dl className="stat-grid">
        <Stat
          label="Average review time"
          value={reviewTimes.length ? duration(Math.round(sum(reviewTimes) / reviewTimes.length)) : '—'}
          note={
            reviewTimes.length
              ? `First opened to approved. ${duration(sum(reviewTimes))} in total ${onApproved}`
              : 'No deal has been approved yet'
          }
        />
        <Stat
          label="Average wait before review"
          value={waits.length ? duration(Math.round(sum(waits) / waits.length)) : '—'}
          note={
            waits.length ? `Received to first opened, on ${count(waits.length, 'deal')}` : 'No deal has been opened yet'
          }
        />
        <Stat
          label="Extracted values accepted"
          value={values.total ? percent(values.extracted, values.total) : '—'}
          note={
            values.total
              ? `${values.extracted} of ${values.total} values unchanged ${onApproved}`
              : 'No deal has been approved yet'
          }
        />
        <Stat
          label="Values changed in review"
          value={changed}
          note={`${values.corrected} corrected · ${values.filled} filled in · ${values['not-in-documents']} not in the documents`}
        />
      </dl>

      <section>
        <h2>Time on each deal</h2>
        <p className="report-about">How long each deal waited to be opened, and how long its review then took.</p>
        <ul className="deal-rows">
          {coverage.map((deal) => (
            <li key={deal.id}>
              <div>
                <a href={`#/deal/${deal.id}`}>{deal.name}</a>
                <StatusBadge status={deal.status} />
              </div>
              <div>
                <span className="figure-label">Waited before review</span>
                {deal.minutesWaiting !== null ? duration(deal.minutesWaiting) : 'Not opened yet'}
              </div>
              <div>
                <span className="figure-label">Review time</span>
                {deal.minutesToApprove !== null ? (
                  <>
                    <Meter part={deal.minutesToApprove} whole={longestReview} />
                    {duration(deal.minutesToApprove)}
                  </>
                ) : deal.firstOpened ? (
                  'In progress'
                ) : (
                  '—'
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>How the extraction held up</h2>
        <p className="report-about">
          Of the values the agent extracted {onApproved}, how many the reviewer accepted and how many they changed.
        </p>
        {values.total > 0 && (
          <div className="split" aria-hidden>
            <span style={{ flexGrow: values.extracted }} />
            {changed > 0 && <span className="split-changed" style={{ flexGrow: changed }} />}
          </div>
        )}
        <dl className="figures">
          <div>
            <dt>Accepted as extracted</dt>
            <dd>{values.extracted}</dd>
          </div>
          <div>
            <dt>Wrong values corrected</dt>
            <dd>{values.corrected}</dd>
          </div>
          <div>
            <dt>Missing values filled in</dt>
            <dd>{values.filled}</dd>
          </div>
          <div>
            <dt>Marked not in the documents</dt>
            <dd>{values['not-in-documents']}</dd>
          </div>
        </dl>
        {mostChanged.length > 0 && (
          <>
            <h3>Fields changed most often</h3>
            <p className="report-about">The number of deals, open ones included, on which each field was changed.</p>
            <ul className="bar-list">
              {mostChanged.map((field) => (
                <li key={field.id}>
                  <span>{field.label}</span>
                  <Meter part={field.deals} whole={mostDeals} />
                  <span className="muted">{count(field.deals, 'deal')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>How much of each deal was opened</h2>
        <p className="report-about">
          Counted up to the moment of approval. Opening a field shows it was looked at, not that it was read.
        </p>
        <ul className="deal-rows">
          {coverage.map((deal) => (
            <li key={deal.id}>
              <div>
                <a href={`#/deal/${deal.id}`}>{deal.name}</a>
                <StatusBadge status={deal.status} />
              </div>
              <div>
                <span className="figure-label">Fields opened</span>
                <Meter part={deal.fieldsOpened} whole={deal.fieldsTotal} />
                {deal.fieldsOpened} of {deal.fieldsTotal}
              </div>
              <div>
                <span className="figure-label">Documents opened</span>
                <Meter part={deal.documentsViewed} whole={deal.documentsTotal} />
                {deal.documentsViewed} of {deal.documentsTotal}
              </div>
              <div>
                <span className="figure-label">Values changed</span>
                {deal.valuesChanged}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details className="raw-data">
        <summary>Audit log: the last {count(recent.length, 'recorded action')}</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>By</th>
              <th>What</th>
              <th>Deal</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((entry, i) => (
              <tr key={i}>
                <td>{formatDateTime(entry.at)}</td>
                <td>{entry.actor}</td>
                <td>{ACTIONS[entry.action] ?? entry.action}</td>
                <td>{entry.dealId ? <a href={`#/deal/${entry.dealId}`}>{entry.dealName}</a> : '—'}</td>
                <td>
                  {entry.fieldLabel}
                  {(entry.oldValue || entry.newValue) && (
                    <span className="change">
                      {entry.action.startsWith('point-')
                        ? (entry.newValue ?? entry.oldValue) // the point's reason
                        : `${entry.oldValue ?? 'empty'} → ${entry.newValue ?? 'empty'}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
