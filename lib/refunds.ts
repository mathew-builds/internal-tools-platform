import { randomUUID } from "node:crypto";
import { appendAudit } from "./audit.ts";
import { db, withTransaction, type Tx } from "./db.ts";
import { assertDifferentActor } from "./maker-checker.ts";
import { authorize } from "./rbac.ts";
import type { User } from "./users.ts";

export type RefundStatus = "pending" | "approved" | "rejected";

export type Refund = {
  id: string;
  customer: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

export const ENTITY = "refund";

export function listRefunds(): Refund[] {
  return db
    .prepare(
      `SELECT * FROM refunds
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, requested_at DESC`,
    )
    .all() as unknown as Refund[];
}

export function getRefund(id: string, tx: Tx = db): Refund | undefined {
  return tx.prepare("SELECT * FROM refunds WHERE id = ?").get(id) as Refund | undefined;
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

export type NewRefund = {
  customer: string;
  amountCents: number;
  currency?: string;
  reason: string;
};

/**
 * Raises a refund request. Business row and audit row commit together.
 */
export function requestRefund(user: User, input: NewRefund): Refund {
  authorize(user, "request", ENTITY);

  const id = `rf_${randomUUID()}`;
  const requestedAt = new Date().toISOString();
  const currency = input.currency ?? "GBP";

  return withTransaction((tx) => {
    tx.prepare(
      `INSERT INTO refunds
         (id, customer, amount_cents, currency, reason, status, requested_by, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(id, input.customer, input.amountCents, currency, input.reason, user.id, requestedAt);

    appendAudit(
      {
        actor: user.id,
        action: "refund.requested",
        entity: ENTITY,
        entityId: id,
        payload: {
          customer: input.customer,
          amount_cents: input.amountCents,
          currency,
          reason: input.reason,
        },
      },
      tx,
    );

    return getRefund(id, tx)!;
  });
}

function decide(
  user: User,
  id: string,
  decision: Extract<RefundStatus, "approved" | "rejected">,
  note: string | null,
): Refund {
  authorize(user, decision === "approved" ? "approve" : "reject", ENTITY);

  return withTransaction((tx) => {
    const refund = getRefund(id, tx);
    if (!refund) throw new NotFoundError(`No refund with id "${id}".`);
    if (refund.status !== "pending") {
      throw new StateError(
        `This refund is already ${refund.status}; only a pending refund can be decided.`,
      );
    }

    // The maker-checker rule, on every approval path, at submission time.
    assertDifferentActor(refund, user);

    tx.prepare(
      `UPDATE refunds
         SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
       WHERE id = ?`,
    ).run(decision, user.id, new Date().toISOString(), note, id);

    appendAudit(
      {
        actor: user.id,
        action: decision === "approved" ? "refund.approved" : "refund.rejected",
        entity: ENTITY,
        entityId: id,
        payload: { note },
      },
      tx,
    );

    return getRefund(id, tx)!;
  });
}

export function approveRefund(user: User, id: string, note: string | null = null): Refund {
  return decide(user, id, "approved", note);
}

export function rejectRefund(user: User, id: string, note: string | null = null): Refund {
  return decide(user, id, "rejected", note);
}
