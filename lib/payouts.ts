import { randomUUID } from "node:crypto";
import { appendAudit } from "./audit.ts";
import { db, withTransaction, type Tx } from "./db.ts";
import { assertDifferentActor } from "./maker-checker.ts";
import { authorize } from "./rbac.ts";
import type { User } from "./users.ts";

export type PayoutStatus = "pending" | "approved" | "rejected";

export type Payout = {
  id: string;
  recipient: string;
  amount_cents: number;
  currency: string;
  reference: string;
  status: PayoutStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

export const ENTITY = "payout";

export const PAYOUT_STATUSES: PayoutStatus[] = ["pending", "approved", "rejected"];

export function isPayoutStatus(value: unknown): value is PayoutStatus {
  return typeof value === "string" && (PAYOUT_STATUSES as string[]).includes(value);
}

export function listPayouts(status?: PayoutStatus): Payout[] {
  const order = `ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, requested_at DESC`;

  if (status) {
    return db
      .prepare(`SELECT * FROM payouts WHERE status = ? ${order}`)
      .all(status) as unknown as Payout[];
  }
  return db.prepare(`SELECT * FROM payouts ${order}`).all() as unknown as Payout[];
}

export function getPayout(id: string, tx: Tx = db): Payout | undefined {
  return tx.prepare("SELECT * FROM payouts WHERE id = ?").get(id) as Payout | undefined;
}

export class NotFoundError extends Error {
  readonly rule = "not-found";

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class StateError extends Error {
  readonly rule = "state";

  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export type NewPayout = {
  recipient: string;
  amountCents: number;
  currency?: string;
  reference: string;
};

/**
 * Raises a payout request. Business row and audit row commit together.
 */
export function requestPayout(user: User, input: NewPayout): Payout {
  authorize(user, "request", ENTITY);

  const id = `po_${randomUUID()}`;
  const requestedAt = new Date().toISOString();
  const currency = input.currency ?? "GBP";

  return withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO payouts
         (id, recipient, amount_cents, currency, reference, status, requested_by, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(id, input.recipient, input.amountCents, currency, input.reference, user.id, requestedAt);

    appendAudit(
      {
        actor: user.id,
        action: "payout.requested",
        entity: ENTITY,
        entityId: id,
        payload: {
          recipient: input.recipient,
          amount_cents: input.amountCents,
          currency,
          reference: input.reference,
        },
      },
      tx,
    );

    return getPayout(id, tx)!;
  });
}

function decide(
  user: User,
  id: string,
  decision: Extract<PayoutStatus, "approved" | "rejected">,
  note: string | null,
): Payout {
  authorize(user, decision === "approved" ? "approve" : "reject", ENTITY);

  return withTransaction((tx) => {
    const payout = getPayout(id, tx);
    if (!payout) throw new NotFoundError(`No payout with id "${id}".`);
    if (payout.status !== "pending") {
      throw new StateError(
        `This payout is already ${payout.status}; only a pending payout can be decided.`,
      );
    }

    // The maker-checker rule, on every approval path, at submission time.
    assertDifferentActor(payout, user);

    tx.prepare(
      `UPDATE payouts
         SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
       WHERE id = ?`,
    ).run(decision, user.id, new Date().toISOString(), note, id);

    appendAudit(
      {
        actor: user.id,
        action: decision === "approved" ? "payout.approved" : "payout.rejected",
        entity: ENTITY,
        entityId: id,
        payload: { note },
      },
      tx,
    );

    return getPayout(id, tx)!;
  });
}

export function approvePayout(user: User, id: string, note: string | null = null): Payout {
  return decide(user, id, "approved", note);
}

export function rejectPayout(user: User, id: string, note: string | null = null): Payout {
  return decide(user, id, "rejected", note);
}
