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

type SeedPayout = {
  id: string;
  recipient: string;
  amount_cents: number;
  currency: string;
  reference: string;
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

/**
 * Fixed demo payouts. Two of them are load-bearing, for the same reasons as in
 * the refunds queue:
 *
 * - `po_003` is pending and requested by the APPROVER, so it is the record that
 *   reaches `assertDifferentActor` when that approver presses Approve.
 * - `po_001` is pending and requested by someone else: the control that proves a
 *   refusal on `po_003` came from maker-checker and not from a broken path.
 */
export const SEED_PAYOUTS: SeedPayout[] = [
  {
    id: "po_001",
    recipient: "Bramble Logistics Ltd",
    amount_cents: 248_000,
    currency: "GBP",
    reference: "INV-2291 haulage, March",
    status: "pending",
    requested_by: "u_rita",
  },
  {
    id: "po_002",
    recipient: "Halden Design Studio",
    amount_cents: 96_500,
    currency: "GBP",
    reference: "INV-1180 brand refresh, milestone 2",
    status: "pending",
    requested_by: "u_rita",
  },
  {
    id: "po_003",
    recipient: "Kestrel Facilities",
    amount_cents: 41_250,
    currency: "GBP",
    reference: "INV-7742 cleaning contract",
    status: "pending",
    requested_by: "u_amir",
  },
  {
    id: "po_004",
    recipient: "Ovett Legal LLP",
    amount_cents: 512_000,
    currency: "GBP",
    reference: "INV-3308 advisory retainer Q1",
    status: "pending",
    requested_by: "u_amir",
  },
  {
    id: "po_005",
    recipient: "Marlow Print Co",
    amount_cents: 18_400,
    currency: "GBP",
    reference: "INV-0442 conference collateral",
    status: "approved",
    requested_by: "u_rita",
    decided_by: "u_amir",
    decision_note: "Purchase order PO-551 matched to the invoice.",
  },
  {
    id: "po_006",
    recipient: "Nine Yards Media",
    amount_cents: 133_000,
    currency: "GBP",
    reference: "INV-8814 media buying, February",
    status: "rejected",
    requested_by: "u_rita",
    decided_by: "u_amir",
    decision_note: "Bank details do not match the supplier record; resubmit.",
  },
  {
    id: "po_007",
    recipient: "Tamar Hardware",
    amount_cents: 7_900,
    currency: "GBP",
    reference: "INV-6021 workshop tooling",
    status: "approved",
    requested_by: "u_amir",
    decided_by: "u_rita",
    decision_note: "Receipts checked against the delivery note.",
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

function seedPayouts(tx: Tx): void {
  const insert = tx.prepare(
    `INSERT INTO payouts
       (id, recipient, amount_cents, currency, reference, status,
        requested_by, requested_at, decided_by, decided_at, decision_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const exists = tx.prepare("SELECT id FROM payouts WHERE id = ?");

  const day = (n: number) => `2026-03-${String(n).padStart(2, "0")}T11:30:00.000Z`;

  SEED_PAYOUTS.forEach((payout, index) => {
    if (exists.get(payout.id)) return;

    const requestedAt = day(index + 1);
    insert.run(
      payout.id,
      payout.recipient,
      payout.amount_cents,
      payout.currency,
      payout.reference,
      payout.status,
      payout.requested_by,
      requestedAt,
      payout.decided_by ?? null,
      payout.decided_by ? day(index + 2) : null,
      payout.decision_note ?? null,
    );

    appendAudit(
      {
        actor: payout.requested_by,
        action: "payout.requested",
        entity: "payout",
        entityId: payout.id,
        payload: {
          recipient: payout.recipient,
          amount_cents: payout.amount_cents,
          currency: payout.currency,
          reference: payout.reference,
          seeded: true,
        },
      },
      tx,
    );

    if (payout.decided_by && payout.status !== "pending") {
      appendAudit(
        {
          actor: payout.decided_by,
          action: payout.status === "approved" ? "payout.approved" : "payout.rejected",
          entity: "payout",
          entityId: payout.id,
          payload: { note: payout.decision_note ?? null, seeded: true },
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
  const payouts = db.prepare("SELECT COUNT(*) AS n FROM payouts").get() as { n: number };
  if (
    users.n >= SEED_USERS.length &&
    refunds.n >= SEED_REFUNDS.length &&
    payouts.n >= SEED_PAYOUTS.length
  ) {
    seeded = true;
    return;
  }

  withTransaction((tx) => {
    seedUsers(tx);
    seedRefunds(tx);
    seedPayouts(tx);
  });
  seeded = true;
}

export const SEEDED_MAKER_CHECKER_REFUND_ID = "rf_003";
export const SEEDED_CONTROL_REFUND_ID = "rf_001";

export const SEEDED_MAKER_CHECKER_PAYOUT_ID = "po_003";
export const SEEDED_CONTROL_PAYOUT_ID = "po_001";

export type { User };
