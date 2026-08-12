-- The refunds queue.

CREATE TABLE IF NOT EXISTS refunds (
  id            TEXT PRIMARY KEY,
  customer      TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'GBP',
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by  TEXT NOT NULL,
  requested_at  TEXT NOT NULL,
  decided_by    TEXT,
  decided_at    TEXT,
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds (status, requested_at);
