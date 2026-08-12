import { db } from "./db.ts";

export type Role = "requester" | "approver" | "auditor";

export const ROLES: Role[] = ["requester", "approver", "auditor"];

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function userForRole(role: Role): User | undefined {
  return db.prepare("SELECT * FROM users WHERE role = ? ORDER BY id LIMIT 1").get(role) as
    | User
    | undefined;
}

export function userById(id: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function userName(id: string): string {
  return userById(id)?.name ?? id;
}
