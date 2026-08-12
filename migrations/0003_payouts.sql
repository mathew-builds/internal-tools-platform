-- The payout approvals queue.

CREATE TABLE IF NOT EXISTS payouts (
  id            TEXT PRIMARY KEY,
  recipient     TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'GBP',
  reference     TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by  TEXT NOT NULL,
  requested_at  TEXT NOT NULL,
  decided_by    TEXT,
  decided_at    TEXT,
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts (status, requested_at);
