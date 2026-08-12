"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MakerCheckerError } from "@/lib/maker-checker";
import { PermissionError } from "@/lib/rbac";
import {
  approvePayout,
  NotFoundError,
  rejectPayout,
  requestPayout,
  StateError,
} from "@/lib/payouts";

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

export async function requestPayoutAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const recipient = String(formData.get("recipient") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);

  let refusal: Refusal | null = null;
  let created: string | null = null;

  if (!recipient || !reference || !Number.isFinite(amount) || amount <= 0) {
    refusal = {
      rule: "validation",
      message: "Validation: a payout needs a recipient, a positive amount and a reference.",
    };
  } else {
    try {
      created = requestPayout(user, {
        recipient,
        amountCents: Math.round(amount * 100),
        reference,
      }).id;
    } catch (error) {
      refusal = refusalFor(error);
      if (!refusal) throw error;
    }
  }

  revalidatePath("/payouts");
  redirect(to("/payouts", refusal, created ? `Payout ${created} requested.` : undefined));
}

async function decideAction(
  formData: FormData,
  decide: typeof approvePayout,
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

  revalidatePath("/payouts");
  revalidatePath(`/payouts/${id}`);
  redirect(to(`/payouts/${id}`, refusal, `Payout ${id} ${verb}.`));
}

export async function approvePayoutAction(formData: FormData): Promise<void> {
  await decideAction(formData, approvePayout, "approved");
}

export async function rejectPayoutAction(formData: FormData): Promise<void> {
  await decideAction(formData, rejectPayout, "rejected");
}
