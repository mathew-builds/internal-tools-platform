"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_COOKIE } from "@/lib/auth";
import { isRole } from "@/lib/users";

/**
 * The authentication stub's only write: set the role cookie that
 * `getCurrentUser()` reads on every request.
 */
export async function setRole(formData: FormData): Promise<void> {
  const role = formData.get("role");
  const next = formData.get("next");

  if (isRole(role)) {
    const store = await cookies();
    store.set(ROLE_COOKIE, role, { path: "/", httpOnly: false, sameSite: "lax" });
  }

  redirect(typeof next === "string" && next.startsWith("/") ? next : "/refunds");
}
