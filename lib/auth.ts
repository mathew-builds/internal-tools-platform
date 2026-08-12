import { cookies } from "next/headers";
import { isRole, userForRole, type Role, type User } from "./users.ts";
import { ensureSeeded } from "./seed.ts";

export const ROLE_COOKIE = "role";

const DEFAULT_ROLE: Role = "requester";

/**
 * The authentication stub: a role switcher backed by a cookie, read on every
 * request. Real identity here would be an SSO integration.
 */
export async function getCurrentUser(): Promise<User> {
  ensureSeeded();

  const store = await cookies();
  const value = store.get(ROLE_COOKIE)?.value;
  const role: Role = isRole(value) ? value : DEFAULT_ROLE;

  const user = userForRole(role) ?? userForRole(DEFAULT_ROLE);
  if (!user) {
    throw new Error("No seeded users found; the database was not seeded.");
  }
  return user;
}
