import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { auditFor } from "./audit.ts";
import { db } from "./db.ts";
import { MakerCheckerError } from "./maker-checker.ts";
import { PermissionError } from "./rbac.ts";
import { approvePayout, ENTITY, getPayout, listPayouts, requestPayout } from "./payouts.ts";
import type { User } from "./users.ts";

/**
 * Tests build their own records, with `test_` ids, and never touch the seeded
 * demo rows: the demo has to reproduce on any machine after the tests have run.
 */
const requester: User = {
  id: "test_u_payout_requester",
  name: "Test Requester",
  email: "requester@test.local",
  role: "requester",
};

const approver: User = {
  id: "test_u_payout_approver",
  name: "Test Approver",
  email: "approver@test.local",
  role: "approver",
};

const auditor: User = {
  id: "test_u_payout_auditor",
  name: "Test Auditor",
  email: "auditor@test.local",
  role: "auditor",
};

function newPayout(by: User) {
  return requestPayout(by, {
    recipient: "Test Recipient Ltd",
    amountCents: 45_600,
    reference: "test fixture INV-0001",
  });
}

describe("payouts approval path", () => {
  before(() => {
    // Sanity: the ids the rule compares are TEXT on both sides.
    const columns = db.prepare("PRAGMA table_info(payouts)").all() as {
      name: string;
      type: string;
    }[];
    const requestedBy = columns.find((c) => c.name === "requested_by");
    assert.equal(requestedBy?.type, "TEXT");
  });

  after(() => {
    // The payout rows are ours; audit rows are append-only and stay.
    db.prepare("DELETE FROM payouts WHERE requested_by LIKE 'test_u_payout_%'").run();
  });

  it("refuses a role without approval rights, before maker-checker is reached", () => {
    const payout = newPayout(requester);

    assert.throws(
      () => approvePayout(requester, payout.id),
      (error: unknown) => {
        assert.ok(
          error instanceof PermissionError,
          `expected PermissionError, got ${String(error)}`,
        );
        assert.ok(!(error instanceof MakerCheckerError));
        return true;
      },
    );
    assert.throws(() => approvePayout(auditor, payout.id), PermissionError);

    assert.equal(getPayout(payout.id)?.status, "pending");
  });

  it("refuses an approver approving a payout they themselves requested (maker-checker)", () => {
    const payout = newPayout(approver);

    assert.throws(
      () => approvePayout(approver, payout.id),
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
    const after = getPayout(payout.id);
    assert.equal(after?.status, "pending");
    assert.equal(after?.decided_by, null);
    const actions = auditFor(db, ENTITY, payout.id).map((row) => row.action);
    assert.deepEqual(actions, ["payout.requested"]);
  });

  it("lets an approver approve a payout someone else requested", () => {
    const payout = newPayout(requester);

    const approved = approvePayout(approver, payout.id, "invoice matched to the purchase order");

    assert.equal(approved.status, "approved");
    assert.equal(approved.decided_by, approver.id);
    const actions = auditFor(db, ENTITY, payout.id).map((row) => row.action);
    assert.deepEqual(actions, ["payout.requested", "payout.approved"]);
  });
});

describe("payouts list", () => {
  after(() => {
    db.prepare("DELETE FROM payouts WHERE requested_by LIKE 'test_u_payout_%'").run();
  });

  it("filters by status", () => {
    const pending = newPayout(requester);
    const decided = newPayout(requester);
    approvePayout(approver, decided.id);

    const pendingIds = listPayouts("pending").map((p) => p.id);
    const approvedIds = listPayouts("approved").map((p) => p.id);

    assert.ok(pendingIds.includes(pending.id));
    assert.ok(!pendingIds.includes(decided.id));
    assert.ok(approvedIds.includes(decided.id));
    assert.ok(listPayouts().length >= pendingIds.length + approvedIds.length);
  });
});
