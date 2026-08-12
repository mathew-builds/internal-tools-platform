import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { auditFor } from "./audit.ts";
import { db } from "./db.ts";
import { MakerCheckerError } from "./maker-checker.ts";
import { PermissionError } from "./rbac.ts";
import { approveRefund, ENTITY, getRefund, requestRefund } from "./refunds.ts";
import type { User } from "./users.ts";

/**
 * Tests build their own records, with `test_` ids, and never touch the seeded
 * demo rows: the demo has to reproduce on any machine after the tests have run.
 */
const requester: User = {
  id: "test_u_requester",
  name: "Test Requester",
  email: "requester@test.local",
  role: "requester",
};

const approver: User = {
  id: "test_u_approver",
  name: "Test Approver",
  email: "approver@test.local",
  role: "approver",
};

const secondApprover: User = {
  id: "test_u_approver_2",
  name: "Test Approver Two",
  email: "approver2@test.local",
  role: "approver",
};

function newRefund(by: User) {
  return requestRefund(by, {
    customer: "Test Customer",
    amountCents: 1234,
    reason: "test fixture",
  });
}

describe("refunds approval path", () => {
  before(() => {
    // Sanity: the ids the rule compares are TEXT on both sides.
    const columns = db.prepare("PRAGMA table_info(refunds)").all() as {
      name: string;
      type: string;
    }[];
    const requestedBy = columns.find((c) => c.name === "requested_by");
    assert.equal(requestedBy?.type, "TEXT");
  });

  after(() => {
    // The refund rows are ours; audit rows are append-only and stay.
    db.prepare("DELETE FROM refunds WHERE requested_by LIKE 'test_u_%'").run();
  });

  it("refuses an approver approving a refund they themselves requested (maker-checker)", () => {
    const refund = newRefund(approver);

    assert.throws(
      () => approveRefund(approver, refund.id),
      (error: unknown) => {
        assert.ok(
          error instanceof MakerCheckerError,
          `expected MakerCheckerError, got ${String(error)}`,
        );
        assert.match(error.message, /maker-checker/i);
        return true;
      },
    );

    // The refusal rolled back everything: still pending, no approval audit row.
    const after = getRefund(refund.id);
    assert.equal(after?.status, "pending");
    assert.equal(after?.decided_by, null);
    const actions = auditFor(db, ENTITY, refund.id).map((row) => row.action);
    assert.deepEqual(actions, ["refund.requested"]);
  });

  it("lets an approver approve a refund someone else requested", () => {
    const refund = newRefund(requester);

    const approved = approveRefund(approver, refund.id, "checked against the order");

    assert.equal(approved.status, "approved");
    assert.equal(approved.decided_by, approver.id);
    const actions = auditFor(db, ENTITY, refund.id).map((row) => row.action);
    assert.deepEqual(actions, ["refund.requested", "refund.approved"]);
  });

  it("lets a second approver approve a refund the first approver requested", () => {
    const refund = newRefund(approver);

    const approved = approveRefund(secondApprover, refund.id);

    assert.equal(approved.status, "approved");
    assert.equal(approved.decided_by, secondApprover.id);
  });

  it("refuses a requester approving anything, before maker-checker is reached", () => {
    const refund = newRefund(requester);

    assert.throws(
      () => approveRefund(requester, refund.id),
      (error: unknown) => {
        assert.ok(
          error instanceof PermissionError,
          `expected PermissionError, got ${String(error)}`,
        );
        assert.ok(!(error instanceof MakerCheckerError));
        return true;
      },
    );

    assert.equal(getRefund(refund.id)?.status, "pending");
  });
});

describe("audit_log", () => {
  it("refuses UPDATE and DELETE at the database level", () => {
    const refund = newRefund(requester);
    const [row] = auditFor(db, ENTITY, refund.id);

    assert.throws(
      () => db.prepare("UPDATE audit_log SET action = 'tampered' WHERE id = ?").run(row.id),
      /append-only/,
    );
    assert.throws(
      () => db.prepare("DELETE FROM audit_log WHERE id = ?").run(row.id),
      /append-only/,
    );
  });
});
