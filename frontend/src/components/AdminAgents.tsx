// The AI agents tab of the Admin page: the final check an agent can run on a deal, and how to connect one.
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { api, messageOf } from '../api';
import { useLoad } from '../useLoad';

function CopyButton({ text, what }: { text: string; what: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-small"
      aria-label={`Copy ${what}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function AdminAgents() {
  const { data, error } = useLoad(api.agentAccess, 'admin-agents');
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data)
    return (
      <p className="page-empty" role={error ? 'alert' : 'status'}>
        {error || 'Loading…'}
      </p>
    );

  const address = `${location.origin}/mcp`;
  const token = data.token ?? '<token>';
  const command = `claude mcp add --transport http aurora-deals ${address} --header "Authorization: Bearer ${token}"`;

  async function test() {
    try {
      const seen = await api.askAsAgent(token);
      setCheck({ ok: true, text: `Connected. An agent can see ${seen} ${seen === 1 ? 'deal' : 'deals'}.` });
    } catch (failure) {
      setCheck({ ok: false, text: messageOf(failure) });
    }
  }

  return (
    <div className="report agents">
      <h2>A final check by an AI agent</h2>
      <p>
        Before approval, a connected agent can point the deal manager at fields worth a second look. It advises; the
        deal manager decides.
      </p>

      <div className="connect">
        <code>{command}</code>
        <CopyButton text={command} what="the command" />
      </div>
      {data.token && (
        <p className="connect-test">
          <button className="btn" onClick={test}>
            Test the connection
          </button>
          {check && (
            <span className={check.ok ? 'approved-note' : 'error'} role="status">
              {check.ok && <Check size={16} aria-hidden />} {check.text}
            </span>
          )}
        </p>
      )}

      <section>
        <h2>How it works</h2>
        <ul className="uses">
          <li>
            <strong>The agent</strong> raises a point on a field, with its reason and the page to look at.
          </li>
          <li>
            <strong>The deal manager</strong> sees “Check again”, looks, and marks it checked. Open points are listed
            before approval.
          </li>
          <li>
            <strong>The agent cannot</strong> change a value, clear a deal, or approve.
          </li>
        </ul>
      </section>

      <section>
        <h2>What a connected agent can do</h2>
        <table className="data-table">
          <tbody>
            {data.tools.map((tool) => (
              <tr key={tool.name}>
                <th scope="row">
                  <code>{tool.name}</code>
                </th>
                {/* The first line of each description is its summary. */}
                <td>{tool.description.split('\n')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
