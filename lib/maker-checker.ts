import type { User } from "./users.ts";

/**
 * Refusal raised when the actor who requested a record tries to approve it.
 * Distinct from a permission error: the role is allowed to approve, this
 * particular record is the one it may not decide.
 */
export class MakerCheckerError extends Error {
  readonly rule = "maker-checker";

  constructor(message: string) {
    super(message);
    this.name = "MakerCheckerError";
  }
}

/**
 * The maker-checker rule. Enforced at submission time by every approval path,
 * never by hiding a row or disabling a control.
 *
 * Ids are TEXT everywhere, so this comparison is TEXT to TEXT.
 */
export function assertDifferentActor(
  record: { id: string; requested_by: string },
  user: Pick<User, "id" | "name">,
): void {
  if (record.requested_by === user.id) {
    throw new MakerCheckerError(
      `Maker-checker rule: ${user.name} requested this record, so the same actor cannot decide it. A different approver must.`,
    );
  }
}
