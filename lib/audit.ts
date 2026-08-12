import { randomUUID } from "node:crypto";
import type { Tx } from "./db.ts";

export type AuditEntry = {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  payload?: unknown;
};

export type AuditRow = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  payload: string | null;
  created_at: string;
};

/**
 * Appends one row to the append-only audit log. `tx` is required: an audit row
 * is only ever written inside the transaction that writes the business row.
 */
export function appendAudit(
  { actor, action, entity, entityId, payload }: AuditEntry,
  tx: Tx,
): string {
  const id = `au_${randomUUID()}`;
  tx.prepare(
    `INSERT INTO audit_log (id, actor, action, entity, entity_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    actor,
    action,
    entity,
    entityId,
    payload === undefined ? null : JSON.stringify(payload),
    new Date().toISOString(),
  );
  return id;
}

export function auditFor(tx: Tx, entity: string, entityId: string): AuditRow[] {
  return tx
    .prepare(
      `SELECT * FROM audit_log
       WHERE entity = ? AND entity_id = ?
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all(entity, entityId) as unknown as AuditRow[];
}
