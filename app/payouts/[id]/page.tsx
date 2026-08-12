import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getPayout } from "@/lib/payouts";
import { userName } from "@/lib/users";
import { approvePayoutAction, rejectPayoutAction } from "../actions";
import { money, when } from "../../refunds/_components/money";
import { Refusal, StatusPill, Success } from "../../refunds/_components/refusal";

export const dynamic = "force-dynamic";

export default async function PayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rule?: string; message?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { rule, message, ok } = await searchParams;

  const payout = getPayout(id);
  if (!payout) notFound();

  // Rendered for anyone who may approve, on every pending record — including one
  // this user requested. The rule refuses at submission, not in the render path.
  const showDecisionControls = payout.status === "pending" && can(user, "approve", "payout");

  return (
    <div className="space-y-6">
      <Link href="/payouts" className="text-sm text-blue-700 underline hover:text-blue-900">
        ← Back to payout approvals
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Payout <span className="font-mono text-lg text-zinc-600">{payout.id}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{payout.reference}</p>
      </div>

      {rule && message ? <Refusal rule={rule} message={message} /> : null}
      {ok ? <Success message={ok} /> : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Recipient</dt>
          <dd className="mt-1">{payout.recipient}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Amount</dt>
          <dd className="mt-1 tabular-nums">{money(payout.amount_cents, payout.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Status</dt>
          <dd className="mt-1">
            <StatusPill status={payout.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Reference</dt>
          <dd className="mt-1">{payout.reference}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Requested by</dt>
          <dd className="mt-1">
            {userName(payout.requested_by)}{" "}
            <span className="font-mono text-xs text-zinc-500">({payout.requested_by})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Requested at</dt>
          <dd className="mt-1 text-zinc-600">{when(payout.requested_at)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Decided by</dt>
          <dd className="mt-1">
            {payout.decided_by ? userName(payout.decided_by) : "—"}
            {payout.decided_at ? (
              <span className="ml-2 text-xs text-zinc-500">{when(payout.decided_at)}</span>
            ) : null}
          </dd>
        </div>
        {payout.decision_note ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Decision note</dt>
            <dd className="mt-1">{payout.decision_note}</dd>
          </div>
        ) : null}
      </dl>

      {showDecisionControls ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Decide this payout
          </h2>
          <form action={approvePayoutAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={payout.id} />
            <input
              name="note"
              placeholder="Note (optional)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Approve
            </button>
          </form>
          <form action={rejectPayoutAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={payout.id} />
            <input
              name="note"
              placeholder="Note (optional)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700"
            >
              Reject
            </button>
          </form>
          {payout.requested_by === user.id ? (
            <p className="text-xs text-zinc-500">
              You requested this payout. The control stays enabled on purpose: press Approve and the
              maker-checker rule refuses it.
            </p>
          ) : null}
        </div>
      ) : payout.status === "pending" ? (
        <p className="text-sm text-zinc-500">
          Role <span className="font-mono">{user.role}</span> cannot decide payouts.
        </p>
      ) : null}

      <Link
        href={`/payouts/${payout.id}/audit`}
        className="inline-block text-sm text-blue-700 underline hover:text-blue-900"
      >
        View audit trail for this payout →
      </Link>
    </div>
  );
}
