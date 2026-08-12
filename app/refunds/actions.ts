"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MakerCheckerError } from "@/lib/maker-checker";
import { PermissionError } from "@/lib/rbac";
import {
  approveRefund,
  NotFoundError,
  rejectRefund,
  requestRefund,
  StateError,
} from "@/lib/refunds";

type Refusal = { rule: string; message: string };

/**
 * Turns a refusal into the rule that refused, so a maker-checker refusal never
 * renders as the same string as a permission error.
 */
function refusalFor(error: unknown): Refusal | null {
  if (error instanceof MakerCheckerError) return { rule: error.rule, message: error.message };
  if (error instanceof PermissionError) return { rule: error.rule, message: error.message };
  if (error instanceof StateError) return { rule: error.rule, message: error.message };
  if (error instanceof NotFoundError) return { rule: error.rule, message: error.message };
  return null;
}

function to(path: string, refusal: Refusal | null, ok?: string): string {
  if (!refusal) {
    return ok ? `${path}?ok=${encodeURIComponent(ok)}` : path;
  }
  return `${path}?rule=${encodeURIComponent(refusal.rule)}&message=${encodeURIComponent(refusal.message)}`;
}

export async function requestRefundAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const customer = String(formData.get("customer") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);

  let refusal: Refusal | null = null;
  let created: string | null = null;

  if (!customer || !reason || !Number.isFinite(amount) || amount <= 0) {
    refusal = {
      rule: "validation",
      message: "Validation: a refund needs a customer, a positive amount and a reason.",
    };
  } else {
    try {
      created = requestRefund(user, {
        customer,
        amountCents: Math.round(amount * 100),
        reason,
      }).id;
    } catch (error) {
      refusal = refusalFor(error);
      if (!refusal) throw error;
    }
  }

  revalidatePath("/refunds");
  redirect(to("/refunds", refusal, created ? `Refund ${created} requested.` : undefined));
}

async function decideAction(
  formData: FormData,
  decide: typeof approveRefund,
  verb: "approved" | "rejected",
): Promise<void> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  let refusal: Refusal | null = null;
  try {
    decide(user, id, note);
  } catch (error) {
    refusal = refusalFor(error);
    if (!refusal) throw error;
  }

  revalidatePath("/refunds");
  revalidatePath(`/refunds/${id}`);
  redirect(to(`/refunds/${id}`, refusal, `Refund ${id} ${verb}.`));
}

export async function approveRefundAction(formData: FormData): Promise<void> {
  await decideAction(formData, approveRefund, "approved");
}

export async function rejectRefundAction(formData: FormData): Promise<void> {
  await decideAction(formData, rejectRefund, "rejected");
}
