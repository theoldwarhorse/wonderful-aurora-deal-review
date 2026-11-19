import { useState } from 'react';
import { AdminActivity } from './AdminActivity';
import { AdminAgents } from './AdminAgents';
import { AdminFields } from './AdminFields';

type Tab = 'fields' | 'activity' | 'agents';

export function Admin() {
  const [tab, setTab] = useState<Tab>('fields');
  return (
    <main className="page admin">
      <div className="page-head">
        <h1>Admin</h1>
      </div>

      <div className="page-toolbar">
        <div className="tabs" role="group" aria-label="Admin section">
          <button className="tab" aria-pressed={tab === 'fields'} onClick={() => setTab('fields')}>
            Fields
          </button>
          <button className="tab" aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity
          </button>
          <button className="tab" aria-pressed={tab === 'agents'} onClick={() => setTab('agents')}>
            AI agents
          </button>
        </div>
      </div>

      {tab === 'fields' ? <AdminFields /> : tab === 'activity' ? <AdminActivity /> : <AdminAgents />}
    </main>
  );
}
