-- The fields the extraction agent is asked for. Managed in the admin screen.
CREATE TABLE IF NOT EXISTS field_definitions (
  id          TEXT PRIMARY KEY,                    -- the key the extraction service uses; never changes
  field_group TEXT NOT NULL,
  label       TEXT NOT NULL,
  position    INT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at  TIMESTAMPTZ                          -- retired, not deleted, so extracted values are kept
);

CREATE TABLE IF NOT EXISTS deals (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  borrower           TEXT NOT NULL,
  facility           TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  extraction_received BOOLEAN NOT NULL DEFAULT false,
  review_started_at  TIMESTAMPTZ,   -- set once and never cleared; the extraction is locked from here
  approved_at        TIMESTAMPTZ,
  approved_by        TEXT,
  approved_fields    JSONB          -- the fields exactly as approved; an approved deal is read from this
);

CREATE TABLE IF NOT EXISTS documents (
  deal_id   TEXT NOT NULL REFERENCES deals ON DELETE CASCADE,
  id        TEXT NOT NULL,
  position  INT  NOT NULL,
  short     TEXT NOT NULL,
  title     TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('agreement', 'schedule', 'amendment', 'supporting')),
  dated     TEXT,
  path      TEXT NOT NULL,           -- relative to the documents directory
  PRIMARY KEY (deal_id, id)
);

-- What the extraction agent returned. Never updated by a review.
CREATE TABLE IF NOT EXISTS extracted_fields (
  deal_id            TEXT NOT NULL REFERENCES deals ON DELETE CASCADE,
  field_id           TEXT NOT NULL,
  value              TEXT,
  confidence         TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  source_document_id TEXT,
  source_page        INT,
  source_clause      TEXT,
  PRIMARY KEY (deal_id, field_id)
);

-- The deal manager's current change to a field. No row means the extracted value stands.
CREATE TABLE IF NOT EXISTS field_edits (
  deal_id          TEXT NOT NULL REFERENCES deals ON DELETE CASCADE,
  field_id         TEXT NOT NULL,
  value            TEXT,
  not_in_documents BOOLEAN NOT NULL DEFAULT false,
  edited_by        TEXT NOT NULL,
  edited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, field_id),
  CHECK ((value IS NOT NULL) <> not_in_documents)
);

-- Points a checking agent asks the deal manager to look at again before approving.
-- Advice only: a point never changes a value and never holds up approval.
CREATE TABLE IF NOT EXISTS points_to_check (
  id                 BIGSERIAL PRIMARY KEY,
  deal_id            TEXT NOT NULL REFERENCES deals ON DELETE CASCADE,
  field_id           TEXT NOT NULL,
  reason             TEXT NOT NULL,
  source_document_id TEXT,           -- where to look, when the agent can say
  source_page        INT,
  source_clause      TEXT,
  raised_by          TEXT NOT NULL,
  raised_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by         TEXT,           -- set by the deal manager, never by an agent
  checked_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS points_to_check_by_deal ON points_to_check (deal_id, id);

-- Append-only record of every change and approval.
CREATE TABLE IF NOT EXISTS audit_log (
  id        BIGSERIAL PRIMARY KEY,
  deal_id   TEXT REFERENCES deals ON DELETE CASCADE,   -- null for changes to the field list
  field_id  TEXT,
  action    TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  actor     TEXT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_by_deal ON audit_log (deal_id, id);

-- What reviewers opened: deals, documents, and the details of individual fields.
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  deal_id     TEXT NOT NULL REFERENCES deals ON DELETE CASCADE,
  event       TEXT NOT NULL CHECK (event IN ('deal-opened', 'document-viewed', 'field-viewed')),
  field_id    TEXT,
  document_id TEXT,
  actor       TEXT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_by_deal ON usage_events (deal_id, event);

-- Messages for the downstream system. A row is written in the same transaction as
-- the approval, so a deal is never approved without a message, or sent unapproved.
CREATE TABLE IF NOT EXISTS outbox (
  id           UUID PRIMARY KEY,
  deal_id      TEXT NOT NULL UNIQUE REFERENCES deals ON DELETE CASCADE,
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts     INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
