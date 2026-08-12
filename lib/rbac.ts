import type { Role, User } from "./users.ts";

export type Action = "read" | "request" | "approve" | "reject";
export type Resource = "refund" | "payout" | "audit";

/**
 * Refusal raised when a role may not perform an action at all. Distinct from a
 * maker-checker refusal, which is about one specific record.
 */
export class PermissionError extends Error {
  readonly rule = "permission";

  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

const GRANTS: Record<Role, `${Resource}:${Action}`[]> = {
  requester: ["refund:read", "refund:request", "payout:read", "payout:request"],
  approver: [
    "refund:read",
    "refund:request",
    "refund:approve",
    "refund:reject",
    "payout:read",
    "payout:request",
    "payout:approve",
    "payout:reject",
  ],
  auditor: ["refund:read", "payout:read", "audit:read"],
};

export function can(
  user: Pick<User, "role"> | null | undefined,
  action: Action,
  resource: Resource,
): boolean {
  if (!user) return false;
  return GRANTS[user.role].includes(`${resource}:${action}`);
}

/**
 * Throws unless `user` holds `action` on `resource`.
 */
export function authorize(
  user: Pick<User, "role" | "name"> | null | undefined,
  action: Action,
  resource: Resource,
): void {
  if (!can(user, action, resource)) {
    throw new PermissionError(
      `Permission denied: role "${user ? user.role : "anonymous"}" may not ${action} a ${resource}.`,
    );
  }
}

/**
 * Throws unless the current user holds exactly `role`.
 */
export function requireRole(
  role: Role,
): (user: Pick<User, "role"> | null | undefined) => void {
  return (user) => {
    if (!user || user.role !== role) {
      throw new PermissionError(
        `Permission denied: this action requires the "${role}" role, not "${user ? user.role : "anonymous"}".`,
      );
    }
  };
}
