import { appendAudit } from "./audit.ts";
import { db, withTransaction, type Tx } from "./db.ts";
import type { Role, User } from "./users.ts";

type SeedUser = { id: string; name: string; email: string; role: Role };

type SeedRefund = {
  id: string;
  customer: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  decided_by?: string;
  decision_note?: string;
};

export const SEED_USERS: SeedUser[] = [
  { id: "u_rita", name: "Rita Ruiz", email: "rita@example.com", role: "requester" },
  { id: "u_amir", name: "Amir Aslan", email: "amir@example.com", role: "approver" },
  { id: "u_olive", name: "Olive Okonkwo", email: "olive@example.com", role: "auditor" },
];

/**
 * Fixed demo rows. Two of them are load-bearing:
 *
 * - `rf_003` is pending and requested by the APPROVER, so it is the record that
 *   reaches `assertDifferentActor` when that approver presses Approve.
 * - `rf_001` is pending and requested by someone else: the control that proves a
 *   refusal on `rf_003` came from maker-checker and not from a broken path.
 */
export const SEED_REFUNDS: SeedRefund[] = [
  {
    id: "rf_001",
    customer: "Northwind Traders",
    amount_cents: 12_450,
    currency: "GBP",
    reason: "Duplicate charge on invoice NW-8841",
    status: "pending",
    requested_by: "u_rita",
  },
  {
    id: "rf_002",
    customer: "Contoso Ltd",
    amount_cents: 4_900,
    currency: "GBP",
    reason: "Order cancelled before dispatch",
    status: "pending",
    requested_by: "u_rita",
  },
  {
    id: "rf_003",
    customer: "Fabrikam Retail",
    amount_cents: 31_000,
    currency: "GBP",
    reason: "Goodwill credit agreed on support call",
    status: "pending",
    requested_by: "u_amir",
  },
  {
    id: "rf_004",
    customer: "Tailspin Toys",
    amount_cents: 8_725,
    currency: "GBP",
    reason: "Faulty item returned, refund agreed",
    status: "pending",
    requested_by: "u_amir",
  },
  {
    id: "rf_005",
    customer: "Adventure Works",
    amount_cents: 2_300,
    currency: "GBP",
    reason: "Shipping overcharge",
    status: "pending",
    requested_by: "u_rita",
  },
  {
    id: "rf_006",
    customer: "Proseware Inc",
    amount_cents: 56_000,
    currency: "GBP",
    reason: "Service credit for outage on 3 March",
    status: "approved",
    requested_by: "u_rita",
    decided_by: "u_amir",
    decision_note: "Outage confirmed in incident log INC-204.",
  },
  {
    id: "rf_007",
    customer: "Litware Group",
    amount_cents: 19_900,
    currency: "GBP",
    reason: "Customer claims non-delivery",
    status: "rejected",
    requested_by: "u_rita",
    decided_by: "u_amir",
    decision_note: "Carrier proof of delivery on file; refund declined.",
  },
  {
    id: "rf_008",
    customer: "Wide World Importers",
    amount_cents: 7_150,
    currency: "GBP",
    reason: "Price-match adjustment",
    status: "approved",
    requested_by: "u_amir",
    decided_by: "u_rita",
    decision_note: "Adjustment agreed with commercial team.",
  },
];

let seeded = false;

function seedUsers(tx: Tx): void {
  const insert = tx.prepare(
    "INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
  );
  for (const user of SEED_USERS) {
    insert.run(user.id, user.name, user.email, user.role);
  }
}

function seedRefunds(tx: Tx): void {
  const insert = tx.prepare(
    `INSERT INTO refunds
       (id, customer, amount_cents, currency, reason, status,
        requested_by, requested_at, decided_by, decided_at, decision_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const exists = tx.prepare("SELECT id FROM refunds WHERE id = ?");

  // Fixed timestamps keep the demo stable and the audit rows ordered.
  const day = (n: number) => `2026-03-${String(n).padStart(2, "0")}T09:00:00.000Z`;

  SEED_REFUNDS.forEach((refund, index) => {
    if (exists.get(refund.id)) return;

    const requestedAt = day(index + 1);
    insert.run(
      refund.id,
      refund.customer,
      refund.amount_cents,
      refund.currency,
      refund.reason,
      refund.status,
      refund.requested_by,
      requestedAt,
      refund.decided_by ?? null,
      refund.decided_by ? day(index + 2) : null,
      refund.decision_note ?? null,
    );

    // Seeded rows get their audit trail through the same appendAudit the
    // actions use: a request row for every record, plus its decision row.
    appendAudit(
      {
        actor: refund.requested_by,
        action: "refund.requested",
        entity: "refund",
        entityId: refund.id,
        payload: {
          customer: refund.customer,
          amount_cents: refund.amount_cents,
          currency: refund.currency,
          reason: refund.reason,
          seeded: true,
        },
      },
      tx,
    );

    if (refund.decided_by && refund.status !== "pending") {
      appendAudit(
        {
          actor: refund.decided_by,
          action: refund.status === "approved" ? "refund.approved" : "refund.rejected",
          entity: "refund",
          entityId: refund.id,
          payload: { note: refund.decision_note ?? null, seeded: true },
        },
        tx,
      );
    }
  });
}

/**
 * Seeds users and demo refunds on first boot. Idempotent: fixed ids, insert only
 * what is missing, safe on every dev-server reload.
 */
export function ensureSeeded(): void {
  if (seeded) return;

  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  const refunds = db.prepare("SELECT COUNT(*) AS n FROM refunds").get() as { n: number };
  if (users.n >= SEED_USERS.length && refunds.n >= SEED_REFUNDS.length) {
    seeded = true;
    return;
  }

  withTransaction((tx) => {
    seedUsers(tx);
    seedRefunds(tx);
  });
  seeded = true;
}

export const SEEDED_MAKER_CHECKER_REFUND_ID = "rf_003";
export const SEEDED_CONTROL_REFUND_ID = "rf_001";

export type { User };
