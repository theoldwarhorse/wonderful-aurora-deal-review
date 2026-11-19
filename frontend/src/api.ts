// The only place the frontend talks to the backend. Every rule (field state,
// counts, whether a deal can be approved) is computed by the API and arrives
// ready to display.

export type FieldState = 'extracted' | 'edited' | 'missing' | 'not-in-documents';
export type DealStatus = 'to-review' | 'in-review' | 'approved';
export type DocumentType = 'agreement' | 'schedule' | 'amendment' | 'supporting';

export type Field = {
  id: string;
  group: string;
  label: string;
  value: string | null; // the value as it stands after review
  extractedValue: string | null; // what the agent returned; never changes
  state: FieldState;
  confidence: 'high' | 'medium' | 'low' | null;
  source: { documentId: string; page: number | null; clause: string | null } | null;
};

// Something a checking agent has asked the deal manager to look at again before approving.
// Advice only: it never changes a value, and only the deal manager can mark it checked.
export type Point = {
  id: number;
  fieldId: string;
  reason: string;
  source: Field['source'];
  raisedBy: string;
  raisedAt: string;
  checkedAt: string | null;
};

export type DealDocument = {
  id: string;
  short: string; // "FA", used in compact source references
  title: string;
  type: DocumentType;
  dated: string | null;
  file: string;
};

export type Delivery = {
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  error: string | null;
  deliveredAt: string | null;
};

export type DealSummary = {
  id: string;
  name: string;
  borrower: string;
  facility: string | null;
  receivedAt: string;
  awaitingExtraction: boolean;
  status: DealStatus;
  approved: { at: string; by: string } | null;
  summary: Record<FieldState | 'total', number>;
  canApprove: boolean;
  reviewStartedAt: string | null;
  fieldsOpened: number; // fields whose details were opened during the review
  pointsOpen: number; // points from a final check not yet marked as checked
  delivery: Delivery | null;
  documentCount: number;
};

export type Deal = Omit<DealSummary, 'documentCount'> & { documents: DealDocument[]; fields: Field[]; points: Point[] };

// There is no sign-in. `title` is the job title everything is recorded under.
export type Me = { title: string; demoMode: boolean };

export type FieldDefinition = {
  id: string;
  group: string;
  label: string;
  active: boolean;
  createdAt: string;
  retiredAt: string | null;
};
// `version` goes up by one with every change, and is sent downstream with each approved deal.
export type FieldList = { version: number; fields: FieldDefinition[] };

export type Activity = {
  deals: Record<DealStatus | 'total', number>;
  // `edited` is `corrected` (the agent's value was wrong) plus `filled` (the agent found none).
  approvedValues: Record<'total' | 'extracted' | 'edited' | 'not-in-documents' | 'corrected' | 'filled', number>;
  mostChanged: { id: string; label: string; deals: number }[];
  coverage: {
    id: string;
    name: string;
    status: DealStatus;
    fieldsOpened: number;
    fieldsTotal: number;
    documentsViewed: number;
    documentsTotal: number;
    valuesChanged: number;
    firstOpened: string | null;
    minutesWaiting: number | null; // received to first opened
    minutesToApprove: number | null;
  }[];
  recent: {
    action: string;
    actor: string;
    at: string;
    dealId: string | null;
    dealName: string | null;
    fieldLabel: string | null;
    oldValue: string | null;
    newValue: string | null;
  }[];
};

// How an AI agent connects. `token` is null outside demo mode, where it is never sent to the page.
export type AgentAccess = { token: string | null; tools: { name: string; description: string }[] };

// What to tell the reviewer when a request fails.
export const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : 'Something went wrong.');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new Error('The review service could not be reached.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `The request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const field = (dealId: string, fieldId: string) => `/deals/${dealId}/fields/${fieldId}`;

export const api = {
  me: () => request<Me>('/me'),
  listDeals: () => request<DealSummary[]>('/deals'),
  getDeal: (id: string) => request<Deal>(`/deals/${id}`),
  createDeal: (form: FormData) => request<Deal>('/deals', { method: 'POST', body: form }),
  saveValue: (dealId: string, fieldId: string, value: string) =>
    request<Deal>(field(dealId, fieldId), json('PUT', { value })),
  markNotInDocuments: (dealId: string, fieldId: string) =>
    request<Deal>(field(dealId, fieldId), json('PUT', { notInDocuments: true })),
  undo: (dealId: string, fieldId: string) => request<Deal>(`${field(dealId, fieldId)}/edit`, json('DELETE')),
  markPointChecked: (dealId: string, pointId: number) =>
    request<Deal>(`/deals/${dealId}/points/${pointId}/checked`, json('POST')),
  approve: (dealId: string) => request<Deal>(`/deals/${dealId}/approval`, json('POST')),
  retryDelivery: (dealId: string) => request<Deal>(`/deals/${dealId}/delivery`, json('POST')),
  reset: () => request<{ reset: boolean }>('/reset', json('POST')),
  // Records what a reviewer opened. It must never get in the way, so a failure is ignored.
  track: (
    dealId: string,
    event: 'deal-opened' | 'document-viewed' | 'field-viewed',
    about: { fieldId?: string; documentId?: string } = {},
  ) => request<void>(`/deals/${dealId}/events`, json('POST', { event, ...about })).catch(() => {}),
  adminFields: () => request<FieldList>('/admin/fields'),
  addField: (label: string, group: string) => request<FieldList>('/admin/fields', json('POST', { label, group })),
  updateField: (id: string, change: { label?: string; group?: string; active?: boolean }) =>
    request<FieldList>(`/admin/fields/${id}`, json('PATCH', change)),
  activity: () => request<Activity>('/admin/activity'),
  agentAccess: () => request<AgentAccess>('/admin/agents'),
  // Goes through the agents' own door, the MCP server, exactly as an agent would. Resolves to the number of deals it was shown.
  async askAsAgent(token: string): Promise<number> {
    const response = await fetch('/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_deals', arguments: {} },
      }),
    });
    const answer = await response.json().catch(() => null);
    if (!response.ok || !answer?.result || answer.result.isError)
      throw new Error('The agent connection did not answer.');
    return answer.result.content.length; // one item per deal
  },
};
